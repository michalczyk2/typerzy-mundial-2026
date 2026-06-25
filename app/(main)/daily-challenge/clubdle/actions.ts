'use server'

import { evaluateClubdleGuessOnServer } from '@/lib/clubdle'

export async function evaluateClubdleGuess(clubId: string, dayKey: string, attemptNumber: number) {
  return evaluateClubdleGuessOnServer(clubId, dayKey, attemptNumber)
}
