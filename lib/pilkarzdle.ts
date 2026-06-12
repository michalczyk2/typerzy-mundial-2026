import 'server-only'

import pilkarzdlePlayers from '@/daily-challenge-pilkarzdle.json'
import type {
  PilkarzdleComparisonStatus,
  PilkarzdleEvaluationResponse,
  PilkarzdleFieldId,
  PilkarzdleGuessField,
  PilkarzdlePlayerOption,
  PilkarzdlePublicPuzzle,
} from '@/lib/pilkarzdle-types'

const MAX_ATTEMPTS = 8
const MAX_POINTS = 100
const WARSAW_TIME_ZONE = 'Europe/Warsaw'

type PilkarzdlePlayer = {
  id: string
  name: string
  nationality: string
  continent: string
  position: string
  positionGroup: string
  league: string
  leagueCountry: string
  club: string
  age: number
}

const players = pilkarzdlePlayers as PilkarzdlePlayer[]

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
  if (/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) {
    return dayKey
  }

  return getWarsawDayKey()
}

function hashDayKey(dayKey: string): number {
  return [...dayKey].reduce((hash, char) => hash + char.charCodeAt(0), 0)
}

function getPlayerForDay(dayKey = getWarsawDayKey()): PilkarzdlePlayer {
  const normalizedDayKey = normalizeDayKey(dayKey)
  const index = hashDayKey(normalizedDayKey) % players.length

  return players[index]
}

function compareNationality(
  guess: PilkarzdlePlayer,
  answer: PilkarzdlePlayer
): PilkarzdleComparisonStatus {
  if (guess.nationality === answer.nationality) {
    return 'correct'
  }

  return guess.continent === answer.continent ? 'close' : 'wrong'
}

function comparePosition(
  guess: PilkarzdlePlayer,
  answer: PilkarzdlePlayer
): PilkarzdleComparisonStatus {
  if (guess.position === answer.position) {
    return 'correct'
  }

  return guess.positionGroup === answer.positionGroup ? 'close' : 'wrong'
}

function compareLeague(
  guess: PilkarzdlePlayer,
  answer: PilkarzdlePlayer
): PilkarzdleComparisonStatus {
  if (guess.league === answer.league) {
    return 'correct'
  }

  return guess.leagueCountry === answer.leagueCountry ? 'close' : 'wrong'
}

function compareClub(guess: PilkarzdlePlayer, answer: PilkarzdlePlayer): PilkarzdleComparisonStatus {
  if (guess.club === answer.club) {
    return 'correct'
  }

  return guess.league === answer.league ? 'close' : 'wrong'
}

function compareAge(guessAge: number, answerAge: number): PilkarzdleComparisonStatus {
  if (guessAge === answerAge) {
    return 'correct'
  }

  return Math.abs(guessAge - answerAge) <= 3 ? 'close' : 'wrong'
}

function ageHint(guessAge: number, answerAge: number): string | undefined {
  if (guessAge === answerAge) {
    return undefined
  }

  return guessAge < answerAge ? 'wyzej' : 'nizej'
}

function field(
  id: PilkarzdleFieldId,
  label: string,
  value: string,
  status: PilkarzdleComparisonStatus,
  hint?: string
): PilkarzdleGuessField {
  return { id, label, value, status, hint }
}

function buildComparisonFields(
  guess: PilkarzdlePlayer,
  answer: PilkarzdlePlayer
): PilkarzdleGuessField[] {
  return [
    field('nationality', 'Narodowosc', guess.nationality, compareNationality(guess, answer)),
    field('position', 'Pozycja', guess.position, comparePosition(guess, answer)),
    field('league', 'Liga', guess.league, compareLeague(guess, answer)),
    field('club', 'Klub', guess.club, compareClub(guess, answer)),
    field('age', 'Wiek', String(guess.age), compareAge(guess.age, answer.age), ageHint(guess.age, answer.age)),
  ]
}

function getPlayerOptions(): PilkarzdlePlayerOption[] {
  return players
    .map(player => ({
      id: player.id,
      name: player.name,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pl'))
}

export function getPilkarzdlePublicPuzzle(): PilkarzdlePublicPuzzle {
  return {
    dayKey: getWarsawDayKey(),
    maxAttempts: MAX_ATTEMPTS,
    maxPoints: MAX_POINTS,
    candidates: getPlayerOptions(),
  }
}

export async function evaluatePilkarzdleGuessOnServer(
  playerId: string,
  dayKey: string,
  attemptNumber: number
): Promise<PilkarzdleEvaluationResponse> {
  const normalizedDayKey = normalizeDayKey(dayKey)
  const answer = getPlayerForDay(normalizedDayKey)
  const guess = players.find(player => player.id === playerId)

  if (!guess) {
    return { ok: false, error: 'Wybierz pilkarza z listy podpowiedzi.' }
  }

  const isCorrect = guess.id === answer.id
  const shouldRevealAnswer = isCorrect || attemptNumber >= MAX_ATTEMPTS

  return {
    ok: true,
    result: {
      playerId: guess.id,
      name: guess.name,
      fields: buildComparisonFields(guess, answer),
      isCorrect,
      revealedAnswer: shouldRevealAnswer ? answer.name : undefined,
    },
  }
}
