import 'server-only'

import footWordlePuzzles from '@/daily-challenge-footwordle.json'
import type {
  FootWordleEvaluationResponse,
  FootWordleLetterStatus,
  FootWordlePublicPuzzle,
  FootWordleTile,
} from '@/lib/footwordle-types'

const MAX_ATTEMPTS = 6
const MAX_POINTS = 100
const WARSAW_TIME_ZONE = 'Europe/Warsaw'

type FootWordlePuzzle = {
  answer: string
  type: string
  hint: string
}

const puzzles = footWordlePuzzles as FootWordlePuzzle[]

function normalizeText(value: string): string {
  return value
    .trim()
    .toLocaleUpperCase('pl-PL')
    .replace(/\u0141/g, 'L')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z]/g, '')
}

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

function getPuzzleForDay(dayKey = getWarsawDayKey()): FootWordlePuzzle {
  const normalizedDayKey = normalizeDayKey(dayKey)
  const index = hashDayKey(normalizedDayKey) % puzzles.length

  return puzzles[index]
}

function evaluateGuess(guess: string, answer: string): FootWordleTile[] {
  const guessLetters = [...guess]
  const answerLetters = [...answer]
  const statuses: Array<FootWordleLetterStatus | null> = Array(guessLetters.length).fill(null)
  const remainingAnswerLetters = new Map<string, number>()

  answerLetters.forEach((answerLetter, index) => {
    if (guessLetters[index] === answerLetter) {
      statuses[index] = 'correct'
      return
    }

    remainingAnswerLetters.set(answerLetter, (remainingAnswerLetters.get(answerLetter) ?? 0) + 1)
  })

  guessLetters.forEach((guessLetter, index) => {
    if (statuses[index]) {
      return
    }

    const remaining = remainingAnswerLetters.get(guessLetter) ?? 0
    if (remaining > 0) {
      statuses[index] = 'present'
      remainingAnswerLetters.set(guessLetter, remaining - 1)
      return
    }

    statuses[index] = 'absent'
  })

  return guessLetters.map((letter, index) => ({
    letter,
    status: statuses[index] ?? 'absent',
  }))
}

export function getFootWordlePublicPuzzle(): FootWordlePublicPuzzle {
  const dayKey = getWarsawDayKey()
  const puzzle = getPuzzleForDay(dayKey)
  const answer = normalizeText(puzzle.answer)

  return {
    dayKey,
    type: puzzle.type,
    hint: puzzle.hint,
    answerLength: answer.length,
    maxAttempts: MAX_ATTEMPTS,
    maxPoints: MAX_POINTS,
  }
}

export async function evaluateFootWordleGuessOnServer(
  rawGuess: string,
  dayKey: string,
  attemptNumber: number
): Promise<FootWordleEvaluationResponse> {
  const normalizedDayKey = normalizeDayKey(dayKey)
  const puzzle = getPuzzleForDay(normalizedDayKey)
  const answer = normalizeText(puzzle.answer)
  const guess = normalizeText(rawGuess)

  if (!guess) {
    return { ok: false, error: 'Wpisz haslo przed zatwierdzeniem.' }
  }

  if (guess.length !== answer.length) {
    return { ok: false, error: `Haslo ma ${answer.length} liter.` }
  }

  const isCorrect = guess === answer
  const shouldRevealAnswer = isCorrect || attemptNumber >= MAX_ATTEMPTS

  return {
    ok: true,
    result: {
      guess,
      tiles: evaluateGuess(guess, answer),
      isCorrect,
      revealedAnswer: shouldRevealAnswer ? answer : undefined,
    },
  }
}
