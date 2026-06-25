'use server'

import { evaluateTransferdleGuessOnServer } from '@/lib/transferdle'

export async function evaluateTransferdleGuess(guessedName: string, dayKey: string, attemptNumber: number) {
  return evaluateTransferdleGuessOnServer(guessedName, dayKey, attemptNumber)
}
