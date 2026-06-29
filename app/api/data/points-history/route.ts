import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { IS_PRODUCTION_MODE } from '@/lib/tournament-config'
import { MOCK_MATCHES, MOCK_PREDICTIONS, MOCK_BONUS_POINTS } from '@/lib/mock-data'
import type {
  PointsHistoryMatch,
  PointsHistoryPred,
  PointsHistoryBonus,
  PointsHistoryModEvent,
} from '@/lib/points-history'

// Public, read-only endpoint — no auth required (same boundary as leaderboard-form /
// last-predictions: only finished matches + locked predictions are ever returned, so
// no in-progress picks can leak). Reconstructs "what points were given for" without
// writing anything or duplicating the scoring algorithm.

export async function GET() {
  if (!IS_PRODUCTION_MODE) {
    const finishedMatches = MOCK_MATCHES.filter(
      m => m.status === 'finished' && m.score_a !== null && m.score_b !== null,
    )
    const matchIds = new Set(finishedMatches.map(m => m.id))

    const matches: PointsHistoryMatch[] = finishedMatches.map(m => ({
      id: m.id,
      team_a: m.team_a,
      team_b: m.team_b,
      team_a_code: m.team_a_code,
      team_b_code: m.team_b_code,
      score_a: m.score_a as number,
      score_b: m.score_b as number,
      match_date: m.match_date,
      round: m.round,
      group_name: m.group_name,
      phase: m.phase,
      winner: null,
    }))

    const predictions: PointsHistoryPred[] = MOCK_PREDICTIONS
      .filter(p => p.is_locked && matchIds.has(p.match_id))
      .map(p => ({
        user_id: p.user_id,
        match_id: p.match_id,
        predicted_a: p.predicted_a,
        predicted_b: p.predicted_b,
        predicted_result: p.predicted_result ?? null,
        points_earned: p.points_earned ?? 0,
        is_correct_outcome: p.is_correct_outcome,
        is_correct_score: p.is_correct_score,
        is_admin_override: false,
        admin_override_reason: null,
        predicted_winner: null,
      }))

    const bonuses: PointsHistoryBonus[] = MOCK_BONUS_POINTS.map(b => ({
      user_id: b.user_id,
      match_id: b.match_id,
      round: b.round,
      bonus_type: b.bonus_type,
      points: b.points,
      description: b.description,
      created_at: b.created_at,
    }))

    // No mock data source exists for match-of-day events.
    return NextResponse.json({ matches, predictions, bonuses, modEvents: [] })
  }

  try {
    const db = createAdminClient()

    const { data: matchRows, error: matchErr } = await db
      .from('matches')
      .select('id, team_a, team_b, team_a_code, team_b_code, score_a, score_b, match_date, round, group_name, phase, winner')
      .eq('status', 'finished')
      .not('score_a', 'is', null)
      .not('score_b', 'is', null)
      .neq('is_archived', true)
      .order('match_date', { ascending: false })

    if (matchErr) return NextResponse.json({ error: matchErr.message }, { status: 500 })
    if (!matchRows || matchRows.length === 0) {
      return NextResponse.json({ matches: [], predictions: [], bonuses: [], modEvents: [] })
    }

    const matches: PointsHistoryMatch[] = matchRows.map(m => ({
      id: m.id,
      team_a: m.team_a,
      team_b: m.team_b,
      team_a_code: m.team_a_code,
      team_b_code: m.team_b_code,
      score_a: m.score_a as number,
      score_b: m.score_b as number,
      match_date: m.match_date,
      round: m.round,
      group_name: m.group_name,
      phase: m.phase,
      winner: m.winner ?? null,
    }))

    const matchIds = matches.map(m => m.id)

    const [{ data: predRows, error: predErr }, { data: bonusRows, error: bonusErr }, { data: modRows, error: modErr }] =
      await Promise.all([
        db
          .from('predictions')
          .select('user_id, match_id, predicted_a, predicted_b, predicted_result, points_earned, is_correct_outcome, is_correct_score, is_admin_override, admin_override_reason, predicted_winner')
          .in('match_id', matchIds)
          .eq('is_locked', true),
        db
          .from('bonus_points')
          .select('user_id, match_id, round, bonus_type, points, description, created_at'),
        db
          .from('match_of_day_events')
          .select('match_id, selected_bonus_points')
          .eq('status', 'settled')
          .not('selected_bonus_points', 'is', null),
      ])

    if (predErr) return NextResponse.json({ error: predErr.message }, { status: 500 })
    if (bonusErr) return NextResponse.json({ error: bonusErr.message }, { status: 500 })
    if (modErr) return NextResponse.json({ error: modErr.message }, { status: 500 })

    const predictions: PointsHistoryPred[] = (predRows ?? []).map(p => ({
      user_id: p.user_id,
      match_id: p.match_id,
      predicted_a: p.predicted_a,
      predicted_b: p.predicted_b,
      predicted_result: p.predicted_result ?? null,
      points_earned: p.points_earned ?? 0,
      is_correct_outcome: p.is_correct_outcome,
      is_correct_score: p.is_correct_score,
      is_admin_override: p.is_admin_override ?? false,
      admin_override_reason: p.admin_override_reason ?? null,
      predicted_winner: p.predicted_winner ?? null,
    }))

    const bonuses: PointsHistoryBonus[] = (bonusRows ?? []).map(b => ({
      user_id: b.user_id,
      match_id: b.match_id,
      round: b.round,
      bonus_type: b.bonus_type,
      points: b.points,
      description: b.description,
      created_at: b.created_at,
    }))

    const modEvents: PointsHistoryModEvent[] = (modRows ?? []).map(e => ({
      match_id: e.match_id,
      selected_bonus_points: e.selected_bonus_points as number,
    }))

    return NextResponse.json({ matches, predictions, bonuses, modEvents })
  } catch (err) {
    console.error('[data/points-history GET]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
