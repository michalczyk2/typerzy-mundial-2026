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

// === worldcup26.ir provider (primary data source) ===

const WC26_API_URL = 'https://worldcup26.ir/get/games'
const WC26_TIMEOUT_MS = 10_000

// English team name → ISO 3166-1 alpha-2 lowercase, matching FlagImg convention
const WC26_TEAM_CODE_MAP: Record<string, string> = {
  // CONMEBOL
  Argentina: 'ar', Brazil: 'br', Colombia: 'co', Uruguay: 'uy',
  Ecuador: 'ec', Venezuela: 've', Bolivia: 'bo', Paraguay: 'py',
  Chile: 'cl', Peru: 'pe',
  // CONCACAF
  Mexico: 'mx', 'United States': 'us', USA: 'us', Canada: 'ca',
  'Costa Rica': 'cr', Panama: 'pa', Honduras: 'hn', Guatemala: 'gt',
  'El Salvador': 'sv', Cuba: 'cu', Jamaica: 'jm', Haiti: 'ht',
  'Trinidad and Tobago': 'tt', 'Trinidad & Tobago': 'tt',
  // UEFA
  France: 'fr', Germany: 'de', Spain: 'es', England: 'gb-eng',
  Netherlands: 'nl', Portugal: 'pt', Belgium: 'be', Croatia: 'hr',
  Switzerland: 'ch', Denmark: 'dk', Italy: 'it', Poland: 'pl',
  Serbia: 'rs', Turkey: 'tr', Scotland: 'gb-sct', Romania: 'ro',
  Austria: 'at', Hungary: 'hu', 'Czech Republic': 'cz', Slovakia: 'sk',
  Ukraine: 'ua', Slovenia: 'si', Georgia: 'ge', Albania: 'al',
  Wales: 'gb-wls', Finland: 'fi', Norway: 'no', Sweden: 'se',
  Greece: 'gr', Bulgaria: 'bg', Luxembourg: 'lu', Iceland: 'is',
  'North Macedonia': 'mk', Montenegro: 'me', Kosovo: 'xk',
  'Bosnia and Herzegovina': 'ba', 'Bosnia & Herzegovina': 'ba',
  // CAF
  Morocco: 'ma', Senegal: 'sn', Nigeria: 'ng', Egypt: 'eg',
  Cameroon: 'cm', Ghana: 'gh', Tunisia: 'tn', Algeria: 'dz',
  'Ivory Coast': 'ci', "Côte d'Ivoire": 'ci', 'Cote d Ivoire': 'ci',
  'South Africa': 'za', Mali: 'ml', Angola: 'ao',
  'DR Congo': 'cd', 'Democratic Republic of Congo': 'cd', 'Congo DR': 'cd',
  'Burkina Faso': 'bf', 'Cape Verde': 'cv', Kenya: 'ke',
  Tanzania: 'tz', Comoros: 'km', Benin: 'bj', Rwanda: 'rw',
  // AFC
  Japan: 'jp', 'South Korea': 'kr', 'Korea Republic': 'kr',
  Iran: 'ir', 'Saudi Arabia': 'sa', Australia: 'au', Qatar: 'qa',
  Iraq: 'iq', Uzbekistan: 'uz', 'United Arab Emirates': 'ae', UAE: 'ae',
  Bahrain: 'bh', Jordan: 'jo', China: 'cn', Indonesia: 'id',
  // OFC
  'New Zealand': 'nz', Fiji: 'fj', 'New Caledonia': 'nc',
}

interface WC26Game {
  id: number | string
  home_team_name_en: string
  away_team_name_en: string
  home_score: number | string | null
  away_score: number | string | null
  group: string | null
  matchday: number | string | null
  local_date: string | null
  finished: boolean | string
  time_elapsed: string | null
  type: string | null
  home_team_code?: string
  away_team_code?: string
  stadium_id?: string | null
  stadium?: string | null
  city?: string | null
}

function wc26TeamCode(name: string, provided?: string): string {
  if (provided) return provided.toLowerCase()
  return WC26_TEAM_CODE_MAP[name] ?? name.slice(0, 3).toLowerCase()
}

function wc26Phase(type: string | null): MatchPhase {
  if (!type) return 'group'
  const t = type.toLowerCase().replace(/[_\s-]/g, '')
  if (t.includes('32')) return 'round_of_32'
  if (t.includes('16')) return 'round_of_16'
  if (t.includes('quarter')) return 'quarterfinal'
  if (t.includes('semi')) return 'semifinal'
  if (t.includes('third') || t.includes('3rd') || t.includes('bronze')) return 'third_place'
  if (t.includes('final')) return 'final'
  return 'group'
}

function wc26Status(g: WC26Game): MatchStatus {
  if (g.finished === true || g.finished === 'TRUE') return 'finished'
  const elapsed = typeof g.time_elapsed === 'string' ? g.time_elapsed.trim() : ''
  if (elapsed && elapsed !== 'finished' && elapsed !== 'notstarted') return 'live'
  return 'scheduled'
}

function wc26ParseScore(val: number | string | null | undefined): number | null {
  if (val === null || val === undefined || val === 'null' || val === '') return null
  const n = Number(val)
  return isNaN(n) ? null : n
}

// UTC offset (hours) for each WC2026 stadium during summer (June–July 2026)
// Mexico City abolished DST in 2022 → permanently CST (UTC-6)
// All other North American venues observe DST in summer
const WC26_STADIUM_UTC_OFFSET: Record<string, number> = {
  '1': -6,  // Estadio Azteca, Mexico City (CST, no DST)
  '2': -5,  // Estadio Akron, Guadalajara (CDT)
  '3': -5,  // Estadio BBVA, Monterrey (CDT)
  '4': -5,  // AT&T Stadium, Dallas (CDT)
  '5': -5,  // NRG Stadium, Houston (CDT)
  '6': -5,  // Arrowhead Stadium, Kansas City (CDT)
  '7': -4,  // Mercedes-Benz Stadium, Atlanta (EDT)
  '8': -4,  // Hard Rock Stadium, Miami (EDT)
  '9': -4,  // Gillette Stadium, Boston (EDT)
  '10': -4, // Lincoln Financial Field, Philadelphia (EDT)
  '11': -4, // MetLife Stadium, New York (EDT)
  '12': -4, // BMO Field, Toronto (EDT)
  '13': -7, // BC Place, Vancouver (PDT)
  '14': -7, // Lumen Field, Seattle (PDT)
  '15': -7, // Levi's Stadium, San Francisco (PDT)
  '16': -7, // SoFi Stadium, Los Angeles (PDT)
}

// Extract the local calendar date YYYY-MM-DD from "MM/DD/YYYY HH:MM" without UTC conversion
function wc26LocalDay(raw: string | null): string {
  if (!raw) return new Date().toISOString().slice(0, 10)
  const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (!m) return raw.slice(0, 10)
  return `${m[3]}-${m[1]}-${m[2]}`
}

// "MM/DD/YYYY HH:MM" is venue-local time; convert to UTC using the stadium's offset
function wc26ParseDate(raw: string | null, stadiumId?: string | number | null): string {
  if (!raw) return new Date().toISOString()
  const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/)
  if (!m) {
    const d = new Date(raw)
    return isNaN(d.getTime()) ? raw : d.toISOString()
  }
  const utcOffset = stadiumId != null ? (WC26_STADIUM_UTC_OFFSET[String(stadiumId)] ?? -5) : -5
  // Date.UTC treats inputs as UTC; subtract the venue offset to get true UTC
  const localMs = Date.UTC(parseInt(m[3]), parseInt(m[1]) - 1, parseInt(m[2]), parseInt(m[4]), parseInt(m[5]), 0)
  return new Date(localMs - utcOffset * 3_600_000).toISOString()
}

export async function fetchWC26Fixtures(): Promise<FootballFixture[] | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), WC26_TIMEOUT_MS)
    let res: Response
    try {
      res = await fetch(WC26_API_URL, { cache: 'no-store', signal: controller.signal })
    } finally {
      clearTimeout(timer)
    }
    if (!res.ok) return null
    const raw: unknown = await res.json()
    const games: WC26Game[] = Array.isArray(raw)
      ? (raw as WC26Game[])
      : Array.isArray((raw as Record<string, unknown>)?.games)
        ? ((raw as Record<string, unknown>).games as WC26Game[])
        : []
    if (games.length === 0) return null
    return games
      .filter(g => g.home_team_name_en && g.away_team_name_en)
      .map(g => ({
        external_id: `wc26_${g.id}`,
        team_a: g.home_team_name_en,
        team_b: g.away_team_name_en,
        team_a_code: wc26TeamCode(g.home_team_name_en, g.home_team_code),
        team_b_code: wc26TeamCode(g.away_team_name_en, g.away_team_code),
        match_date: wc26ParseDate(g.local_date, g.stadium_id),
        official_match_day: wc26LocalDay(g.local_date),
        status: wc26Status(g),
        score_a: wc26ParseScore(g.home_score),
        score_b: wc26ParseScore(g.away_score),
        halftime_a: null,
        halftime_b: null,
        phase: wc26Phase(g.type),
        group_name: g.group ?? null,
        round: typeof g.matchday === 'string' ? (parseInt(g.matchday, 10) || 1) : (g.matchday ?? 1),
        stadium: g.stadium ?? null,
        city: g.city ?? null,
      }))
  } catch {
    return null
  }
}

export async function fetchFixtures(): Promise<FootballFixture[]> {
  // worldcup26.ir as primary source — real-time scores and live match data
  const wc26 = await fetchWC26Fixtures()
  if (wc26 !== null && wc26.length > 0) {
    return wc26
  }

  // Fallback: openfootball open dataset
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

export function calculateStandings(fixtures: FootballFixture[]): FootballStanding[] {
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
