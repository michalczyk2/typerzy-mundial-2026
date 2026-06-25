export type PilkarzdleComparisonStatus = 'correct' | 'close' | 'wrong'

export type PilkarzdleGameStatus = 'playing' | 'won' | 'lost'

export type PilkarzdleFieldId = 'nationality' | 'position' | 'league' | 'club' | 'age' | 'height' | 'shirtNumber'

export type PilkarzdlePlayerOption = {
  id: string
  name: string
}

export type PilkarzdleGuessField = {
  id: PilkarzdleFieldId
  label: string
  value: string
  status: PilkarzdleComparisonStatus
  hint?: string
}

export type PilkarzdleGuessResult = {
  playerId: string
  name: string
  fields: PilkarzdleGuessField[]
  isCorrect: boolean
  revealedAnswer?: string
}

export type PilkarzdlePublicPuzzle = {
  dayKey: string
  maxAttempts: number
  maxPoints: number
  candidates: PilkarzdlePlayerOption[]
}

export type PilkarzdleStoredGame = {
  dayKey: string
  attempts: number
  guesses: PilkarzdleGuessResult[]
  status: PilkarzdleGameStatus
  revealedAnswer?: string
  earnedPoints?: number
  startedAt?: string
  completedAt?: string
}

export type PilkarzdleStats = {
  playedGames: number
  wonGames: number
  resultsByDay: Record<string, 'won' | 'lost'>
}

export type PilkarzdleEvaluationResponse =
  | {
      ok: true
      result: PilkarzdleGuessResult
    }
  | {
      ok: false
      error: string
    }
