import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
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

// Finalizes match-of-day events whose vote_deadline has passed.
// Counts votes, resolves ties (lower bonus wins), defaults to +2 with no votes.
// Idempotent: already-settled events are skipped.
export async function POST(req: NextRequest) {
  if (!await isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!IS_PRODUCTION_MODE) {
    return NextResponse.json({ message: 'Tryb lokalny — brak akcji', finalized: 0 })
  }

  try {
    const db = createAdminClient()
    const now = new Date().toISOString()

    // Find events past their deadline that aren't settled yet
    const { data: events, error: evErr } = await db
      .from('match_of_day_events')
      .select('id, vote_deadline, status')
      .in('status', ['voting', 'locked'])
      .lt('vote_deadline', now)

    if (evErr) throw evErr
    if (!events || events.length === 0) {
      return NextResponse.json({ message: 'Brak eventów do finalizacji', finalized: 0 })
    }

    let finalized = 0
    for (const event of events) {
      const { data: votes } = await db
        .from('match_of_day_votes')
        .select('bonus_points')
        .eq('event_id', event.id)

      const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
      for (const v of votes ?? []) {
        counts[v.bonus_points as number] = (counts[v.bonus_points as number] ?? 0) + 1
      }

      const totalVotes = Object.values(counts).reduce((a, b) => a + b, 0)
      let selectedBonus = 2 // default when no votes

      if (totalVotes > 0) {
        const maxVotes = Math.max(...Object.values(counts))
        // All options with max votes — pick the smallest (lower bonus wins tie)
        const tied = ([4, 3, 2, 1] as const).filter(b => counts[b] === maxVotes)
        selectedBonus = tied[tied.length - 1]
      }

      const { error: upErr } = await db
        .from('match_of_day_events')
        .update({
          selected_bonus_points: selectedBonus,
          status: 'settled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', event.id)

      if (!upErr) finalized++
      else console.error('[match-of-day/finalize] update failed', event.id, upErr)
    }

    return NextResponse.json({ message: `Sfinalizowano ${finalized} eventów`, finalized })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[match-of-day/finalize]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  return POST(req)
}
