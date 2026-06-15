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

// Finds the next uncovered tournament day and creates a match-of-day event.
// Idempotent: calling multiple times will not create duplicate events.
export async function POST(req: NextRequest) {
  if (!await isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!IS_PRODUCTION_MODE) {
    return NextResponse.json({ message: 'Tryb lokalny — brak akcji', created: false })
  }

  try {
    const db = createAdminClient()
    const todayUtc = new Date().toISOString().slice(0, 10)

    // Get official_match_days that already have events
    const { data: existingEvents } = await db
      .from('match_of_day_events')
      .select('official_match_day')
      .gte('official_match_day', todayUtc)

    const coveredDays = new Set((existingEvents ?? []).map(e => e.official_match_day as string))

    // Find upcoming/live matches grouped by official_match_day
    // Fallback: if official_match_day is null, compute from UTC match_date
    const { data: upcomingMatches } = await db
      .from('matches')
      .select('id, official_match_day, match_date')
      .in('status', ['scheduled', 'live'])
      .neq('is_archived', true)
      .like('external_id', 'wc26_%')
      .order('match_date', { ascending: true })

    if (!upcomingMatches || upcomingMatches.length === 0) {
      return NextResponse.json({ message: 'Brak nadchodzących meczów', created: false })
    }

    // Group by effective match day (official_match_day or UTC date fallback)
    const byDay = new Map<string, { id: string; match_date: string }[]>()
    for (const m of upcomingMatches) {
      const day: string = (m.official_match_day as string | null)
        ?? new Date(m.match_date).toISOString().slice(0, 10)
      if (!byDay.has(day)) byDay.set(day, [])
      byDay.get(day)!.push({ id: m.id, match_date: m.match_date })
    }

    // Sort days ascending
    const sortedDays = [...byDay.keys()].sort()

    // Find first day that isn't already covered and has a date >= today
    let targetDay: string | null = null
    let targetMatches: { id: string; match_date: string }[] = []
    for (const day of sortedDays) {
      if (day >= todayUtc && !coveredDays.has(day)) {
        targetDay = day
        targetMatches = byDay.get(day)!
        break
      }
    }

    if (!targetDay) {
      return NextResponse.json({ message: 'Wszystkie nadchodzące dni mają już mecz dnia', created: false })
    }

    // Sort target matches by match_date to find the earliest (vote deadline)
    targetMatches.sort((a, b) => a.match_date.localeCompare(b.match_date))
    const voteDeadline = targetMatches[0].match_date

    // Pick a random match from the day
    const randomMatch = targetMatches[Math.floor(Math.random() * targetMatches.length)]

    const { data: event, error } = await db
      .from('match_of_day_events')
      .insert({
        official_match_day: targetDay,
        match_id: randomMatch.id,
        vote_deadline: voteDeadline,
        status: 'voting',
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      message: `Mecz dnia utworzony dla ${targetDay}`,
      event,
      created: true,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[match-of-day/ensure]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  return POST(req)
}
