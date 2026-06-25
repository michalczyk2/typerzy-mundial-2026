export type TransferdleGameStatus = 'playing' | 'won' | 'lost'

export type TransferdlePublicPuzzle = {
  dayKey: string
  maxAttempts: number
  maxPoints: number
  transfersCount: number
}

export type TransferdleGuessResult = {
  guessedName: string
  isCorrect: boolean
  revealedTransfers: string[]
  revealedAnswer?: string
  earnedPoints?: number
}

export type TransferdleEvaluationResponse =
  | { ok: true; result: TransferdleGuessResult }
  | { ok: false; error: string }

export type TransferdleStoredGame = {
  dayKey: string
  attempts: number
  wrongGuesses: string[]
  revealedTransfers: string[]
  status: TransferdleGameStatus
  revealedAnswer?: string
  earnedPoints?: number
  startedAt?: string
  completedAt?: string
}

export type TransferdleStats = {
  playedGames: number
  wonGames: number
  resultsByDay: Record<string, 'won' | 'lost'>
}
