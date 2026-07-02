import 'server-only'

import transferdlePlayers from '@/daily-challenge-transferdle.json'
import type {
  TransferdleEvaluationResponse,
  TransferdlePublicPuzzle,
} from '@/lib/transferdle-types'
import { getWarsawDayKey, normalizeDayKey, pickForDay } from '@/lib/daily-puzzle-utils'

const MAX_ATTEMPTS = 8
const POINTS_BY_ATTEMPT = [100, 85, 70, 55, 40, 25, 15, 5]

type TransferdlePlayer = {
  id: string
  name: string
  transfers: string[]
}

const players = transferdlePlayers as TransferdlePlayer[]

function getPlayerForDay(dayKey = getWarsawDayKey()): TransferdlePlayer {
  return pickForDay(players, normalizeDayKey(dayKey))
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
