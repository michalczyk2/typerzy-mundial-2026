import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculateMatchPoints, SCORING_DEFAULTS } from '@/lib/scoring'
import { IS_PRODUCTION_MODE } from '@/lib/tournament-config'

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

    // 2a. Load settled match-of-day bonus map (idempotent: included in points_earned)
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
      .select('id, score_a, score_b')
      .eq('status', 'finished')
      .not('score_a', 'is', null)
      .not('score_b', 'is', null)

    if (matchErr) throw matchErr
    if (!matches || matches.length === 0) {
      return NextResponse.json({ message: 'Brak skończonych meczów', updated: 0 })
    }

    const matchIds = matches.map(m => m.id)
    const matchMap = new Map(matches.map(m => [m.id, m]))

    // 3. Get all predictions for finished matches
    const { data: predictions, error: predErr } = await db
      .from('predictions')
      .select('id, user_id, match_id, predicted_a, predicted_b')
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
