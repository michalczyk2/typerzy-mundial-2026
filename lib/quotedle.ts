import 'server-only'

import quotedleQuotes from '@/daily-challenge-quotedle.json'
import type {
  QuotedleEvaluationResponse,
  QuotedlePublicPuzzle,
} from '@/lib/quotedle-types'

const MAX_ATTEMPTS = 5
const WARSAW_TIME_ZONE = 'Europe/Warsaw'
const POINTS_BY_ATTEMPT = [100, 80, 60, 40, 20]

type QuotedleQuote = {
  id: string
  quote: string
  author: string
  hints: string[]
}

const quotes = quotedleQuotes as QuotedleQuote[]

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

function getQuoteForDay(dayKey = getWarsawDayKey()): QuotedleQuote {
  const normalizedDayKey = normalizeDayKey(dayKey)
  const index = hashDayKey(normalizedDayKey) % quotes.length
  return quotes[index]
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
