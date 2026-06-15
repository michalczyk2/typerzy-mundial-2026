import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { IS_PRODUCTION_MODE } from '@/lib/tournament-config'

// POST /api/match-of-day/vote
// Body: { event_id: string, bonus_points: 1 | 2 | 3 | 4 }
// Auth: active player session cookie (typerzy_session)
export async function POST(req: NextRequest) {
  if (!IS_PRODUCTION_MODE) {
    return NextResponse.json({ error: 'Tylko w trybie produkcyjnym' }, { status: 400 })
  }

  const sessionId = req.cookies.get('typerzy_session')?.value
  if (!sessionId) {
    return NextResponse.json({ error: 'Nie zalogowany' }, { status: 401 })
  }

  try {
    const db = createAdminClient()

    const { data: profile } = await db
      .from('profiles')
      .select('id, status')
      .eq('id', sessionId)
      .single()

    if (!profile || profile.status !== 'active') {
      return NextResponse.json({ error: 'Brak uprawnień do głosowania' }, { status: 403 })
    }

    const body = await req.json()
    const { event_id, bonus_points } = body

    if (!event_id || ![1, 2, 3, 4].includes(bonus_points)) {
      return NextResponse.json({ error: 'Nieprawidłowe dane' }, { status: 400 })
    }

    // Verify event exists and voting is still open
    const { data: event } = await db
      .from('match_of_day_events')
      .select('id, vote_deadline, status')
      .eq('id', event_id)
      .single()

    if (!event) {
      return NextResponse.json({ error: 'Event nie istnieje' }, { status: 404 })
    }
    if (event.status === 'settled') {
      return NextResponse.json({ error: 'Głosowanie zostało już zamknięte' }, { status: 400 })
    }
    if (new Date(event.vote_deadline) <= new Date()) {
      return NextResponse.json({ error: 'Czas głosowania minął' }, { status: 400 })
    }

    // Upsert vote (create or update existing vote)
    const { error } = await db
      .from('match_of_day_votes')
      .upsert(
        {
          event_id: event.id,
          user_id: profile.id,
          bonus_points: bonus_points as number,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'event_id,user_id' }
      )

    if (error) throw error

    return NextResponse.json({ message: 'Głos zapisany', bonus_points })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[match-of-day/vote]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
