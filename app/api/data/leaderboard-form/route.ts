import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { IS_PRODUCTION_MODE } from '@/lib/tournament-config'
import { MOCK_MATCHES, MOCK_PREDICTIONS } from '@/lib/mock-data'

// Public endpoint — no auth required.
// Returns the last 5 globally settled matches plus ALL players' locked predictions
// for those matches. Used by the leaderboard "Ostatnie 5" column.
// Locked predictions are settled results — no cheating risk.

export type LeaderboardFormPred = {
  user_id: string
  match_id: string
  points_earned: number
  predicted_a: number
  predicted_b: number
  predicted_result: string | null
}

export type LeaderboardFormMatch = {
  id: string
  team_a: string
  team_b: string
  score_a: number
  score_b: number
  match_date: string
}

export async function GET() {
  if (!IS_PRODUCTION_MODE) {
    const finishedMatches = MOCK_MATCHES
      .filter(m => m.status === 'finished' && m.score_a !== null && m.score_b !== null)
      .sort((a, b) => new Date(b.match_date).getTime() - new Date(a.match_date).getTime())
      .slice(0, 5)
      .reverse()

    const matchIds = new Set(finishedMatches.map(m => m.id))
    const preds = MOCK_PREDICTIONS
      .filter(p => p.is_locked && matchIds.has(p.match_id))
      .map(p => ({
        user_id: p.user_id,
        match_id: p.match_id,
        points_earned: p.points_earned ?? 0,
        predicted_a: p.predicted_a,
        predicted_b: p.predicted_b,
        predicted_result: p.predicted_result ?? null,
      }))

    const matches: LeaderboardFormMatch[] = finishedMatches.map(m => ({
      id: m.id,
      team_a: m.team_a,
      team_b: m.team_b,
      score_a: m.score_a as number,
      score_b: m.score_b as number,
      match_date: m.match_date,
    }))

    return NextResponse.json({ matches, predictions: preds })
  }

  try {
    const db = createAdminClient()

    const { data: matchRows, error: matchErr } = await db
      .from('matches')
      .select('id, team_a, team_b, score_a, score_b, match_date')
      .eq('status', 'finished')
      .not('score_a', 'is', null)
      .not('score_b', 'is', null)
      .neq('is_archived', true)
      .like('external_id', 'wc26_%')
      .order('match_date', { ascending: false })
      .limit(5)

    if (matchErr) return NextResponse.json({ error: matchErr.message }, { status: 500 })
    if (!matchRows || matchRows.length === 0) {
      return NextResponse.json({ matches: [], predictions: [] })
    }

    const matches: LeaderboardFormMatch[] = [...matchRows].reverse().map(m => ({
      id: m.id,
      team_a: m.team_a,
      team_b: m.team_b,
      score_a: m.score_a as number,
      score_b: m.score_b as number,
      match_date: m.match_date,
    }))

    const matchIds = matches.map(m => m.id)

    const { data: predRows, error: predErr } = await db
      .from('predictions')
      .select('user_id, match_id, points_earned, predicted_a, predicted_b, predicted_result')
      .in('match_id', matchIds)
      .eq('is_locked', true)

    if (predErr) return NextResponse.json({ error: predErr.message }, { status: 500 })

    const predictions: LeaderboardFormPred[] = (predRows ?? []).map(p => ({
      user_id: p.user_id,
      match_id: p.match_id,
      points_earned: p.points_earned ?? 0,
      predicted_a: p.predicted_a,
      predicted_b: p.predicted_b,
      predicted_result: p.predicted_result ?? null,
    }))

    return NextResponse.json({ matches, predictions })
  } catch (err) {
    console.error('[data/leaderboard-form GET]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
