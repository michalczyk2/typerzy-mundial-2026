import { createAdminClient } from '@/lib/supabase/admin'

type DbClient = ReturnType<typeof createAdminClient>

// Parses stored placeholder strings (Polish format OR shorthand from API)
// "Lider Gr. A" → {position:1, group:'A'}
// "2. miejsce Gr. F" → {position:2, group:'F'}
// "F2", "G1" shorthand (group letter first) → {position:2, group:'F'} etc.
// "1A", "2B" shorthand (position first) → {position:1, group:'A'} etc.
function parsePlaceholder(placeholder: string): { position: number; group: string } | null {
  const s = placeholder.trim()

  // Polish: "Lider Gr. A"
  const leaderMatch = s.match(/^Lider\s+Gr\.\s*([A-Z])\s*$/i)
  if (leaderMatch) return { position: 1, group: leaderMatch[1].toUpperCase() }

  // Polish: "2. miejsce Gr. F"
  const placeMatch = s.match(/^(\d+)\.\s*miejsce\s+Gr\.\s*([A-Z])\s*$/i)
  if (placeMatch) return { position: parseInt(placeMatch[1], 10), group: placeMatch[2].toUpperCase() }

  // Shorthand group-first: "F2", "G1", "A3"
  const groupFirstMatch = s.match(/^([A-Z])([1-4])$/i)
  if (groupFirstMatch) return { position: parseInt(groupFirstMatch[2]), group: groupFirstMatch[1].toUpperCase() }

  // Shorthand position-first: "1A", "2B"
  const posFirstMatch = s.match(/^([1-4])([A-Z])$/i)
  if (posFirstMatch) return { position: parseInt(posFirstMatch[1]), group: posFirstMatch[2].toUpperCase() }

  return null
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
    // Fill each team slot independently — don't wait for both groups to be complete
    const updates: Record<string, string> = {}

    if (!match.team_a || !match.team_a_code) {
      const parsed = match.home_placeholder ? parsePlaceholder(match.home_placeholder) : null
      if (parsed && completeGroups.has(parsed.group)) {
        const team = standingsMap.get(parsed.group)?.get(parsed.position)
        if (team) {
          updates.team_a = team.team_name
          updates.team_a_code = team.team_code
        } else {
          errors.push(`Brak standings dla home ${match.home_placeholder} (mecz ${match.id})`)
        }
      }
    }

    if (!match.team_b || !match.team_b_code) {
      const parsed = match.away_placeholder ? parsePlaceholder(match.away_placeholder) : null
      if (parsed && completeGroups.has(parsed.group)) {
        const team = standingsMap.get(parsed.group)?.get(parsed.position)
        if (team) {
          updates.team_b = team.team_name
          updates.team_b_code = team.team_code
        } else {
          errors.push(`Brak standings dla away ${match.away_placeholder} (mecz ${match.id})`)
        }
      }
    }

    if (Object.keys(updates).length === 0) { skipped++; continue }

    const { error: updateError } = await db.from('matches').update(updates).eq('id', match.id)
    if (updateError) errors.push(`Błąd meczu ${match.id}: ${updateError.message}`)
    else updated++
  }

  return { updated, skipped, errors }
}
