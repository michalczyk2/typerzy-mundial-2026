import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { IS_PRODUCTION_MODE } from '@/lib/tournament-config'

// GET /api/match-of-day/current
// Returns today's (or next upcoming) match-of-day event with vote data.
// Public endpoint — no auth required to read.
// User's own vote is returned if session cookie is present.
export async function GET(req: NextRequest) {
  if (!IS_PRODUCTION_MODE) {
    return NextResponse.json({ event: null })
  }

  try {
    const db = createAdminClient()
    const todayUtc = new Date().toISOString().slice(0, 10)

    // Look for today's event first, then nearest future event
    const { data: events } = await db
      .from('match_of_day_events')
      .select('id, official_match_day, match_id, vote_deadline, selected_bonus_points, status')
      .gte('official_match_day', todayUtc)
      .order('official_match_day', { ascending: true })
      .limit(1)

    let event = events?.[0] ?? null

    // Fallback: if today has no future event, return today's settled event
    if (!event) {
      const { data: todayEvent } = await db
        .from('match_of_day_events')
        .select('id, official_match_day, match_id, vote_deadline, selected_bonus_points, status')
        .eq('official_match_day', todayUtc)
        .maybeSingle()
      event = todayEvent ?? null
    }

    if (!event) {
      return NextResponse.json({ event: null })
    }

    // Fetch the match details — include external_id and is_archived to detect legacy ofb_* matches
    const { data: rawMatch } = await db
      .from('matches')
      .select('id, team_a, team_b, team_a_code, team_b_code, match_date, status, score_a, score_b, external_id, is_archived')
      .eq('id', event.match_id)
      .single()

    // Auto-remap: if event still points to an ofb_* or archived match, upgrade to the canonical wc26_* match
    let match = rawMatch
    if (rawMatch && (String(rawMatch.external_id ?? '').startsWith('ofb_') || rawMatch.is_archived)) {
      const { data: canonical } = await db
        .from('matches')
        .select('id, team_a, team_b, team_a_code, team_b_code, match_date, status, score_a, score_b, external_id, is_archived')
        .like('external_id', 'wc26_%')
        .ilike('team_a', String(rawMatch.team_a))
        .ilike('team_b', String(rawMatch.team_b))
        .neq('is_archived', true)
        .limit(1)
        .maybeSingle()

      if (canonical) {
        await db
          .from('match_of_day_events')
          .update({ match_id: canonical.id })
          .eq('id', event.id)
        console.log('[match-of-day/current] remapped event', event.id, 'from', rawMatch.id, '→', canonical.id)
        match = canonical
      }
    }

    const isVotingOpen =
      event.status !== 'settled' && new Date(event.vote_deadline) > new Date()

    // Detect admin session (admins see full vote distribution even during voting)
    const sessionId = req.cookies.get('typerzy_session')?.value
    let isAdmin = false
    let myVote: number | null = null
    if (sessionId) {
      const { data: profile } = await db
        .from('profiles')
        .select('role, status')
        .eq('id', sessionId)
        .single()
      isAdmin = profile?.role === 'admin'

      // User's own vote
      const { data: myVoteRow } = await db
        .from('match_of_day_votes')
        .select('bonus_points')
        .eq('event_id', event.id)
        .eq('user_id', sessionId)
        .maybeSingle()
      myVote = (myVoteRow?.bonus_points as number | null) ?? null
    }

    // Vote counts: always visible to admin, only after deadline to regular users
    let voteCounts: Record<number, number> | null = null
    let totalVotes = 0
    if (!isVotingOpen || isAdmin) {
      const { data: votes } = await db
        .from('match_of_day_votes')
        .select('bonus_points')
        .eq('event_id', event.id)

      const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
      for (const v of votes ?? []) {
        counts[v.bonus_points as number] = (counts[v.bonus_points as number] ?? 0) + 1
      }
      voteCounts = counts
      totalVotes = votes?.length ?? 0
    } else {
      // During voting for regular users: only total count, not distribution
      const { count } = await db
        .from('match_of_day_votes')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', event.id)
      totalVotes = count ?? 0
    }

    return NextResponse.json({
      event: { ...event, match },
      isVotingOpen,
      myVote,
      voteCounts,
      totalVotes,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[match-of-day/current]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
