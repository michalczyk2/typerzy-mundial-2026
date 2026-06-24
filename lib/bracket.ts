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

function buildHalf(roundMatches: Match[][], halfIndex: 0 | 1): BracketHalf {
  // roundMatches: matches per round, already sorted, NOT yet split into halves
  const rounds: BracketSlot[][] = roundMatches.map((matches, roundIdx) => {
    const slotsInRound = HALF_BASE / Math.pow(2, roundIdx)
    const half = halfIndex === 0
      ? matches.slice(0, slotsInRound)
      : matches.slice(slotsInRound, slotsInRound * 2)
    return Array.from({ length: slotsInRound }, (_, i) => {
      const match = half[i] ?? null
      return { roundIndex: roundIdx, indexInRound: i, match, status: slotStatus(match) }
    })
  })
  return { rounds }
}

export function buildBracket(matches: Match[]): BracketData {
  const byPhase = new Map<string, Match[]>()
  for (const phase of BRACKET_ROUNDS) {
    byPhase.set(phase, sortMatches(matches.filter(m => m.phase === phase)))
  }

  const koRounds = BRACKET_ROUNDS.slice(0, 4).map(phase => byPhase.get(phase) ?? [])

  const left = buildHalf(koRounds, 0)
  const right = buildHalf(koRounds, 1)

  const finalMatch = (byPhase.get('final') ?? [])[0] ?? null
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
