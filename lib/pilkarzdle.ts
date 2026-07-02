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
import { getWarsawDayKey, normalizeDayKey, pickForDay } from '@/lib/daily-puzzle-utils'

const MAX_ATTEMPTS = 8
const MAX_POINTS = 100

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
  height: number
  shirtNumber: number
}

const players = pilkarzdlePlayers as PilkarzdlePlayer[]

function getPlayerForDay(dayKey = getWarsawDayKey()): PilkarzdlePlayer {
  return pickForDay(players, normalizeDayKey(dayKey))
}

function compareNationality(guess: PilkarzdlePlayer, answer: PilkarzdlePlayer): PilkarzdleComparisonStatus {
  if (guess.nationality === answer.nationality) return 'correct'
  return guess.continent === answer.continent ? 'close' : 'wrong'
}

function comparePosition(guess: PilkarzdlePlayer, answer: PilkarzdlePlayer): PilkarzdleComparisonStatus {
  if (guess.position === answer.position) return 'correct'
  return guess.positionGroup === answer.positionGroup ? 'close' : 'wrong'
}

function compareLeague(guess: PilkarzdlePlayer, answer: PilkarzdlePlayer): PilkarzdleComparisonStatus {
  if (guess.league === answer.league) return 'correct'
  return guess.leagueCountry === answer.leagueCountry ? 'close' : 'wrong'
}

function compareClub(guess: PilkarzdlePlayer, answer: PilkarzdlePlayer): PilkarzdleComparisonStatus {
  if (guess.club === answer.club) return 'correct'
  return guess.league === answer.league ? 'close' : 'wrong'
}

function compareAge(guessAge: number, answerAge: number): PilkarzdleComparisonStatus {
  if (guessAge === answerAge) return 'correct'
  return Math.abs(guessAge - answerAge) <= 3 ? 'close' : 'wrong'
}

function ageHint(guessAge: number, answerAge: number): string | undefined {
  if (guessAge === answerAge) return undefined
  return guessAge < answerAge ? 'wyzej' : 'nizej'
}

function compareHeight(guessH: number, answerH: number): PilkarzdleComparisonStatus {
  if (guessH === answerH) return 'correct'
  return Math.abs(guessH - answerH) <= 3 ? 'close' : 'wrong'
}

function heightHint(guessH: number, answerH: number): string | undefined {
  if (guessH === answerH) return undefined
  return guessH < answerH ? 'wyzej' : 'nizej'
}

function compareShirtNumber(guessN: number, answerN: number): PilkarzdleComparisonStatus {
  if (guessN === answerN) return 'correct'
  return Math.abs(guessN - answerN) <= 3 ? 'close' : 'wrong'
}

function shirtHint(guessN: number, answerN: number): string | undefined {
  if (guessN === answerN) return undefined
  return guessN < answerN ? 'wyzej' : 'nizej'
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

function buildComparisonFields(guess: PilkarzdlePlayer, answer: PilkarzdlePlayer): PilkarzdleGuessField[] {
  return [
    field('nationality', 'Kraj', guess.nationality, compareNationality(guess, answer)),
    field('position', 'Poz.', guess.position, comparePosition(guess, answer)),
    field('league', 'Liga', guess.league, compareLeague(guess, answer)),
    field('club', 'Klub', guess.club, compareClub(guess, answer)),
    field('age', 'Wiek', String(guess.age), compareAge(guess.age, answer.age), ageHint(guess.age, answer.age)),
    field('height', 'Wzrost', `${guess.height} cm`, compareHeight(guess.height, answer.height), heightHint(guess.height, answer.height)),
    field('shirtNumber', 'Numer', String(guess.shirtNumber), compareShirtNumber(guess.shirtNumber, answer.shirtNumber), shirtHint(guess.shirtNumber, answer.shirtNumber)),
  ]
}

function getPlayerOptions(): PilkarzdlePlayerOption[] {
  return players
    .map(player => ({ id: player.id, name: player.name }))
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
    return { ok: false, error: 'Wybierz pilkarza z listy.' }
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
