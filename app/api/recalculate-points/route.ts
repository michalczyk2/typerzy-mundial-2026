import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculateMatchPoints, SCORING_DEFAULTS } from '@/lib/scoring'
import { IS_PRODUCTION_MODE } from '@/lib/tournament-config'
import type { PredictionResult } from '@/types'

async function isAuthorized(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && auth === `Bearer ${cronSecret}`) return true

  const sessionId = req.cookies.get('typerzy_session')?.value
  if (!sessionId) return false
  const db = createAdminClient()
  const { data } = await db.from('profiles').select('role').eq('id', sessionId).single()
  return data?.role === 'admin'
}

export async function POST(req: NextRequest) {
  if (!await isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!IS_PRODUCTION_MODE) {
    console.log('[recalculate-points] mock mode — no-op')
    return NextResponse.json({ message: 'Tryb lokalny — brak przeliczania' })
  }

  try {
    const db = createAdminClient()

    // 1. Load scoring settings (fall back to hardcoded defaults if table is empty)
    const { data: settingsRows } = await db
      .from('scoring_settings')
      .select('key, value')
    const settingsMap = Object.fromEntries((settingsRows ?? []).map(r => [r.key, r.value as number]))
    const outcomePoints = settingsMap['outcome_points'] ?? SCORING_DEFAULTS.outcome_points.value
    const exactScorePoints = settingsMap['exact_score_points'] ?? SCORING_DEFAULTS.exact_score_points.value

    // 2a. Auto-finalize overdue match-of-day events before calculating bonuses.
    // This ensures bonuses are available even if the finalize cron hasn't run yet.
    const nowIso = new Date().toISOString()
    const { data: dueEvents } = await db
      .from('match_of_day_events')
      .select('id')
      .in('status', ['voting', 'locked'])
      .lt('vote_deadline', nowIso)

    for (const ev of dueEvents ?? []) {
      const { data: votes } = await db
        .from('match_of_day_votes')
        .select('bonus_points')
        .eq('event_id', ev.id)
      const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
      for (const v of votes ?? []) counts[v.bonus_points as number] = (counts[v.bonus_points as number] ?? 0) + 1
      const totalVotes = Object.values(counts).reduce((a, b) => a + b, 0)
      let selectedBonus = 2
      if (totalVotes > 0) {
        const maxVotes = Math.max(...Object.values(counts))
        const tied = ([4, 3, 2, 1] as const).filter(b => counts[b] === maxVotes)
        selectedBonus = tied[tied.length - 1]
      }
      await db.from('match_of_day_events').update({
        selected_bonus_points: selectedBonus,
        status: 'settled',
        updated_at: nowIso,
      }).eq('id', ev.id)
    }

    // 2b. Load settled match-of-day bonus map (idempotent: included in points_earned)
    const { data: modEvents } = await db
      .from('match_of_day_events')
      .select('match_id, selected_bonus_points')
      .eq('status', 'settled')
      .not('selected_bonus_points', 'is', null)
    const modBonusMap = new Map<string, number>(
      (modEvents ?? []).map(e => [e.match_id as string, e.selected_bonus_points as number])
    )

    // 2. Get all finished matches with scores
    const { data: matches, error: matchErr } = await db
      .from('matches')
      .select('id, score_a, score_b, phase, round')
      .eq('status', 'finished')
      .not('score_a', 'is', null)
      .not('score_b', 'is', null)

    if (matchErr) throw matchErr
    if (!matches || matches.length === 0) {
      return NextResponse.json({ message: 'Brak skończonych meczów', updated: 0 })
    }

    const matchIds = matches.map(m => m.id)
    const matchMap = new Map(matches.map(m => [m.id, m]))

    // Build round completeness maps for group-phase perfect_round bonus
    const { data: allGroupMatches } = await db
      .from('matches')
      .select('round, status')
      .eq('phase', 'group')

    const roundMatchCounts = new Map<number, number>()
    const roundFinishedCounts = new Map<number, number>()
    for (const m of allGroupMatches ?? []) {
      if (m.round == null) continue
      roundMatchCounts.set(m.round, (roundMatchCounts.get(m.round) ?? 0) + 1)
      if (m.status === 'finished') {
        roundFinishedCounts.set(m.round, (roundFinishedCounts.get(m.round) ?? 0) + 1)
      }
    }
    const completeRounds = new Set<number>(
      [...roundMatchCounts.entries()]
        .filter(([r, total]) => (roundFinishedCounts.get(r) ?? 0) >= total)
        .map(([r]) => r)
    )

    // 3. Get all predictions for finished matches
    const { data: predictions, error: predErr } = await db
      .from('predictions')
      .select('id, user_id, match_id, predicted_a, predicted_b, predicted_result')
      .in('match_id', matchIds)

    if (predErr) throw predErr
    if (!predictions || predictions.length === 0) {
      return NextResponse.json({ message: 'Brak typowań do przeliczenia', updated: 0 })
    }

    // 4. Calculate points for each prediction
    const profileStats: Record<string, {
      match_points: number
      predictions_count: number
      correct_outcomes: number
      correct_scores: number
    }> = {}

    const roundUserStats = new Map<number, Map<string, { correct: number; total: number }>>()
    let updatedCount = 0

    for (const pred of predictions) {
      const match = matchMap.get(pred.match_id)
      if (!match) continue

      const { points, is_correct_outcome, is_correct_score } = calculateMatchPoints(
        pred.predicted_a,
        pred.predicted_b,
        match.score_a,
        match.score_b,
        outcomePoints,
        exactScorePoints,
        pred.predicted_result as PredictionResult | undefined,
      )

      // Add match-of-day bonus when player had any correct prediction for that match
      const modBonus = modBonusMap.get(pred.match_id)
      const totalPoints = (modBonus && points > 0) ? points + modBonus : points

      const { error: upErr } = await db
        .from('predictions')
        .update({ points_earned: totalPoints, is_correct_outcome, is_correct_score, is_locked: true })
        .eq('id', pred.id)

      if (upErr) {
        console.error('[recalculate-points] prediction update failed', pred.id, upErr)
        continue
      }

      updatedCount++

      if (!profileStats[pred.user_id]) {
        profileStats[pred.user_id] = { match_points: 0, predictions_count: 0, correct_outcomes: 0, correct_scores: 0 }
      }
      profileStats[pred.user_id].match_points += totalPoints
      profileStats[pred.user_id].predictions_count += 1
      if (is_correct_outcome) profileStats[pred.user_id].correct_outcomes += 1
      if (is_correct_score) profileStats[pred.user_id].correct_scores += 1

      // Track perfect_round eligibility for group-phase matches
      const matchRecord = matchMap.get(pred.match_id)
      if (matchRecord?.phase === 'group' && matchRecord.round != null) {
        const r = matchRecord.round as number
        if (!roundUserStats.has(r)) roundUserStats.set(r, new Map())
        const userMap = roundUserStats.get(r)!
        const cur = userMap.get(pred.user_id) ?? { correct: 0, total: 0 }
        userMap.set(pred.user_id, {
          correct: cur.correct + (is_correct_outcome ? 1 : 0),
          total: cur.total + 1,
        })
      }
    }

    // 4.5 Award perfect_round bonuses for complete group rounds
    const perfectRoundBonus = settingsMap['perfect_round_bonus'] ?? SCORING_DEFAULTS.perfect_round_bonus.value

    for (const [round, userMap] of roundUserStats.entries()) {
      if (!completeRounds.has(round)) continue
      const totalInRound = roundMatchCounts.get(round) ?? 0

      for (const [userId, stats] of userMap.entries()) {
        if (stats.total < totalInRound || stats.correct < stats.total) continue

        const { data: existing } = await db
          .from('bonus_points')
          .select('id')
          .eq('user_id', userId)
          .eq('bonus_type', 'perfect_round')
          .eq('round', round)
          .maybeSingle()
        if (existing) continue

        await db.from('bonus_points').insert({
          user_id: userId,
          match_id: null,
          round,
          bonus_type: 'perfect_round',
          points: perfectRoundBonus,
          description: `Perfekcyjna kolejka ${round} — wszystkie wyniki trafione`,
        })

        const { data: profile } = await db
          .from('profiles')
          .select('bonus_points_total')
          .eq('id', userId)
          .single()

        await db.from('profiles').update({
          bonus_points_total: ((profile?.bonus_points_total as number) ?? 0) + perfectRoundBonus,
        }).eq('id', userId)
      }
    }

    // 4.6 Award risky_pick (Idealny typ) bonus per match
    // Exactly 1 player with classic predicted_result (not double-chance) AND points == maxClassicPoints
    const riskyPickBonus = settingsMap['risky_pick_bonus'] ?? SCORING_DEFAULTS.risky_pick_bonus.value
    const maxClassicPoints = outcomePoints + exactScorePoints

    // Group predictions by match to find per-match winners
    const byMatch = new Map<string, Array<{ user_id: string; points: number; predicted_result: string | null }>>()
    for (const pred of predictions) {
      if (!byMatch.has(pred.match_id)) byMatch.set(pred.match_id, [])
      const match = matchMap.get(pred.match_id)
      if (!match) continue
      const { points } = calculateMatchPoints(
        pred.predicted_a, pred.predicted_b, match.score_a, match.score_b,
        outcomePoints, exactScorePoints, pred.predicted_result as PredictionResult | undefined,
      )
      byMatch.get(pred.match_id)!.push({ user_id: pred.user_id, points, predicted_result: pred.predicted_result })
    }

    for (const [matchId, preds] of byMatch.entries()) {
      const idealCandidates = preds.filter(p => {
        const isClassic = !p.predicted_result || (p.predicted_result !== 'home_or_draw' && p.predicted_result !== 'away_or_draw')
        return isClassic && p.points === maxClassicPoints
      })
      if (idealCandidates.length !== 1) continue

      const winnerId = idealCandidates[0].user_id

      const { data: existing } = await db
        .from('bonus_points')
        .select('id')
        .eq('user_id', winnerId)
        .eq('bonus_type', 'risky_pick')
        .eq('match_id', matchId)
        .maybeSingle()
      if (existing) continue

      await db.from('bonus_points').insert({
        user_id: winnerId,
        match_id: matchId,
        round: null,
        bonus_type: 'risky_pick',
        points: riskyPickBonus,
        description: `Idealny typ — jedyny z maksymalną liczbą punktów klasycznych (${maxClassicPoints} pkt)`,
      })

      if (!profileStats[winnerId]) {
        profileStats[winnerId] = { match_points: 0, predictions_count: 0, correct_outcomes: 0, correct_scores: 0 }
      }

      const { data: profile } = await db
        .from('profiles')
        .select('bonus_points_total')
        .eq('id', winnerId)
        .single()

      await db.from('profiles').update({
        bonus_points_total: ((profile?.bonus_points_total as number) ?? 0) + riskyPickBonus,
      }).eq('id', winnerId)
    }

    // 5. Update profile aggregates
    for (const [userId, stats] of Object.entries(profileStats)) {
      const { data: profile } = await db
        .from('profiles')
        .select('bonus_points_total')
        .eq('id', userId)
        .single()

      const bonusTotal = (profile?.bonus_points_total as number) ?? 0

      await db.from('profiles').update({
        match_points: stats.match_points,
        total_points: stats.match_points + bonusTotal,
        predictions_count: stats.predictions_count,
        correct_outcomes: stats.correct_outcomes,
        correct_scores: stats.correct_scores,
        updated_at: new Date().toISOString(),
      }).eq('id', userId)
    }

    // 6. Log the sync
    await db.from('sync_logs').insert({
      sync_type: 'points',
      status: 'success',
      records_updated: updatedCount,
      message: `Przeliczono punkty dla ${updatedCount} typowań, ${Object.keys(profileStats).length} graczy`,
    })

    return NextResponse.json({
      message: 'Przeliczono punkty',
      updated: updatedCount,
      players: Object.keys(profileStats).length,
    })
  } catch (err) {
    console.error('[recalculate-points]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  return POST(req)
}
