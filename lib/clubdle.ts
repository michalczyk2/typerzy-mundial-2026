import 'server-only'

import clubdleClubs from '@/daily-challenge-clubdle.json'
import type {
  ClubdleComparisonStatus,
  ClubdleEvaluationResponse,
  ClubdleFieldId,
  ClubdleGuessField,
  ClubdleClubOption,
  ClubdlePublicPuzzle,
} from '@/lib/clubdle-types'

const MAX_ATTEMPTS = 8
const MAX_POINTS = 100
const WARSAW_TIME_ZONE = 'Europe/Warsaw'

type ClubdleClub = {
  id: string
  name: string
  country: string
  continent: string
  league: string
  leagueCountry: string
  stadium: string
  founded: number
  capacity: number
  ucl: number
  domestic: number
}

const clubs = clubdleClubs as ClubdleClub[]

function getWarsawDayKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: WARSAW_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const year = parts.find(part => part.type === 'year')?.value ?? '2026'
  const month = parts.find(part => part.type === 'month')?.value ?? '01'
  const day = parts.find(part => part.type === 'day')?.value ?? '01'

  return `${year}-${month}-${day}`
}

function normalizeDayKey(dayKey: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return dayKey
  return getWarsawDayKey()
}

function hashDayKey(dayKey: string): number {
  return [...dayKey].reduce((hash, char) => hash + char.charCodeAt(0), 0)
}

function getClubForDay(dayKey = getWarsawDayKey()): ClubdleClub {
  const normalizedDayKey = normalizeDayKey(dayKey)
  const index = hashDayKey(normalizedDayKey) % clubs.length
  return clubs[index]
}

function compareCountry(g: ClubdleClub, a: ClubdleClub): ClubdleComparisonStatus {
  if (g.country === a.country) return 'correct'
  return g.continent === a.continent ? 'close' : 'wrong'
}

function compareLeague(g: ClubdleClub, a: ClubdleClub): ClubdleComparisonStatus {
  if (g.league === a.league) return 'correct'
  return g.leagueCountry === a.leagueCountry ? 'close' : 'wrong'
}

function compareStadium(g: ClubdleClub, a: ClubdleClub): ClubdleComparisonStatus {
  return g.stadium === a.stadium ? 'correct' : 'wrong'
}

function compareFounded(g: number, a: number): ClubdleComparisonStatus {
  if (g === a) return 'correct'
  return Math.abs(g - a) <= 10 ? 'close' : 'wrong'
}

function foundedHint(g: number, a: number): string | undefined {
  if (g === a) return undefined
  return g < a ? 'pozniej' : 'wczesniej'
}

function compareCapacity(g: number, a: number): ClubdleComparisonStatus {
  if (g === a) return 'correct'
  return Math.abs(g - a) <= 10000 ? 'close' : 'wrong'
}

function capacityHint(g: number, a: number): string | undefined {
  if (g === a) return undefined
  return g < a ? 'wiekszy' : 'mniejszy'
}

function compareUCL(g: number, a: number): ClubdleComparisonStatus {
  if (g === a) return 'correct'
  return Math.abs(g - a) <= 1 ? 'close' : 'wrong'
}

function uclHint(g: number, a: number): string | undefined {
  if (g === a) return undefined
  return g < a ? 'wiecej' : 'mniej'
}

function compareDomestic(g: number, a: number): ClubdleComparisonStatus {
  if (g === a) return 'correct'
  return Math.abs(g - a) <= 3 ? 'close' : 'wrong'
}

function domesticHint(g: number, a: number): string | undefined {
  if (g === a) return undefined
  return g < a ? 'wiecej' : 'mniej'
}

function field(
  id: ClubdleFieldId,
  label: string,
  value: string,
  status: ClubdleComparisonStatus,
  hint?: string
): ClubdleGuessField {
  return { id, label, value, status, hint }
}

function buildComparisonFields(guess: ClubdleClub, answer: ClubdleClub): ClubdleGuessField[] {
  const capK = Math.round(guess.capacity / 1000)
  return [
    field('country', 'Kraj', guess.country, compareCountry(guess, answer)),
    field('league', 'Liga', guess.league, compareLeague(guess, answer)),
    field('stadium', 'Stadion', guess.stadium, compareStadium(guess, answer)),
    field('founded', 'Zał.', String(guess.founded), compareFounded(guess.founded, answer.founded), foundedHint(guess.founded, answer.founded)),
    field('capacity', 'Poj.', `${capK} tys.`, compareCapacity(guess.capacity, answer.capacity), capacityHint(guess.capacity, answer.capacity)),
    field('ucl', 'LM', String(guess.ucl), compareUCL(guess.ucl, answer.ucl), uclHint(guess.ucl, answer.ucl)),
    field('domestic', 'Krajowe', String(guess.domestic), compareDomestic(guess.domestic, answer.domestic), domesticHint(guess.domestic, answer.domestic)),
  ]
}

function getClubOptions(): ClubdleClubOption[] {
  return clubs
    .map(club => ({ id: club.id, name: club.name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pl'))
}

export function getClubdlePublicPuzzle(): ClubdlePublicPuzzle {
  return {
    dayKey: getWarsawDayKey(),
    maxAttempts: MAX_ATTEMPTS,
    maxPoints: MAX_POINTS,
    candidates: getClubOptions(),
  }
}

export async function evaluateClubdleGuessOnServer(
  clubId: string,
  dayKey: string,
  attemptNumber: number
): Promise<ClubdleEvaluationResponse> {
  const normalizedDayKey = normalizeDayKey(dayKey)
  const answer = getClubForDay(normalizedDayKey)
  const guess = clubs.find(c => c.id === clubId)

  if (!guess) {
    return { ok: false, error: 'Wybierz klub z listy.' }
  }

  const isCorrect = guess.id === answer.id
  const shouldRevealAnswer = isCorrect || attemptNumber >= MAX_ATTEMPTS

  return {
    ok: true,
    result: {
      clubId: guess.id,
      name: guess.name,
      fields: buildComparisonFields(guess, answer),
      isCorrect,
      revealedAnswer: shouldRevealAnswer ? answer.name : undefined,
    },
  }
}
