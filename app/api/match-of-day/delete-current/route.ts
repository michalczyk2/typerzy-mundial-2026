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

// POST /api/match-of-day/delete-current
// Admin-only. Deletes the current/next match-of-day event and all its votes.
// Does NOT touch matches, predictions, or profile points.
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

    // Find the nearest upcoming or today's event
    const { data: event } = await db
      .from('match_of_day_events')
      .select('id, official_match_day, status')
      .gte('official_match_day', todayUtc)
      .order('official_match_day', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (!event) {
      return NextResponse.json({ error: 'Brak aktywnego meczu dnia' }, { status: 404 })
    }

    const wasSettled = event.status === 'settled'

    // Delete votes first (explicit, in case cascade is not set)
    await db.from('match_of_day_votes').delete().eq('event_id', event.id)

    // Delete the event
    const { error: delErr } = await db
      .from('match_of_day_events')
      .delete()
      .eq('id', event.id)

    if (delErr) throw delErr

    const baseMsg = `Usunięto mecz dnia dla ${event.official_match_day}.`
    const settledMsg = wasSettled ? ' ⚠️ Był już rozliczony — kliknij Przelicz punkty od nowa!' : ''

    return NextResponse.json({
      success: true,
      deletedDay: event.official_match_day,
      wasSettled,
      recalculateNeeded: wasSettled,
      message: baseMsg + settledMsg,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[match-of-day/delete-current]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
