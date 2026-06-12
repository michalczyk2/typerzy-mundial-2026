'use server'

import { evaluateFootWordleGuessOnServer } from '@/lib/footwordle'

export async function evaluateFootWordleGuess(guess: string, dayKey: string, attemptNumber: number) {
  return evaluateFootWordleGuessOnServer(guess, dayKey, attemptNumber)
}
