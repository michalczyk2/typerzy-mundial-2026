import type { MatchStatus, MatchPhase } from '@/types'

const DEFAULT_BASE_URL = 'https://v3.football.api-sports.io'

function getConfig() {
  return {
    apiKey: process.env.FOOTBALL_API_KEY,
    provider: process.env.FOOTBALL_API_PROVIDER,
    leagueId: process.env.FOOTBALL_API_LEAGUE_ID,
    season: process.env.FOOTBALL_API_SEASON,
    baseUrl: process.env.FOOTBALL_API_BASE_URL ?? DEFAULT_BASE_URL,
  }
}

export type FootballConfigCheck =
  | { ok: true; apiKey: string; leagueId: string; season: string; baseUrl: string }
  | { ok: false; error: string }

export function checkFootballConfig(): FootballConfigCheck {
  const { apiKey, provider, leagueId, season, baseUrl } = getConfig()
  if (!provider || provider !== 'api-football') {
    return { ok: false, error: 'Brak FOOTBALL_API_PROVIDER=api-football' }
  }
  if (!apiKey) {
    return { ok: false, error: 'Brak FOOTBALL_API_KEY' }
  }
  if (!leagueId) {
    return { ok: false, error: 'Brak FOOTBALL_API_LEAGUE_ID' }
  }
  if (!season) {
    return { ok: false, error: 'Brak FOOTBALL_API_SEASON' }
  }
  return { ok: true, apiKey, leagueId, season, baseUrl }
}

function mapStatus(short: string): MatchStatus {
  if (['NS', 'TBD'].includes(short)) return 'scheduled'
  if (['1H', 'HT', '2H', 'ET', 'P', 'BT', 'LIVE'].includes(short)) return 'live'
  if (['FT', 'AET', 'PEN'].includes(short)) return 'finished'
  if (['PST'].includes(short)) return 'postponed'
  if (['CANC', 'SUSP'].includes(short)) return 'cancelled'
  return 'scheduled'
}

function mapPhase(round: string): { phase: MatchPhase; roundNum: number } {
  const r = (round ?? '').toLowerCase()
  if (r.includes('group')) {
    const m = round.match(/(\d+)$/)
    return { phase: 'group', roundNum: m ? parseInt(m[1]) : 1 }
  }
  if (r.includes('round of 32')) return { phase: 'round_of_32', roundNum: 1 }
  if (r.includes('round of 16')) return { phase: 'round_of_16', roundNum: 1 }
  if (r.includes('quarter')) return { phase: 'quarterfinal', roundNum: 1 }
  if (r.includes('semi')) return { phase: 'semifinal', roundNum: 1 }
  if (r.includes('3rd') || r.includes('third')) return { phase: 'third_place', roundNum: 1 }
  if (r.includes('final')) return { phase: 'final', roundNum: 1 }
  return { phase: 'group', roundNum: 1 }
}

export interface FootballFixture {
  external_id: string
  team_a: string
  team_b: string
  team_a_code: string
  team_b_code: string
  match_date: string
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapFixture(item: any): FootballFixture {
  const { phase, roundNum } = mapPhase(item.league?.round ?? '')
  return {
    external_id: String(item.fixture.id),
    team_a: item.teams.home.name,
    team_b: item.teams.away.name,
    team_a_code: item.teams.home.code ?? item.teams.home.name.slice(0, 3).toUpperCase(),
    team_b_code: item.teams.away.code ?? item.teams.away.name.slice(0, 3).toUpperCase(),
    match_date: item.fixture.date,
    status: mapStatus(item.fixture.status?.short ?? 'NS'),
    score_a: item.goals?.home ?? null,
    score_b: item.goals?.away ?? null,
    halftime_a: item.score?.halftime?.home ?? null,
    halftime_b: item.score?.halftime?.away ?? null,
    phase,
    group_name: null,
    round: roundNum,
    stadium: item.fixture.venue?.name ?? null,
    city: item.fixture.venue?.city ?? null,
  }
}

export async function fetchFixtures(): Promise<FootballFixture[]> {
  const config = checkFootballConfig()
  if (!config.ok) throw new Error(config.error)

  const url = `${config.baseUrl}/fixtures?league=${config.leagueId}&season=${config.season}`
  console.log('[football-provider] fetchFixtures', url)
  const res = await fetch(url, {
    headers: { 'x-apisports-key': config.apiKey },
    cache: 'no-store',
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API-Football HTTP ${res.status}: ${text.slice(0, 200)}`)
  }
  const json = await res.json()
  if (json.errors && Object.keys(json.errors).length > 0) {
    throw new Error(`API-Football error: ${JSON.stringify(json.errors)}`)
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (json.response ?? []).map((item: any) => mapFixture(item))
}

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
  const config = checkFootballConfig()
  if (!config.ok) throw new Error(config.error)

  const url = `${config.baseUrl}/standings?league=${config.leagueId}&season=${config.season}`
  console.log('[football-provider] fetchStandings', url)
  const res = await fetch(url, {
    headers: { 'x-apisports-key': config.apiKey },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`API-Football HTTP ${res.status}`)
  const json = await res.json()
  if (json.errors && Object.keys(json.errors).length > 0) {
    throw new Error(`API-Football error: ${JSON.stringify(json.errors)}`)
  }

  const result: FootballStanding[] = []
  for (const item of (json.response ?? [])) {
    for (const league of (item.league?.standings ?? [])) {
      for (const standing of league) {
        result.push({
          group_name: standing.group ?? 'Unknown',
          team_code: standing.team?.code ?? standing.team?.name?.slice(0, 3).toUpperCase() ?? 'UNK',
          team_name: standing.team?.name ?? 'Unknown',
          played: standing.all?.played ?? 0,
          won: standing.all?.win ?? 0,
          drawn: standing.all?.draw ?? 0,
          lost: standing.all?.lose ?? 0,
          goals_for: standing.all?.goals?.for ?? 0,
          goals_against: standing.all?.goals?.against ?? 0,
          points: standing.points ?? 0,
          position: standing.rank ?? 0,
        })
      }
    }
  }
  return result
}
