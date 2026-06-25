'use server'

import { evaluateQuotedleGuessOnServer } from '@/lib/quotedle'

export async function evaluateQuotedleGuess(guessedName: string, dayKey: string, attemptNumber: number) {
  return evaluateQuotedleGuessOnServer(guessedName, dayKey, attemptNumber)
}
