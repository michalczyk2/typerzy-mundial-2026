export const SCORING_DEFAULTS = {
  outcome_points:          { label: 'Trafiona końcówka',    value: 3,  description: 'Punkty za trafiony wynik meczu (W/R/P)' },
  exact_score_points:      { label: 'Dokładny wynik',        value: 5,  description: 'Punkty za dokładny wynik meczu (łącznie max 8 pkt)' },
  round_winner_bonus:      { label: 'Król kolejki',          value: 3,  description: 'Bonus dla gracza z największą liczbą punktów w kolejce' },
  streak_3_bonus:          { label: 'Passa x3',              value: 2,  description: 'Bonus za 3 trafne typy z rzędu' },
  streak_5_bonus:          { label: 'Passa x5',              value: 5,  description: 'Bonus za 5 trafnych typów z rzędu' },
  risky_pick_bonus:        { label: 'Ryzykowny typ',         value: 2,  description: 'Bonus dla jedynego gracza, który trafił wynik meczu' },
  tournament_winner_bonus: { label: 'Zwycięzca turnieju',    value: 20, description: 'Bonus za trafienie mistrza turnieju przed startem' },
} as const

export function calculateMatchPoints(
  pA: number, pB: number, sA: number, sB: number,
  outcomePoints = SCORING_DEFAULTS.outcome_points.value,
  exactScorePoints = SCORING_DEFAULTS.exact_score_points.value,
) {
  const pr = pA > pB ? 'home' : pA < pB ? 'away' : 'draw'
  const ar = sA > sB ? 'home' : sA < sB ? 'away' : 'draw'
  const is_correct_outcome = pr === ar
  const is_correct_score = pA === sA && pB === sB
  let points = 0
  if (is_correct_outcome) points += outcomePoints
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
