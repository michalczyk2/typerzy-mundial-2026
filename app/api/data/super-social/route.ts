import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const sessionId = req.cookies.get('typerzy_session')?.value
  if (!sessionId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const db = createAdminClient()

    const { data: caller } = await db
      .from('profiles')
      .select('id, status')
      .eq('id', sessionId)
      .single()

    if (!caller || caller.status !== 'active') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const [matchResult, profileResult] = await Promise.all([
      db
        .from('matches')
        .select('id, team_a, team_b, team_a_code, team_b_code, match_date, status, score_a, score_b, round, phase, group_name, winner')
        .neq('is_archived', true)
        .order('match_date', { ascending: true }),
      db
        .from('profiles')
        .select('id, nick')
        .eq('status', 'active')
        .neq('role', 'admin')
        .order('nick', { ascending: true }),
    ])

    if (matchResult.error) return NextResponse.json({ error: matchResult.error.message }, { status: 500 })
    if (profileResult.error) return NextResponse.json({ error: profileResult.error.message }, { status: 500 })

    const matchRows = matchResult.data ?? []
    const profileRows = profileResult.data ?? []
    const matchIds = matchRows.map(m => m.id)

    const players = profileRows.map(p => ({ user_id: p.id, nick: p.nick }))

    let predRows: Array<{
      user_id: string
      match_id: string
      predicted_a: number | null
      predicted_b: number | null
      predicted_result: string | null
      predicted_winner: string | null
      points_earned: number | null
      is_correct_outcome: boolean | null
      is_correct_score: boolean | null
    }> = []

    if (matchIds.length > 0) {
      const { data, error } = await db
        .from('predictions')
        .select('user_id, match_id, predicted_a, predicted_b, predicted_result, predicted_winner, points_earned, is_correct_outcome, is_correct_score')
        .in('match_id', matchIds)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      predRows = data ?? []
    }

    const predMap = new Map<string, Map<string, typeof predRows[0]>>()
    for (const p of predRows) {
      if (!predMap.has(p.match_id)) predMap.set(p.match_id, new Map())
      predMap.get(p.match_id)!.set(p.user_id, p)
    }

    const matches = matchRows.map(m => ({
      id: m.id,
      team_a: m.team_a,
      team_b: m.team_b,
      team_a_code: m.team_a_code,
      team_b_code: m.team_b_code,
      match_date: m.match_date,
      status: m.status,
      score_a: m.score_a,
      score_b: m.score_b,
      round: m.round,
      phase: m.phase,
      group_name: m.group_name,
      winner: m.winner ?? null,
      predictions: players.map(pl => {
        const pred = predMap.get(m.id)?.get(pl.user_id)
        return {
          user_id: pl.user_id,
          nick: pl.nick,
          predicted_a: pred?.predicted_a ?? null,
          predicted_b: pred?.predicted_b ?? null,
          predicted_result: pred?.predicted_result ?? null,
          predicted_winner: pred?.predicted_winner ?? null,
          points_earned: pred?.points_earned ?? null,
          is_correct_outcome: pred?.is_correct_outcome ?? null,
          is_correct_score: pred?.is_correct_score ?? null,
        }
      }),
    }))

    return NextResponse.json({ matches, players })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
