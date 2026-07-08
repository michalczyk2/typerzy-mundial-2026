import { createAdminClient } from '@/lib/supabase/admin'

type DbClient = ReturnType<typeof createAdminClient>

// Parses stored placeholder strings (Polish format OR shorthand from API)
// "Lider Gr. A" → {type:'group', position:1, group:'A'}
// "2. miejsce Gr. F" → {type:'group', position:2, group:'F'}
// "F2", "G1" shorthand (group letter first) → {type:'group', position:2, group:'F'} etc.
// "1A", "2B" shorthand (position first) → {type:'group', position:1, group:'A'} etc.
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

// Parses match-reference placeholders:
// "Zwycięzca meczu 73" → {type:'winner', matchNum:73}
// "Przegrany meczu 101" → {type:'loser', matchNum:101}
function parseMatchRefPlaceholder(placeholder: string): { type: 'winner' | 'loser'; matchNum: number } | null {
  const s = placeholder.trim()

  const winnerMatch = s.match(/^Zwyci[eę]zca\s+meczu\s+(\d+)$/i)
  if (winnerMatch) return { type: 'winner', matchNum: parseInt(winnerMatch[1], 10) }

  const loserMatch = s.match(/^Przegrany\s+meczu\s+(\d+)$/i)
  if (loserMatch) return { type: 'loser', matchNum: parseInt(loserMatch[1], 10) }

  return null
}

type TeamSlot = { team_name: string; team_code: string }

// Determines the winner of a finished match: admin-set `winner` field takes priority,
// then score comparison. Returns null if undecided (draw with no winner set).
function resolveWinner(
  match: { winner?: string | null; score_a: number | null; score_b: number | null; team_a: string; team_b: string; team_a_code: string; team_b_code: string }
): TeamSlot | null {
  if (match.winner) {
    // Admin set winner manually (e.g. after penalties)
    const isHome = match.winner === match.team_a
    return isHome
      ? { team_name: match.team_a, team_code: match.team_a_code }
      : { team_name: match.team_b, team_code: match.team_b_code }
  }
  if (match.score_a === null || match.score_b === null) return null
  if (match.score_a > match.score_b) return { team_name: match.team_a, team_code: match.team_a_code }
  if (match.score_b > match.score_a) return { team_name: match.team_b, team_code: match.team_b_code }
  return null // draw without admin-set winner → skip
}

function resolveLoser(
  match: { winner?: string | null; score_a: number | null; score_b: number | null; team_a: string; team_b: string; team_a_code: string; team_b_code: string }
): TeamSlot | null {
  const winner = resolveWinner(match)
  if (!winner) return null
  return winner.team_name === match.team_a
    ? { team_name: match.team_b, team_code: match.team_b_code }
    : { team_name: match.team_a, team_code: match.team_a_code }
}

export async function populateBracketFromStandings(
  db: DbClient
): Promise<{ updated: number; skipped: number; errors: string[] }> {
  // --- Phase 1: fill round_of_32 from group standings ---
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

  // --- Phase 2: fetch all non-archived KO matches ---
  const { data: allKoMatches, error: matchesError } = await db
    .from('matches')
    .select('id, external_id, home_placeholder, away_placeholder, team_a, team_b, team_a_code, team_b_code, status, score_a, score_b, winner, phase')
    .neq('phase', 'group')
    .or('is_archived.is.null,is_archived.eq.false')

  if (matchesError) return { updated: 0, skipped: 0, errors: [matchesError.message] }

  let updated = 0, skipped = 0
  const errors: string[] = []

  // Build winnerMap and loserMap from already-resolved finished matches.
  // Key: match external_id numeric part (e.g. "wc26_73" → key 73)
  // These maps are updated in-memory as we fill matches, enabling cascade.
  const winnerMap = new Map<number, TeamSlot>()
  const loserMap = new Map<number, TeamSlot>()

  // Seed maps from DB matches that are already finished with teams known
  for (const m of allKoMatches ?? []) {
    if (m.status !== 'finished' || !m.team_a || !m.team_b) continue
    const numMatch = m.external_id?.match(/(\d+)$/)
    if (!numMatch) continue
    const matchNum = parseInt(numMatch[1], 10)

    const winner = resolveWinner(m)
    if (winner) {
      winnerMap.set(matchNum, winner)
      loserMap.set(matchNum, resolveLoser(m)!)
    }
  }

  // Process matches sorted by phase order (R32 → R16 → QF → SF → 3rd → F)
  const PHASE_ORDER: Record<string, number> = {
    round_of_32: 1,
    round_of_16: 2,
    quarterfinal: 3,
    semifinal: 4,
    third_place: 5,
    final: 6,
  }

  const sortedMatches = [...(allKoMatches ?? [])].sort(
    (a, b) => (PHASE_ORDER[a.phase] ?? 9) - (PHASE_ORDER[b.phase] ?? 9)
  )

  for (const match of sortedMatches) {
    const updates: Record<string, string> = {}

    // --- Home team slot ---
    if (!match.team_a || !match.team_a_code) {
      const ph = match.home_placeholder ?? ''

      // Try group-position placeholder first (R32 only)
      const groupParsed = ph ? parsePlaceholder(ph) : null
      if (groupParsed && completeGroups.has(groupParsed.group)) {
        const team = standingsMap.get(groupParsed.group)?.get(groupParsed.position)
        if (team) {
          updates.team_a = team.team_name
          updates.team_a_code = team.team_code
        } else {
          errors.push(`Brak standings dla home ${ph} (mecz ${match.id})`)
        }
      }

      // Try match-reference placeholder (R16 and later)
      if (!updates.team_a) {
        const matchRef = ph ? parseMatchRefPlaceholder(ph) : null
        if (matchRef) {
          const slot = matchRef.type === 'winner'
            ? winnerMap.get(matchRef.matchNum)
            : loserMap.get(matchRef.matchNum)
          if (slot) {
            updates.team_a = slot.team_name
            updates.team_a_code = slot.team_code
          }
          // else: source match not yet resolved, skip silently
        }
      }
    }

    // --- Away team slot ---
    if (!match.team_b || !match.team_b_code) {
      const ph = match.away_placeholder ?? ''

      const groupParsed = ph ? parsePlaceholder(ph) : null
      if (groupParsed && completeGroups.has(groupParsed.group)) {
        const team = standingsMap.get(groupParsed.group)?.get(groupParsed.position)
        if (team) {
          updates.team_b = team.team_name
          updates.team_b_code = team.team_code
        } else {
          errors.push(`Brak standings dla away ${ph} (mecz ${match.id})`)
        }
      }

      if (!updates.team_b) {
        const matchRef = ph ? parseMatchRefPlaceholder(ph) : null
        if (matchRef) {
          const slot = matchRef.type === 'winner'
            ? winnerMap.get(matchRef.matchNum)
            : loserMap.get(matchRef.matchNum)
          if (slot) {
            updates.team_b = slot.team_name
            updates.team_b_code = slot.team_code
          }
        }
      }
    }

    if (Object.keys(updates).length === 0) { skipped++; continue }

    const { error: updateError } = await db.from('matches').update(updates).eq('id', match.id)
    if (updateError) {
      errors.push(`Błąd meczu ${match.id}: ${updateError.message}`)
      continue
    }
    updated++

    // Update in-memory cache for cascade: if this match is finished and now has both teams,
    // resolve winner/loser so subsequent matches in this same pass can pick them up
    const resolvedA = updates.team_a ?? match.team_a
    const resolvedB = updates.team_b ?? match.team_b
    const resolvedACode = updates.team_a_code ?? match.team_a_code
    const resolvedBCode = updates.team_b_code ?? match.team_b_code

    if (match.status === 'finished' && resolvedA && resolvedB) {
      const numMatch = match.external_id?.match(/(\d+)$/)
      if (numMatch && !winnerMap.has(parseInt(numMatch[1], 10))) {
        const matchNum = parseInt(numMatch[1], 10)
        const enriched = {
          ...match,
          team_a: resolvedA,
          team_b: resolvedB,
          team_a_code: resolvedACode,
          team_b_code: resolvedBCode,
        }
        const w = resolveWinner(enriched)
        const l = resolveLoser(enriched)
        if (w) { winnerMap.set(matchNum, w); if (l) loserMap.set(matchNum, l) }
      }
    }
  }

  return { updated, skipped, errors }
}
