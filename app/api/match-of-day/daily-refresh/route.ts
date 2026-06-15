import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { IS_PRODUCTION_MODE } from '@/lib/tournament-config'
import { fetchFixtures } from '@/lib/api/football-provider'

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

// POST /api/match-of-day/daily-refresh
// 1. Syncs matches from football provider (populates official_match_day)
// 2. Ensures a match-of-day event exists for the next upcoming tournament day
// Idempotent — safe to run multiple times per day.
export async function POST(req: NextRequest) {
  if (!await isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!IS_PRODUCTION_MODE) {
    return NextResponse.json({ message: 'Tryb lokalny — brak akcji', matchesSynced: 0, modCreated: false })
  }

  const db = createAdminClient()

  // ── Step 1: sync matches ───────────────────────────────────────────────────
  let matchesSynced = 0
  let matchSyncError: string | null = null
  try {
    const fixtures = await fetchFixtures()
    const rows = fixtures.map(f => ({
      external_id: f.external_id,
      team_a: f.team_a,
      team_b: f.team_b,
      team_a_code: f.team_a_code,
      team_b_code: f.team_b_code,
      match_date: f.match_date,
      official_match_day: f.official_match_day,
      status: f.status,
      score_a: f.score_a,
      score_b: f.score_b,
      halftime_a: f.halftime_a,
      halftime_b: f.halftime_b,
      phase: f.phase,
      group_name: f.group_name,
      round: f.round,
      stadium: f.stadium,
      city: f.city,
      data_source: 'api' as const,
    }))
    const { error } = await db.from('matches').upsert(rows, { onConflict: 'external_id' })
    if (error) throw error
    matchesSynced = rows.length
  } catch (err) {
    matchSyncError = err instanceof Error ? err.message : String(err)
    console.error('[daily-refresh] match sync failed:', matchSyncError)
  }

  // ── Step 2: ensure match of day ────────────────────────────────────────────
  const todayUtc = new Date().toISOString().slice(0, 10)

  const { data: existingEvents } = await db
    .from('match_of_day_events')
    .select('official_match_day')
    .gte('official_match_day', todayUtc)

  const coveredDays = new Set((existingEvents ?? []).map(e => e.official_match_day as string))

  const { data: upcomingMatches } = await db
    .from('matches')
    .select('id, official_match_day, match_date')
    .in('status', ['scheduled', 'live'])
    .order('match_date', { ascending: true })

  // Group by effective match day
  const byDay = new Map<string, { id: string; match_date: string }[]>()
  for (const m of upcomingMatches ?? []) {
    const day: string = (m.official_match_day as string | null)
      ?? new Date(m.match_date).toISOString().slice(0, 10)
    if (!byDay.has(day)) byDay.set(day, [])
    byDay.get(day)!.push({ id: m.id, match_date: m.match_date })
  }

  const sortedDays = [...byDay.keys()].sort()
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
    const coveredUpcoming = sortedDays.filter(d => d >= todayUtc && coveredDays.has(d))
    return NextResponse.json({
      matchesSynced,
      matchSyncError,
      modCreated: false,
      modAlreadyExisted: coveredUpcoming.length > 0,
      modMatchId: null,
      modDay: coveredUpcoming[0] ?? null,
      message: coveredUpcoming.length > 0
        ? `Mecze odświeżone. Mecz dnia już istniał dla ${coveredUpcoming[0]}.`
        : 'Mecze odświeżone. Brak nadchodzących meczów do przypisania.',
    })
  }

  targetMatches.sort((a, b) => a.match_date.localeCompare(b.match_date))
  const voteDeadline = targetMatches[0].match_date
  const randomMatch = targetMatches[Math.floor(Math.random() * targetMatches.length)]

  const { data: event, error: evErr } = await db
    .from('match_of_day_events')
    .insert({
      official_match_day: targetDay,
      match_id: randomMatch.id,
      vote_deadline: voteDeadline,
      status: 'voting',
    })
    .select()
    .single()

  if (evErr) {
    // Could be a race condition duplicate; report as already existed
    if (evErr.code === '23505') {
      return NextResponse.json({
        matchesSynced,
        matchSyncError,
        modCreated: false,
        modAlreadyExisted: true,
        modMatchId: null,
        modDay: targetDay,
        message: `Mecze odświeżone. Mecz dnia już istniał dla ${targetDay}.`,
      })
    }
    throw evErr
  }

  // Fetch match details for response
  const { data: matchDetails } = await db
    .from('matches')
    .select('team_a, team_b')
    .eq('id', randomMatch.id)
    .single()

  const matchLabel = matchDetails ? `${matchDetails.team_a} vs ${matchDetails.team_b}` : randomMatch.id

  return NextResponse.json({
    matchesSynced,
    matchSyncError,
    modCreated: true,
    modAlreadyExisted: false,
    modMatchId: randomMatch.id,
    modDay: targetDay,
    matchLabel,
    matchCount: targetMatches.length,
    message: `Mecze odświeżone (${matchesSynced}). Mecz dnia dla ${targetDay}: ${matchLabel}.`,
    event,
  })
}

export async function GET(req: NextRequest) {
  return POST(req)
}
