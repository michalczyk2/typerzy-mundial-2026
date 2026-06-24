import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

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

function parsePlaceholder(placeholder: string): { position: number; group: string } | null {
  const leaderMatch = placeholder.match(/^Lider\s+Gr\.\s*([A-Z])\s*$/i)
  if (leaderMatch) return { position: 1, group: leaderMatch[1].toUpperCase() }
  const placeMatch = placeholder.match(/^(\d+)\.\s*miejsce\s+Gr\.\s*([A-Z])\s*$/i)
  if (placeMatch) return { position: parseInt(placeMatch[1], 10), group: placeMatch[2].toUpperCase() }
  return null
}

export async function POST(req: NextRequest) {
  if (!await isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const db = createAdminClient()
  const { data: standings, error: standingsError } = await db
    .from('standings')
    .select('group_name, position, team_name, team_code')
  if (standingsError) return NextResponse.json({ error: standingsError.message }, { status: 500 })

  const standingsMap = new Map<string, Map<number, { team_name: string; team_code: string }>>()
  for (const row of standings ?? []) {
    if (!standingsMap.has(row.group_name)) standingsMap.set(row.group_name, new Map())
    standingsMap.get(row.group_name)!.set(row.position, { team_name: row.team_name, team_code: row.team_code })
  }

  const completeGroups = new Set<string>()
  for (const [group, positions] of standingsMap.entries()) {
    if ([1, 2, 3, 4].every(p => positions.has(p))) completeGroups.add(group)
  }

  const { data: matches, error: matchesError } = await db
    .from('matches')
    .select('id, home_placeholder, away_placeholder, team_a, team_b, team_a_code, team_b_code')
    .eq('phase', 'round_of_32')
  if (matchesError) return NextResponse.json({ error: matchesError.message }, { status: 500 })

  let updated = 0, skipped = 0
  const errors: string[] = []

  for (const match of matches ?? []) {
    if (match.team_a && match.team_b && match.team_a_code && match.team_b_code) { skipped++; continue }
    const homeParsed = match.home_placeholder ? parsePlaceholder(match.home_placeholder) : null
    const awayParsed = match.away_placeholder ? parsePlaceholder(match.away_placeholder) : null
    if (!homeParsed || !awayParsed) { skipped++; continue }
    if (!completeGroups.has(homeParsed.group) || !completeGroups.has(awayParsed.group)) { skipped++; continue }
    const homeTeam = standingsMap.get(homeParsed.group)?.get(homeParsed.position)
    const awayTeam = standingsMap.get(awayParsed.group)?.get(awayParsed.position)
    if (!homeTeam || !awayTeam) {
      errors.push(`Brak standings dla meczu ${match.id}: ${match.home_placeholder} / ${match.away_placeholder}`)
      continue
    }
    const { error: updateError } = await db
      .from('matches')
      .update({ team_a: homeTeam.team_name, team_a_code: homeTeam.team_code, team_b: awayTeam.team_name, team_b_code: awayTeam.team_code })
      .eq('id', match.id)
    if (updateError) errors.push(`Błąd meczu ${match.id}: ${updateError.message}`)
    else updated++
  }

  const message = updated > 0
    ? `Uzupełniono ${updated} meczów KO${skipped > 0 ? `, pominięto ${skipped}` : ''}.`
    : skipped > 0
      ? `Brak meczów do uzupełnienia — pominięto ${skipped} (grupy niegotowe lub mecze już wypełnione).`
      : 'Brak meczów round_of_32 w bazie.'

  return NextResponse.json({ message, updated, skipped, errors })
}

export async function GET(req: NextRequest) { return POST(req) }
