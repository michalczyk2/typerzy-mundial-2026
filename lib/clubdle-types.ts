export type ClubdleComparisonStatus = 'correct' | 'close' | 'wrong'

export type ClubdleGameStatus = 'playing' | 'won' | 'lost'

export type ClubdleFieldId = 'country' | 'league' | 'stadium' | 'founded' | 'capacity' | 'ucl' | 'domestic'

export type ClubdleClubOption = {
  id: string
  name: string
}

export type ClubdleGuessField = {
  id: ClubdleFieldId
  label: string
  value: string
  status: ClubdleComparisonStatus
  hint?: string
}

export type ClubdleGuessResult = {
  clubId: string
  name: string
  fields: ClubdleGuessField[]
  isCorrect: boolean
  revealedAnswer?: string
}

export type ClubdlePublicPuzzle = {
  dayKey: string
  maxAttempts: number
  maxPoints: number
  candidates: ClubdleClubOption[]
}

export type ClubdleStoredGame = {
  dayKey: string
  attempts: number
  guesses: ClubdleGuessResult[]
  status: ClubdleGameStatus
  revealedAnswer?: string
  earnedPoints?: number
  startedAt?: string
  completedAt?: string
}

export type ClubdleStats = {
  playedGames: number
  wonGames: number
  resultsByDay: Record<string, 'won' | 'lost'>
}

export type ClubdleEvaluationResponse =
  | { ok: true; result: ClubdleGuessResult }
  | { ok: false; error: string }
