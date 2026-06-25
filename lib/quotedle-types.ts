export type QuotedleGameStatus = 'playing' | 'won' | 'lost'

export type QuotedlePublicPuzzle = {
  dayKey: string
  maxAttempts: number
  maxPoints: number
  quote: string
  hintsCount: number
}

export type QuotedleGuessResult = {
  guessedName: string
  isCorrect: boolean
  hintsRevealed: string[]
  revealedAnswer?: string
  earnedPoints?: number
}

export type QuotedleEvaluationResponse =
  | { ok: true; result: QuotedleGuessResult }
  | { ok: false; error: string }

export type QuotedleStoredGame = {
  dayKey: string
  attempts: number
  wrongGuesses: string[]
  hintsRevealed: string[]
  status: QuotedleGameStatus
  revealedAnswer?: string
  earnedPoints?: number
  startedAt?: string
  completedAt?: string
}

export type QuotedleStats = {
  playedGames: number
  wonGames: number
  resultsByDay: Record<string, 'won' | 'lost'>
}
