import 'server-only'

import quotedleQuotes from '@/daily-challenge-quotedle.json'
import type {
  QuotedleEvaluationResponse,
  QuotedlePublicPuzzle,
} from '@/lib/quotedle-types'
import { getWarsawDayKey, normalizeDayKey, pickForDay } from '@/lib/daily-puzzle-utils'

const MAX_ATTEMPTS = 5
const POINTS_BY_ATTEMPT = [100, 80, 60, 40, 20]

type QuotedleQuote = {
  id: string
  quote: string
  author: string
  hints: string[]
}

const quotes = quotedleQuotes as QuotedleQuote[]

function getQuoteForDay(dayKey = getWarsawDayKey()): QuotedleQuote {
  return pickForDay(quotes, normalizeDayKey(dayKey))
}

function normalizeAuthor(name: string): string {
  return name
    .trim()
    .toLocaleUpperCase('pl-PL')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9 ]/g, '')
}

export function getQuotedlePublicPuzzle(): QuotedlePublicPuzzle {
  const quote = getQuoteForDay()
  return {
    dayKey: getWarsawDayKey(),
    maxAttempts: MAX_ATTEMPTS,
    maxPoints: POINTS_BY_ATTEMPT[0],
    quote: quote.quote,
    hintsCount: quote.hints.length,
  }
}

export async function evaluateQuotedleGuessOnServer(
  guessedName: string,
  dayKey: string,
  attemptNumber: number
): Promise<QuotedleEvaluationResponse> {
  const normalizedDayKey = normalizeDayKey(dayKey)
  const answer = getQuoteForDay(normalizedDayKey)

  const trimmed = guessedName.trim()
  if (!trimmed) {
    return { ok: false, error: 'Wpisz nazwisko autora.' }
  }

  const isCorrect = normalizeAuthor(trimmed) === normalizeAuthor(answer.author)
  const clampedAttempt = Math.min(Math.max(1, attemptNumber), MAX_ATTEMPTS)
  const hintsRevealed = isCorrect ? [] : answer.hints.slice(0, clampedAttempt)
  const shouldRevealAnswer = isCorrect || clampedAttempt >= MAX_ATTEMPTS
  const earnedPoints = isCorrect ? (POINTS_BY_ATTEMPT[clampedAttempt - 1] ?? 20) : undefined

  return {
    ok: true,
    result: {
      guessedName: trimmed,
      isCorrect,
      hintsRevealed,
      revealedAnswer: shouldRevealAnswer ? answer.author : undefined,
      earnedPoints,
    },
  }
}
