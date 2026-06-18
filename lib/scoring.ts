import type { PredictionResult } from '@/types'

export const SCORING_DEFAULTS = {
  outcome_points:          { label: 'Trafiona końcówka',    value: 3,  description: 'Punkty za trafiony wynik meczu (W/R/P)' },
  exact_score_points:      { label: 'Dokładny wynik',        value: 5,  description: 'Punkty za dokładny wynik meczu (łącznie max 8 pkt)' },
  perfect_round_bonus:     { label: 'Perfekcyjna kolejka',   value: 5,  description: 'Bonus za trafienie wszystkich meczów w kolejce grupowej' },
  streak_3_bonus:          { label: 'Passa x3',              value: 2,  description: 'Bonus za 3 trafne typy z rzędu' },
  streak_5_bonus:          { label: 'Passa x5',              value: 5,  description: 'Bonus za 5 trafnych typów z rzędu' },
  risky_pick_bonus:        { label: 'Idealny typ',           value: 2,  description: 'Bonus dla jedynego gracza z idealnym typem klasycznym (8 pkt)' },
  tournament_winner_bonus: { label: 'Zwycięzca turnieju',    value: 20, description: 'Bonus za trafienie mistrza turnieju przed startem' },
} as const

export function calculateMatchPoints(
  pA: number, pB: number, sA: number, sB: number,
  outcomePoints = SCORING_DEFAULTS.outcome_points.value,
  exactScorePoints = SCORING_DEFAULTS.exact_score_points.value,
  predictedResult?: PredictionResult,
) {
  const ar = sA > sB ? 'home' : sA < sB ? 'away' : 'draw'
  const pr: PredictionResult = predictedResult ?? (pA > pB ? 'home' : pA < pB ? 'away' : 'draw')
  const isDoubleChance = pr === 'home_or_draw' || pr === 'away_or_draw'
  const scoreSide = pA > pB ? 'home' : pA < pB ? 'away' : 'draw'

  let is_correct_outcome: boolean
  if (pr === 'home_or_draw') {
    is_correct_outcome = ar === 'home' || ar === 'draw'
  } else if (pr === 'away_or_draw') {
    is_correct_outcome = ar === 'away' || ar === 'draw'
  } else {
    is_correct_outcome = pr === ar
  }

  // Double chance: the exact-score bonus only counts when the typed score itself
  // falls within the selected range — otherwise predicted_result contradicts the typed score.
  const isConsistent = !isDoubleChance || scoreSide === 'draw' || scoreSide === (pr === 'home_or_draw' ? 'home' : 'away')
  const is_correct_score = isConsistent && pA === sA && pB === sB
  let points = 0
  if (is_correct_outcome) points += isDoubleChance ? 1 : outcomePoints
  if (is_correct_score) points += exactScorePoints
  return { points, is_correct_outcome, is_correct_score }
}
export function calculateRiskyPick(correctUserIds: string[]): string[] {
  return correctUserIds.length === 1 ? correctUserIds : []
}
export function calculateRoundKing(pointsByUser: Record<string, number>): string[] {
  const max = Math.max(...Object.values(pointsByUser))
  if (max === 0) return []
  return Object.entries(pointsByUser).filter(([,p]) => p === max).map(([id]) => id)
}
