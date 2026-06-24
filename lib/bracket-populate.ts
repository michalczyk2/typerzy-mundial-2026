import { createAdminClient } from '@/lib/supabase/admin'

type DbClient = ReturnType<typeof createAdminClient>

function parsePlaceholder(placeholder: string): { position: number; group: string } | null {
  const leaderMatch = placeholder.match(/^Lider\s+Gr\.\s*([A-Z])\s*$/i)
  if (leaderMatch) return { position: 1, group: leaderMatch[1].toUpperCase() }
  const placeMatch = placeholder.match(/^(\d+)\.\s*miejsce\s+Gr\.\s*([A-Z])\s*$/i)
  if (placeMatch) return { position: parseInt(placeMatch[1], 10), group: placeMatch[2].toUpperCase() }
  return null
}

function sortByDateAndId<T extends { match_date: string; id: string }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => {
    const d = new Date(a.match_date).getTime() - new Date(b.match_date).getTime()
    return d !== 0 ? d : a.id.localeCompare(b.id)
  })
}

export async function populateBracketFromStandings(
  db: DbClient
): Promise<{ updated: number; skipped: number; errors: string[] }> {
  const { data: standings, error: standingsError } = await db
    .from('standings')
    .select('group_name, position, team_name, team_code')
  if (standingsError) return { updated: 0, skipped: 0, errors: [standingsError.message] }

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
    .or('is_archived.is.null,is_archived.eq.false')
  if (matchesError) return { updated: 0, skipped: 0, errors: [matchesError.message] }

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

  return { updated, skipped, errors }
}

const KO_PHASES = ['round_of_32', 'round_of_16', 'quarterfinal', 'semifinal'] as const
const NEXT_PHASE: Record<string, string> = {
  round_of_32: 'round_of_16',
  round_of_16: 'quarterfinal',
  quarterfinal: 'semifinal',
  semifinal: 'final',
}

export async function advanceBracketWinners(
  db: DbClient
): Promise<{ advanced: number; errors: string[] }> {
  const allPhases = [...KO_PHASES, 'final']

  const { data: allMatches, error } = await db
    .from('matches')
    .select('id, phase, match_date, team_a, team_b, team_a_code, team_b_code, score_a, score_b, status')
    .in('phase', allPhases)
    .or('is_archived.is.null,is_archived.eq.false')
  if (error) return { advanced: 0, errors: [error.message] }

  const byPhase = new Map<string, NonNullable<typeof allMatches>>()
  for (const phase of allPhases) {
    byPhase.set(phase, sortByDateAndId((allMatches ?? []).filter(m => m.phase === phase)))
  }

  let advanced = 0
  const errors: string[] = []

  for (const phase of KO_PHASES) {
    const phaseMatches = byPhase.get(phase) ?? []
    const nextPhase = NEXT_PHASE[phase]
    const nextMatches = byPhase.get(nextPhase) ?? []

    for (let i = 0; i < phaseMatches.length; i++) {
      const m = phaseMatches[i]
      if (m.status !== 'finished') continue
      if (m.score_a == null || m.score_b == null) continue
      if (m.score_a === m.score_b) continue

      const winnerName = m.score_a > m.score_b ? m.team_a : m.team_b
      const winnerCode = m.score_a > m.score_b ? m.team_a_code : m.team_b_code
      if (!winnerName || !winnerCode) continue

      const targetIndex = Math.floor(i / 2)
      const target = nextMatches[targetIndex]
      if (!target) continue

      const isHome = i % 2 === 0
      if (isHome && target.team_a) continue
      if (!isHome && target.team_b) continue

      const update = isHome
        ? { team_a: winnerName, team_a_code: winnerCode }
        : { team_b: winnerName, team_b_code: winnerCode }

      const { error: updateError } = await db
        .from('matches')
        .update(update)
        .eq('id', target.id)
      if (updateError) errors.push(`Błąd awansu do ${nextPhase}[${targetIndex}]: ${updateError.message}`)
      else advanced++
    }
  }

  return { advanced, errors }
}
