export type FootWordleLetterStatus = 'correct' | 'present' | 'absent'

export type FootWordleTile = {
  letter: string
  status: FootWordleLetterStatus
}

export type FootWordleGuessResult = {
  guess: string
  tiles: FootWordleTile[]
  isCorrect: boolean
  revealedAnswer?: string
}

export type FootWordleGameStatus = 'playing' | 'won' | 'lost'

export type FootWordlePublicPuzzle = {
  dayKey: string
  type: string
  hint: string
  answerLength: number
  maxAttempts: number
  maxPoints: number
}

export type FootWordleStoredGame = {
  dayKey: string
  attempts: number
  guesses: FootWordleGuessResult[]
  status: FootWordleGameStatus
  revealedAnswer?: string
  earnedPoints?: number
  hintUsed?: boolean
}

export type FootWordleStats = {
  playedGames: number
  wonGames: number
  resultsByDay: Record<string, 'won' | 'lost'>
}

export type FootWordleEvaluationResponse =
  | {
      ok: true
      result: FootWordleGuessResult
    }
  | {
      ok: false
      error: string
    }
