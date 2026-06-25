import 'server-only'

import transferdlePlayers from '@/daily-challenge-transferdle.json'
import type {
  TransferdleEvaluationResponse,
  TransferdlePublicPuzzle,
} from '@/lib/transferdle-types'

const MAX_ATTEMPTS = 8
const WARSAW_TIME_ZONE = 'Europe/Warsaw'
const POINTS_BY_ATTEMPT = [100, 85, 70, 55, 40, 25, 15, 5]

type TransferdlePlayer = {
  id: string
  name: string
  transfers: string[]
}

const players = transferdlePlayers as TransferdlePlayer[]

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

function getPlayerForDay(dayKey = getWarsawDayKey()): TransferdlePlayer {
  const normalizedDayKey = normalizeDayKey(dayKey)
  const index = hashDayKey(normalizedDayKey) % players.length
  return players[index]
}

function normalizeName(name: string): string {
  return name
    .trim()
    .toLocaleUpperCase('pl-PL')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9 ]/g, '')
}

export function getTransferdlePublicPuzzle(): TransferdlePublicPuzzle {
  const player = getPlayerForDay()
  const candidates = [...players].map(p => p.name).sort((a, b) => a.localeCompare(b, 'pl'))
  return {
    dayKey: getWarsawDayKey(),
    maxAttempts: MAX_ATTEMPTS,
    maxPoints: POINTS_BY_ATTEMPT[0],
    transfersCount: player.transfers.length,
    candidates,
  }
}

export async function evaluateTransferdleGuessOnServer(
  guessedName: string,
  dayKey: string,
  attemptNumber: number
): Promise<TransferdleEvaluationResponse> {
  const normalizedDayKey = normalizeDayKey(dayKey)
  const answer = getPlayerForDay(normalizedDayKey)

  const trimmed = guessedName.trim()
  if (!trimmed) {
    return { ok: false, error: 'Wpisz imię i nazwisko piłkarza.' }
  }

  const isCorrect = normalizeName(trimmed) === normalizeName(answer.name)
  const clampedAttempt = Math.min(Math.max(1, attemptNumber), MAX_ATTEMPTS)

  // after wrong guess on attempt N: reveal N+1 clubs (or all if fewer exist)
  const revealedCount = isCorrect
    ? clampedAttempt
    : Math.min(clampedAttempt + 1, answer.transfers.length)

  const revealedTransfers = answer.transfers.slice(0, revealedCount)
  const shouldRevealAnswer = isCorrect || clampedAttempt >= MAX_ATTEMPTS
  const earnedPoints = isCorrect ? (POINTS_BY_ATTEMPT[clampedAttempt - 1] ?? 5) : undefined

  return {
    ok: true,
    result: {
      guessedName: trimmed,
      isCorrect,
      revealedTransfers,
      revealedAnswer: shouldRevealAnswer ? answer.name : undefined,
      earnedPoints,
    },
  }
}
