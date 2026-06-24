import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchWC26Fixtures } from '@/lib/api/football-provider'

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

// Parse placeholder strings from worldcup26.ir API into Polish format
// "Winner Group A" → "Lider Gr. A", "Runner-up Group B" → "2. miejsce Gr. B"
// "1A", "2B" shorthand also supported
function parseApiPlaceholder(name: string): string | null {
  const n = name.trim()

  const winnerMatch = n.match(/^Winner(?:\s+of)?\s+Group\s+([A-Z])\b/i)
  if (winnerMatch) return `Lider Gr. ${winnerMatch[1].toUpperCase()}`

  const runnerMatch = n.match(/^(?:Runner-?up(?:\s+of)?\s+Group\s+([A-Z])|2nd\s+Group\s+([A-Z]))\b/i)
  if (runnerMatch) return `2. miejsce Gr. ${(runnerMatch[1] ?? runnerMatch[2]).toUpperCase()}`

  const thirdMatch = n.match(/^(?:3rd|Third)(?:\s+of)?\s+Group\s+([A-Z])\b/i)
  if (thirdMatch) return `3. miejsce Gr. ${thirdMatch[1].toUpperCase()}`

  const fourthMatch = n.match(/^(?:4th|Fourth)(?:\s+of)?\s+Group\s+([A-Z])\b/i)
  if (fourthMatch) return `4. miejsce Gr. ${fourthMatch[1].toUpperCase()}`

  // Shorthand "1A", "2B", "3C"
  const shortMatch = n.match(/^([1-4])([A-Z])$/i)
  if (shortMatch) {
    const pos = parseInt(shortMatch[1])
    const grp = shortMatch[2].toUpperCase()
    return pos === 1 ? `Lider Gr. ${grp}` : `${pos}. miejsce Gr. ${grp}`
  }

  return null
}

// Detect API placeholder strings that represent unknown teams ("W73", "1A", "Runner-up…")
function isPlaceholderName(name: string): boolean {
  if (parseApiPlaceholder(name) !== null) return true
  const n = name.trim()
  if (/^[Ww]\d+$/.test(n)) return true  // "W73"
  if (n.length < 3) return true
  return false
}

export async function POST(req: NextRequest) {
  if (!await isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const fixtures = await fetchWC26Fixtures({ timeoutMs: 30_000 })
  if (!fixtures) {
    return NextResponse.json({ error: 'Nie udało się pobrać danych z worldcup26.ir' }, { status: 503 })
  }

  const koFixtures = fixtures.filter(f => f.phase !== 'group')
  if (koFixtures.length === 0) {
    return NextResponse.json({ message: 'API nie zwróciło jeszcze meczów fazy KO.', seeded: 0 })
  }

  const db = createAdminClient()
  let seeded = 0
  const errors: string[] = []

  for (const f of koFixtures) {
    const homePlaceholder = parseApiPlaceholder(f.team_a)
    const awayPlaceholder = parseApiPlaceholder(f.team_b)
    const homeIsPlaceholder = isPlaceholderName(f.team_a)
    const awayIsPlaceholder = isPlaceholderName(f.team_b)

    const matchRow: Record<string, unknown> = {
      external_id: f.external_id,
      team_a: homeIsPlaceholder ? '' : f.team_a,
      team_b: awayIsPlaceholder ? '' : f.team_b,
      team_a_code: homeIsPlaceholder ? '' : f.team_a_code,
      team_b_code: awayIsPlaceholder ? '' : f.team_b_code,
      match_date: f.match_date,
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
      data_source: 'api',
    }

    if (homePlaceholder) matchRow.home_placeholder = homePlaceholder
    if (awayPlaceholder) matchRow.away_placeholder = awayPlaceholder

    const { error } = await db
      .from('matches')
      .upsert(matchRow, { onConflict: 'external_id' })

    if (error) errors.push(`${f.external_id}: ${error.message}`)
    else seeded++
  }

  const message = seeded > 0
    ? `Zaseedowano/zaktualizowano ${seeded} meczów KO z API.`
    : 'Brak nowych meczów KO do zaseedowania.'

  return NextResponse.json({ message, seeded, errors })
}

export async function GET(req: NextRequest) { return POST(req) }
