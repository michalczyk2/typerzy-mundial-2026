import type { Match, MatchPhase } from '@/types'

// Fixed shape of a 32-team single-elimination bracket (WC26 format: 12 groups,
// top 2 + 8 best 3rd-placed teams = 32 teams enter the knockout stage).
// This is tournament-format math (slot COUNT per round), never a guess about
// which teams occupy a slot — slot contents always come from real Match rows.
export const BRACKET_ROUNDS: MatchPhase[] = ['round_of_32', 'round_of_16', 'quarterfinal', 'semifinal', 'final']

export const BRACKET_ROUND_LABEL: Record<string, string> = {
  round_of_32: '1/16 finału',
  round_of_16: '1/8 finału',
  quarterfinal: 'Ćwierćfinał',
  semifinal: 'Półfinał',
  final: 'Finał',
}

const HALF_BASE = 8 // round_of_32 matches per half (16 total / 2)

export type SlotStatus = 'confirmed' | 'pending' | 'unknown'

export interface BracketSlot {
  roundIndex: number // 0=round_of_32 .. 3=semifinal
  indexInRound: number // 0-based within the half
  match: Match | null
  status: SlotStatus
}

export interface BracketHalf {
  rounds: BracketSlot[][] // [round_of_32 (8), round_of_16 (4), quarterfinal (2), semifinal (1)]
}

export interface BracketData {
  left: BracketHalf
  right: BracketHalf
  final: { match: Match | null; status: SlotStatus }
  thirdPlace: { match: Match | null; status: SlotStatus }
  confirmedRoundOf32: number // how many of the 32 starting team-slots have a real team name
}

function sortMatches(matches: Match[]): Match[] {
  return [...matches].sort((a, b) => {
    const d = new Date(a.match_date).getTime() - new Date(b.match_date).getTime()
    if (d !== 0) return d
    return a.id.localeCompare(b.id)
  })
}

function slotStatus(match: Match | null): SlotStatus {
  if (!match) return 'unknown'
  if (match.team_a && match.team_b) return 'confirmed'
  return 'pending'
}

interface Positioned {
  match: Match
  half: 0 | 1
  indexInRound: number
}

// "wc26_<id>" -> id, the API's own match number (only wc26_* is ever active —
// archived legacy ofb_* rows never reach the bracket).
function externalMatchNumber(externalId: string | null | undefined): number | null {
  if (!externalId) return null
  const m = externalId.match(/^wc26_(\d+)$/)
  return m ? parseInt(m[1], 10) : null
}

// "Zwycięzca meczu 73" -> 73 (placeholder text written by seed-ko-brackets; the
// number is the previous round's API match number == its external_id suffix).
function placeholderMatchNumber(text: string | null | undefined): number | null {
  if (!text) return null
  const m = text.trim().match(/(\d+)\s*$/)
  return m ? parseInt(m[1], 10) : null
}

function findParentByPlaceholderOrName(
  teamName: string | null | undefined,
  placeholder: string | null | undefined,
  byExternalId: Map<number, Match>,
  candidates: Match[]
): Match | null {
  const num = placeholderMatchNumber(placeholder)
  if (num !== null) {
    const byNumber = byExternalId.get(num)
    if (byNumber) return byNumber
  }
  if (teamName) return candidates.find(c => c.team_a === teamName || c.team_b === teamName) ?? null
  return null
}

// Finds a match's two true parents in `candidates` by identity (placeholder
// match-number -> external_id, falling back to team-name) — the same
// resolution `positionNextRound` uses below, just run in the opposite
// direction (parent lookup by identity, not position inheritance) so
// round_of_32 can be grouped into sibling pairs before any visual slot is
// assigned.
function findGenealogyParents(child: Match, candidates: Match[]): [Match | null, Match | null] {
  const byExternalId = new Map<number, Match>()
  for (const c of candidates) {
    const num = externalMatchNumber(c.external_id)
    if (num !== null) byExternalId.set(num, c)
  }
  const parentA = findParentByPlaceholderOrName(child.team_a, child.home_placeholder, byExternalId, candidates)
  let parentB = findParentByPlaceholderOrName(child.team_b, child.away_placeholder, byExternalId, candidates)
  if (parentB && parentA && parentB.id === parentA.id) parentB = null
  return [parentA, parentB]
}

// Official WC26 round_of_32 schedule — which match feeds which round_of_16
// slot is fixed by FIFA before kickoff (same kind of structural tournament
// data as HALF_BASE/BRACKET_ROUNDS above, not a guessed outcome). Keyed by
// the API's own match number (external_id `wc26_<N>`), the same number
// round_of_16's "Zwycięzca meczu N" placeholders already reference — stable
// across syncs, unlike team names which can vary in spelling/locale.
// First 8 = left half (4 sibling pairs: indices 0-1, 2-3, 4-5, 6-7), next 8
// = right half. Source: official WC26 bracket, cross-checked against real
// round_of_32 rows on 2026-06-30 (South Africa-Canada/Netherlands-Morocco,
// Germany-Paraguay/France-Sweden, Brazil-Japan/Ivory Coast-Norway,
// Mexico-Ecuador/England-DR Congo, Portugal-Croatia/Spain-Austria,
// USA-Bosnia and Herzegovina/Belgium-Senegal, Argentina-Cape Verde/
// Australia-Egypt, Switzerland-Algeria/Colombia-Ghana).
const CANONICAL_ROUND_OF_32_ORDER = [
  73, 75, 74, 77, 76, 78, 79, 80,
  83, 84, 81, 82, 86, 88, 85, 87,
]

// Orders matches the canonical list doesn't cover (not yet seeded with a
// recognized external_id, or — should the list ever be wrong/incomplete —
// any mismatch) by grouping into round_of_16-derived sibling pairs first,
// falling back to kickoff order. Without the pairing step, two round_of_32
// matches feeding the same round_of_16 match could land at non-adjacent
// slots, which breaks BracketCanvas's connector geometry (it always draws
// from slots 2m/2m+1 up to parent slot m).
function orderByGenealogyThenDate(matches: Match[], nextRoundMatches: Match[]): Match[] {
  const groupOf = new Map<string, number>()
  let nextGroupKey = 0
  for (const child of nextRoundMatches) {
    const [a, b] = findGenealogyParents(child, matches)
    if (!a && !b) continue
    const key = nextGroupKey++
    if (a) groupOf.set(a.id, key)
    if (b) groupOf.set(b.id, key)
  }

  const groups = new Map<number, Match[]>()
  let nextSingletonKey = -1
  for (const m of matches) {
    const key = groupOf.get(m.id) ?? nextSingletonKey--
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(m)
  }

  return Array.from(groups.values())
    .map(sortMatches)
    .sort((g1, g2) => {
      const d = new Date(g1[0].match_date).getTime() - new Date(g2[0].match_date).getTime()
      if (d !== 0) return d
      return g1[0].id.localeCompare(g2[0].id)
    })
    .flat()
}

// Round 0 (round_of_32): visual order comes from CANONICAL_ROUND_OF_32_ORDER
// (the fixed tournament schedule), matched by external_id match number. Any
// match not found there — logged, never silently guessed — falls back to
// round_of_16 genealogy grouping (see orderByGenealogyThenDate) for
// whatever slots the canonical matches didn't claim.
function positionRoundOf32(matches: Match[], nextRoundMatches: Match[]): Positioned[] {
  const canonicalSlot = new Map<number, number>()
  CANONICAL_ROUND_OF_32_ORDER.forEach((num, i) => canonicalSlot.set(num, i))

  const positioned: Positioned[] = []
  const unrecognized: Match[] = []
  const usedSlots = new Set<string>()

  for (const match of matches) {
    const num = externalMatchNumber(match.external_id)
    const slot = num !== null ? canonicalSlot.get(num) : undefined
    if (slot === undefined) { unrecognized.push(match); continue }
    const half = (slot < HALF_BASE ? 0 : 1) as 0 | 1
    const indexInRound = slot < HALF_BASE ? slot : slot - HALF_BASE
    positioned.push({ match, half, indexInRound })
    usedSlots.add(`${half}-${indexInRound}`)
  }

  if (unrecognized.length > 0) {
    console.warn(
      '[bracket] round_of_32 match(es) not in CANONICAL_ROUND_OF_32_ORDER, falling back to genealogy/date order:',
      unrecognized.map(m => m.external_id ?? m.id).join(', ')
    )
    const openSlots: Array<{ half: 0 | 1; indexInRound: number }> = []
    for (const half of [0, 1] as const) {
      for (let i = 0; i < HALF_BASE; i++) {
        if (!usedSlots.has(`${half}-${i}`)) openSlots.push({ half, indexInRound: i })
      }
    }
    const ordered = orderByGenealogyThenDate(unrecognized, nextRoundMatches)
    for (let i = 0; i < ordered.length && i < openSlots.length; i++) {
      positioned.push({ match: ordered[i], ...openSlots[i] })
    }
  }

  return positioned
}

// Round 1+: a match's slot is derived from its real parent in `prev`, found via the
// "Zwycięzca meczu N" placeholder (N looked up against the parent's external_id),
// falling back to matching team_a/team_b by name when the placeholder was already
// cleared because the match was seeded already-decided. Never guesses by sort
// order/array position — that produced visually wrong bracket connectors even
// though the stored match data itself was correct. A match whose parent can't be
// found either way (genuinely missing data) falls back to kickoff order over
// whatever slots genealogy left open, same degraded behavior as before.
function positionNextRound(matches: Match[], prev: Positioned[], slotsPerHalf: number): Positioned[] {
  const prevByNumber = new Map<number, Positioned>()
  for (const p of prev) {
    const num = externalMatchNumber(p.match.external_id)
    if (num !== null) prevByNumber.set(num, p)
  }

  function findParent(teamName: string | null | undefined, placeholder: string | null | undefined): Positioned | null {
    const num = placeholderMatchNumber(placeholder)
    if (num !== null) {
      const byNumber = prevByNumber.get(num)
      if (byNumber) return byNumber
    }
    if (teamName) return prev.find(p => p.match.team_a === teamName || p.match.team_b === teamName) ?? null
    return null
  }

  const occupied = new Set<string>()
  const resolved: Positioned[] = []
  const unresolved: Match[] = []

  for (const match of matches) {
    const parent = findParent(match.team_a, match.home_placeholder) ?? findParent(match.team_b, match.away_placeholder)
    if (!parent) { unresolved.push(match); continue }
    const half = parent.half
    const indexInRound = Math.floor(parent.indexInRound / 2)
    const key = `${half}-${indexInRound}`
    if (indexInRound >= slotsPerHalf || occupied.has(key)) { unresolved.push(match); continue }
    occupied.add(key)
    resolved.push({ match, half, indexInRound })
  }

  const openSlots: Array<{ half: 0 | 1; indexInRound: number }> = []
  for (const half of [0, 1] as const) {
    for (let i = 0; i < slotsPerHalf; i++) {
      if (!occupied.has(`${half}-${i}`)) openSlots.push({ half, indexInRound: i })
    }
  }
  const sortedUnresolved = sortMatches(unresolved)
  for (let i = 0; i < sortedUnresolved.length && i < openSlots.length; i++) {
    resolved.push({ match: sortedUnresolved[i], ...openSlots[i] })
  }

  return resolved
}

function toSlots(positioned: Positioned[], half: 0 | 1, slotsPerHalf: number, roundIdx: number): BracketSlot[] {
  const bySlot = new Map<number, Match>()
  for (const p of positioned) if (p.half === half) bySlot.set(p.indexInRound, p.match)
  return Array.from({ length: slotsPerHalf }, (_, i) => {
    const match = bySlot.get(i) ?? null
    return { roundIndex: roundIdx, indexInRound: i, match, status: slotStatus(match) }
  })
}

export function buildBracket(matches: Match[]): BracketData {
  const byPhase = new Map<string, Match[]>()
  for (const phase of BRACKET_ROUNDS) {
    byPhase.set(phase, matches.filter(m => m.phase === phase))
  }

  const positionsByRound: Positioned[][] = [
    positionRoundOf32(byPhase.get('round_of_32') ?? [], byPhase.get('round_of_16') ?? [])
  ]
  for (let r = 1; r < 4; r++) {
    const slotsPerHalf = HALF_BASE / Math.pow(2, r)
    positionsByRound.push(positionNextRound(byPhase.get(BRACKET_ROUNDS[r]) ?? [], positionsByRound[r - 1], slotsPerHalf))
  }

  const left: BracketHalf = { rounds: positionsByRound.map((p, r) => toSlots(p, 0, HALF_BASE / Math.pow(2, r), r)) }
  const right: BracketHalf = { rounds: positionsByRound.map((p, r) => toSlots(p, 1, HALF_BASE / Math.pow(2, r), r)) }

  const finalMatch = sortMatches(byPhase.get('final') ?? [])[0] ?? null
  const thirdPlaceMatch = sortMatches(matches.filter(m => m.phase === 'third_place'))[0] ?? null

  const ro32 = byPhase.get('round_of_32') ?? []
  let confirmedRoundOf32 = 0
  for (const m of ro32) {
    if (m.team_a) confirmedRoundOf32++
    if (m.team_b) confirmedRoundOf32++
  }

  return {
    left,
    right,
    final: { match: finalMatch, status: slotStatus(finalMatch) },
    thirdPlace: { match: thirdPlaceMatch, status: thirdPlaceMatch ? slotStatus(thirdPlaceMatch) : 'pending' },
    confirmedRoundOf32,
  }
}

// Vertical center of a slot, in row units (1 unit = height of one round_of_32 row).
// Recursive halving: a round-k slot at index i spans 2^k row-units and its center
// is exactly the midpoint of its two round-(k-1) children — guarantees connecting
// lines meet correctly without DOM measurement.
export function slotCenterRowUnit(roundIndex: number, indexInRound: number): number {
  const span = Math.pow(2, roundIndex)
  return indexInRound * span + span / 2
}
