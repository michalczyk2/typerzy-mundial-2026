import type { MatchStatus, MatchPhase } from '@/types'

// Data sources — no API key required
const OPENFOOTBALL_URL =
  'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json'
const REZA_TEAMS_URL =
  'https://raw.githubusercontent.com/rezarahiminia/worldcup2026/main/football.teams.json'

// --- Config check (no-op — kept for route compatibility) ---

export type FootballConfigCheck =
  | { ok: true; apiKey: string; leagueId: string; season: string; baseUrl: string }
  | { ok: false; error: string }

export function checkFootballConfig(): FootballConfigCheck {
  return { ok: true, apiKey: '', leagueId: '', season: '2026', baseUrl: OPENFOOTBALL_URL }
}

// --- Source data types ---

interface OFBScore {
  ft?: [number, number]
  ht?: [number, number]
  et?: [number, number]
  p?: [number, number]
}

interface OFBMatch {
  round: string
  date: string
  time?: string
  team1: string
  team2: string
  group?: string
  ground?: string
  score?: OFBScore
  num?: string
}

interface RezaTeam {
  name_en: string
  fifa_code: string
}

// --- Helpers ---

function mapPhase(round: string): { phase: MatchPhase; roundNum: number } {
  const r = round.toLowerCase()
  if (r.includes('matchday')) {
    const m = round.match(/(\d+)/)
    return { phase: 'group', roundNum: m ? parseInt(m[1]) : 1 }
  }
  if (r.includes('round of 32')) return { phase: 'round_of_32', roundNum: 1 }
  if (r.includes('round of 16')) return { phase: 'round_of_16', roundNum: 1 }
  if (r.includes('quarter')) return { phase: 'quarterfinal', roundNum: 1 }
  if (r.includes('semi')) return { phase: 'semifinal', roundNum: 1 }
  if (r.includes('third')) return { phase: 'third_place', roundNum: 1 }
  if (r.includes('final')) return { phase: 'final', roundNum: 1 }
  return { phase: 'group', roundNum: 1 }
}

function makeExternalId(date: string, team1: string, team2: string): string {
  const slug = (s: string) => s.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
  return `ofb_${date}_${slug(team1)}_${slug(team2)}`
}

// Converts "HH:MM UTC±N" + date to ISO 8601 UTC string
function toISODate(date: string, time?: string): string {
  if (!time) return `${date}T12:00:00Z`
  const m = time.match(/^(\d{2}):(\d{2})\s+UTC([+-]\d+)$/)
  if (!m) return `${date}T12:00:00Z`
  const localH = parseInt(m[1])
  const localMin = parseInt(m[2])
  const offset = parseInt(m[3])
  // UTC = local - offset  (e.g. 13:00 UTC-6 → 13 - (-6) = 19:00 UTC)
  let utcH = localH - offset
  let utcDate = date
  if (utcH >= 24) {
    utcH -= 24
    const d = new Date(date)
    d.setDate(d.getDate() + 1)
    utcDate = d.toISOString().slice(0, 10)
  } else if (utcH < 0) {
    utcH += 24
    const d = new Date(date)
    d.setDate(d.getDate() - 1)
    utcDate = d.toISOString().slice(0, 10)
  }
  return `${utcDate}T${String(utcH).padStart(2, '0')}:${String(localMin).padStart(2, '0')}:00Z`
}

// Filters out knockout placeholders like "W73", "1A", "Runner-up Group C"
function isRealTeam(name: string): boolean {
  return typeof name === 'string' && name.length >= 3 && !/\d/.test(name)
}

// --- Team code enrichment from rezarahiminia ---

async function fetchTeamCodeMap(): Promise<Map<string, string>> {
  try {
    const res = await fetch(REZA_TEAMS_URL, { cache: 'no-store' })
    if (!res.ok) return new Map()
    const teams: RezaTeam[] = await res.json()
    return new Map(teams.map(t => [t.name_en, t.fifa_code]))
  } catch {
    return new Map()
  }
}

function getCode(name: string, codeMap: Map<string, string>): string {
  return codeMap.get(name) ?? name.slice(0, 3).toUpperCase()
}

// --- Public interfaces (unchanged shape — routes depend on these) ---

export interface FootballFixture {
  external_id: string
  team_a: string
  team_b: string
  team_a_code: string
  team_b_code: string
  match_date: string
  official_match_day: string  // raw FIFA schedule date YYYY-MM-DD (not UTC-converted)
  status: MatchStatus
  score_a: number | null
  score_b: number | null
  halftime_a: number | null
  halftime_b: number | null
  phase: MatchPhase
  group_name: string | null
  round: number
  stadium: string | null
  city: string | null
}

export async function fetchFixtures(): Promise<FootballFixture[]> {
  const [ofbRes, codeMap] = await Promise.all([
    fetch(OPENFOOTBALL_URL, { cache: 'no-store' }),
    fetchTeamCodeMap(),
  ])

  if (!ofbRes.ok) {
    throw new Error(`openfootball HTTP ${ofbRes.status}`)
  }

  const data: { matches: OFBMatch[] } = await ofbRes.json()

  return data.matches
    .filter(m => isRealTeam(m.team1) && isRealTeam(m.team2))
    .map(m => {
      const { phase, roundNum } = mapPhase(m.round)
      const hasScore = m.score?.ft !== undefined
      return {
        external_id: makeExternalId(m.date, m.team1, m.team2),
        team_a: m.team1,
        team_b: m.team2,
        team_a_code: getCode(m.team1, codeMap),
        team_b_code: getCode(m.team2, codeMap),
        match_date: toISODate(m.date, m.time),
        official_match_day: m.date, // raw FIFA schedule date, avoids UTC-offset issues
        status: (hasScore ? 'finished' : 'scheduled') as MatchStatus,
        score_a: m.score?.ft?.[0] ?? null,
        score_b: m.score?.ft?.[1] ?? null,
        halftime_a: m.score?.ht?.[0] ?? null,
        halftime_b: m.score?.ht?.[1] ?? null,
        phase,
        group_name: m.group ?? null,
        round: roundNum,
        stadium: m.ground ?? null,
        city: null,
      }
    })
}

// --- Standings (calculated from match results — no separate source needed) ---

export interface FootballStanding {
  group_name: string
  team_code: string
  team_name: string
  played: number
  won: number
  drawn: number
  lost: number
  goals_for: number
  goals_against: number
  points: number
  position: number
}

export async function fetchStandings(): Promise<FootballStanding[]> {
  const fixtures = await fetchFixtures()
  return calculateStandings(fixtures)
}

interface TeamStats {
  group_name: string
  team_name: string
  team_code: string
  played: number
  won: number
  drawn: number
  lost: number
  goals_for: number
  goals_against: number
  points: number
}

function calculateStandings(fixtures: FootballFixture[]): FootballStanding[] {
  const statsMap = new Map<string, TeamStats>()

  function get(group: string, team: string, code: string): TeamStats {
    const key = `${group}__${team}`
    if (!statsMap.has(key)) {
      statsMap.set(key, {
        group_name: group, team_name: team, team_code: code,
        played: 0, won: 0, drawn: 0, lost: 0,
        goals_for: 0, goals_against: 0, points: 0,
      })
    }
    return statsMap.get(key)!
  }

  // Seed all group-stage teams so they appear even with 0 points
  for (const f of fixtures) {
    if (f.phase !== 'group' || !f.group_name) continue
    get(f.group_name, f.team_a, f.team_a_code)
    get(f.group_name, f.team_b, f.team_b_code)
  }

  // Accumulate results for finished matches
  for (const f of fixtures) {
    if (
      f.phase !== 'group' ||
      f.status !== 'finished' ||
      f.score_a === null ||
      f.score_b === null ||
      !f.group_name
    ) continue

    const a = get(f.group_name, f.team_a, f.team_a_code)
    const b = get(f.group_name, f.team_b, f.team_b_code)
    const sa = f.score_a
    const sb = f.score_b

    a.played++; b.played++
    a.goals_for += sa; a.goals_against += sb
    b.goals_for += sb; b.goals_against += sa

    if (sa > sb) {
      a.won++; a.points += 3; b.lost++
    } else if (sa < sb) {
      b.won++; b.points += 3; a.lost++
    } else {
      a.drawn++; a.points++; b.drawn++; b.points++
    }
  }

  // Sort each group: points → GD → GF
  const byGroup = new Map<string, TeamStats[]>()
  for (const s of statsMap.values()) {
    if (!byGroup.has(s.group_name)) byGroup.set(s.group_name, [])
    byGroup.get(s.group_name)!.push(s)
  }

  const result: FootballStanding[] = []
  for (const teams of byGroup.values()) {
    teams.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      const gdA = a.goals_for - a.goals_against
      const gdB = b.goals_for - b.goals_against
      if (gdB !== gdA) return gdB - gdA
      return b.goals_for - a.goals_for
    })
    teams.forEach((t, i) => result.push({ ...t, position: i + 1 }))
  }

  return result
}
