import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { IS_PRODUCTION_MODE } from '@/lib/tournament-config'

async function isAdmin(req: NextRequest): Promise<boolean> {
  const sessionId = req.cookies.get('typerzy_session')?.value
  if (!sessionId) return false
  const db = createAdminClient()
  const { data } = await db.from('profiles').select('role').eq('id', sessionId).single()
  return data?.role === 'admin'
}

// POST /api/match-of-day/reroll
// Admin-only. Picks a different match for the current upcoming match-of-day event.
// Clears existing votes and resets the event to 'voting'.
// Blocked if vote_deadline has passed (first match of the day already started).
export async function POST(req: NextRequest) {
  if (!IS_PRODUCTION_MODE) {
    return NextResponse.json({ error: 'Tylko w trybie produkcyjnym' }, { status: 400 })
  }

  if (!await isAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized — only admin' }, { status: 401 })
  }

  try {
    const db = createAdminClient()
    const todayUtc = new Date().toISOString().slice(0, 10)
    const now = new Date()

    // Find the nearest active (non-settled) upcoming event
    const { data: event } = await db
      .from('match_of_day_events')
      .select('id, official_match_day, match_id, vote_deadline, status')
      .neq('status', 'settled')
      .gte('official_match_day', todayUtc)
      .order('official_match_day', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (!event) {
      return NextResponse.json({ error: 'Brak aktywnego meczu dnia do ponownego losowania' }, { status: 404 })
    }

    const deadlinePassed = new Date(event.vote_deadline) <= now

    // Find all matches for the same day (include finished when after deadline)
    const matchStatuses = deadlinePassed
      ? ['scheduled', 'live', 'finished']
      : ['scheduled', 'live']

    const { data: dayMatches } = await db
      .from('matches')
      .select('id, team_a, team_b')
      .or(`official_match_day.eq.${event.official_match_day},and(official_match_day.is.null,match_date.gte.${event.official_match_day}T00:00:00Z,match_date.lt.${event.official_match_day}T23:59:59Z)`)
      .in('status', matchStatuses)

    if (!dayMatches || dayMatches.length === 0) {
      return NextResponse.json({
        error: 'Brak meczów na ten dzień — nie można losować',
        canReroll: false,
      }, { status: 400 })
    }

    // Pick a random different match; if only one exists, keep the same (just reset votes)
    const otherMatches = dayMatches.filter(m => m.id !== event.match_id)
    const newMatch = otherMatches.length > 0
      ? otherMatches[Math.floor(Math.random() * otherMatches.length)]
      : dayMatches[0]

    const sameMatch = newMatch.id === event.match_id

    // Status: voting if deadline in future, locked if past (will be settled on next recalculate)
    const newStatus = deadlinePassed ? 'locked' : 'voting'

    // Clear all votes for this event
    await db.from('match_of_day_votes').delete().eq('event_id', event.id)

    // Update event with (possibly new) match, reset bonus and status
    const { error: upErr } = await db
      .from('match_of_day_events')
      .update({
        match_id: newMatch.id,
        selected_bonus_points: null,
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', event.id)

    if (upErr) throw upErr

    const matchLabel = `${newMatch.team_a} vs ${newMatch.team_b}`
    const deadlineNote = deadlinePassed ? ' Deadline minął — brak głosowania, bonus = domyślny +2.' : ''

    return NextResponse.json({
      success: true,
      newMatchId: newMatch.id,
      matchLabel,
      previousMatchId: event.match_id,
      sameMatch,
      votesCleared: true,
      deadlinePassed,
      message: `${sameMatch ? 'Mecz bez zmian' : `Wylosowano nowy mecz: ${matchLabel}`}. Głosy wyczyszczone.${deadlineNote}`,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[match-of-day/reroll]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
