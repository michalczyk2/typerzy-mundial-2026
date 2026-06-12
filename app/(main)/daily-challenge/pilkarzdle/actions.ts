'use server'

import { evaluatePilkarzdleGuessOnServer } from '@/lib/pilkarzdle'

export async function evaluatePilkarzdleGuess(playerId: string, dayKey: string, attemptNumber: number) {
  return evaluatePilkarzdleGuessOnServer(playerId, dayKey, attemptNumber)
}
