import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { IS_PRODUCTION_MODE } from '@/lib/tournament-config'

const KO_PHASES = ['round_of_16', 'quarterfinal', 'semifinal', 'third_place', 'final']

export interface TeamPickStat {
  team_name: string
  team_code: string
  total_picks: number
}

export interface PerUserKoPick {
  user_id: string
  team_name: string
  team_code: string
  picks: number
  total_ko_matches: number
}

export interface RoundStat {
  user_id: string
  day: string
  points: number
  match_count: number
}

export async function GET(req: NextRequest) {
  const sessionId = req.cookies.get('typerzy_session')?.value
  if (!sessionId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!IS_PRODUCTION_MODE) {
    return NextResponse.json({ teamPickStats: [], perUserKoPicks: [], roundStats: [] })
  }

  try {
    const db = createAdminClient()

    // ── KO picks ────────────────────────────────────────────────────────────
    const { data: koMatchRows } = await db
      .from('matches')
      .select('id, team_a, team_b, team_a_code, team_b_code')
      .in('phase', KO_PHASES)
      .not('is_archived', 'eq', true)

    const koMatches = koMatchRows ?? []
    const koMatchIds = koMatches.map(m => m.id as string)

    // team name → code lookup built from match data
    const teamCodeMap: Record<string, string> = {}
    for (const m of koMatches) {
      if (m.team_a && m.team_a_code) teamCodeMap[m.team_a] = m.team_a_code
      if (m.team_b && m.team_b_code) teamCodeMap[m.team_b] = m.team_b_code
    }

    type KoPred = { user_id: string; match_id: string; predicted_winner: string | null }
    let koPreds: KoPred[] = []
    if (koMatchIds.length > 0) {
      const { data } = await db
        .from('predictions')
        .select('user_id, match_id, predicted_winner')
        .in('match_id', koMatchIds)
        .not('predicted_winner', 'is', null)
      koPreds = (data ?? []).filter(p => p.predicted_winner) as KoPred[]
    }

    // aggregate: team → total picks
    const teamMap: Record<string, number> = {}
    // aggregate: user → team → count
    const userTeamMap: Record<string, Record<string, number>> = {}

    for (const p of koPreds) {
      const team = p.predicted_winner as string
      teamMap[team] = (teamMap[team] ?? 0) + 1
      if (!userTeamMap[p.user_id]) userTeamMap[p.user_id] = {}
      userTeamMap[p.user_id][team] = (userTeamMap[p.user_id][team] ?? 0) + 1
    }

    const teamPickStats: TeamPickStat[] = Object.entries(teamMap)
      .map(([team_name, total_picks]) => ({
        team_name,
        team_code: teamCodeMap[team_name] ?? '',
        total_picks,
      }))
      .sort((a, b) => b.total_picks - a.total_picks)
      .slice(0, 15)

    const totalKoMatches = koMatchIds.length
    const perUserKoPicks: PerUserKoPick[] = Object.entries(userTeamMap).map(([user_id, picks]) => {
      const [team_name, count] = Object.entries(picks).sort((a, b) => b[1] - a[1])[0]
      return {
        user_id,
        team_name,
        team_code: teamCodeMap[team_name] ?? '',
        picks: count,
        total_ko_matches: totalKoMatches,
      }
    })

    // ── Round points ─────────────────────────────────────────────────────────
    const { data: finRows } = await db
      .from('matches')
      .select('id, official_match_day')
      .eq('status', 'finished')
      .not('is_archived', 'eq', true)
      .not('official_match_day', 'is', null)

    const finishedMatches = finRows ?? []
    const dayById: Record<string, string> = {}
    for (const m of finishedMatches) {
      if (m.official_match_day != null) dayById[m.id as string] = String(m.official_match_day)
    }

    const finishedIds = finishedMatches.map(m => m.id as string)

    type RoundPred = { user_id: string; match_id: string; points_earned: number | null }
    let roundPreds: RoundPred[] = []
    if (finishedIds.length > 0) {
      const { data } = await db
        .from('predictions')
        .select('user_id, match_id, points_earned')
        .in('match_id', finishedIds)
      roundPreds = (data ?? []) as RoundPred[]
    }

    // aggregate: user → day → { points, match_count }
    const roundMap: Record<string, Record<string, { points: number; match_count: number }>> = {}
    for (const p of roundPreds) {
      const day = dayById[p.match_id]
      if (!day) continue
      if (!roundMap[p.user_id]) roundMap[p.user_id] = {}
      if (!roundMap[p.user_id][day]) roundMap[p.user_id][day] = { points: 0, match_count: 0 }
      roundMap[p.user_id][day].points += p.points_earned ?? 0
      roundMap[p.user_id][day].match_count++
    }

    const roundStats: RoundStat[] = Object.entries(roundMap).flatMap(([user_id, days]) =>
      Object.entries(days).map(([day, { points, match_count }]) => ({
        user_id, day, points, match_count,
      }))
    )

    return NextResponse.json({ teamPickStats, perUserKoPicks, roundStats })
  } catch (err) {
    console.error('[data/podsumowanie GET]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
