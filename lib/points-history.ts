import { calculateMatchPoints, SCORING_DEFAULTS } from './scoring'
import type { PredictionResult } from '@/types'

// Pure, read-only reconstruction of "what points were given for" per match/per bonus.
// Reuses calculateMatchPoints() (lib/scoring.ts) for the classic/double-chance label only —
// correctness flags (is_correct_outcome/is_correct_score) are trusted from the DB, not recomputed.

// calculateMatchPoints's optional params are inferred as literal types (e.g. `3`, `5`) since
// lib/scoring.ts has no explicit annotations there. This is normally masked because the
// untyped Supabase client makes call-site values `any` elsewhere. Widen locally via a
// type-only cast — same function, no behavior change, no edit to lib/scoring.ts.
const calcMatchPoints = calculateMatchPoints as (
  pA: number, pB: number, sA: number, sB: number,
  outcomePoints?: number, exactScorePoints?: number,
  predictedResult?: PredictionResult,
) => { points: number; is_correct_outcome: boolean; is_correct_score: boolean }

export type PointsHistoryMatch = {
  id: string
  team_a: string
  team_b: string
  score_a: number
  score_b: number
  match_date: string
  round: number
}

export type PointsHistoryPred = {
  user_id: string
  match_id: string
  predicted_a: number
  predicted_b: number
  predicted_result: string | null
  points_earned: number
  is_correct_outcome: boolean
  is_correct_score: boolean
}

export type PointsHistoryBonus = {
  user_id: string
  match_id: string | null
  round: number | null
  bonus_type: string
  points: number
  description: string
  created_at: string
}

export type PointsHistoryModEvent = {
  match_id: string
  selected_bonus_points: number
}

export type PointsHistoryData = {
  matches: PointsHistoryMatch[]
  predictions: PointsHistoryPred[]
  bonuses: PointsHistoryBonus[]
  modEvents: PointsHistoryModEvent[]
}

export type PointsHistoryComponent = { label: string; points: number }

export type MatchHistoryEntry = {
  kind: 'match'
  key: string
  sortDate: string
  userId: string
  matchId: string
  teamA: string
  teamB: string
  scoreA: number
  scoreB: number
  predictedA: number
  predictedB: number
  components: PointsHistoryComponent[]
  total: number
  hasModBonus: boolean
}

export type BonusHistoryEntry = {
  kind: 'bonus'
  key: string
  sortDate: string
  userId: string
  round: number | null
  label: string
  points: number
}

export type PointsHistoryEntry = MatchHistoryEntry | BonusHistoryEntry

const BONUS_LABELS: Record<string, string> = {
  perfect_round: 'Perfekcyjna kolejka',
  streak_3: 'Passa x3',
  streak_5: 'Passa x5',
  risky_pick: 'Idealny typ',
  tournament_winner: 'Zwycięzca turnieju',
  round_king: 'Król kolejki',
}

function bonusLabel(bonusType: string): string {
  return BONUS_LABELS[bonusType] ?? `Bonus: ${bonusType}`
}

export function buildPointsHistory(
  data: PointsHistoryData,
  outcomePoints: number = SCORING_DEFAULTS.outcome_points.value,
  exactScorePoints: number = SCORING_DEFAULTS.exact_score_points.value,
): PointsHistoryEntry[] {
  const matchMap = new Map(data.matches.map(m => [m.id, m]))
  const modBonusMap = new Map(data.modEvents.map(e => [e.match_id, e.selected_bonus_points]))

  // Bonuses tied to a single match (e.g. risky_pick) get nested into that match's entry.
  // Bonuses tied only to a round (e.g. perfect_round) become standalone chronological entries.
  const matchBonuses = new Map<string, PointsHistoryBonus[]>()
  const roundBonuses: PointsHistoryBonus[] = []
  for (const b of data.bonuses) {
    if (b.match_id) {
      const k = `${b.user_id}:${b.match_id}`
      if (!matchBonuses.has(k)) matchBonuses.set(k, [])
      matchBonuses.get(k)!.push(b)
    } else {
      roundBonuses.push(b)
    }
  }

  const entries: PointsHistoryEntry[] = []

  for (const pred of data.predictions) {
    const match = matchMap.get(pred.match_id)
    if (!match) continue

    const { points: basePoints } = calcMatchPoints(
      pred.predicted_a, pred.predicted_b, match.score_a, match.score_b,
      outcomePoints, exactScorePoints,
      pred.predicted_result as PredictionResult | undefined,
    )

    const isDoubleChance = pred.predicted_result === 'home_or_draw' || pred.predicted_result === 'away_or_draw'
    const components: PointsHistoryComponent[] = []

    if (pred.is_correct_outcome) {
      components.push({
        label: isDoubleChance ? 'Szansa podwójna' : 'Trafiony zwycięzca',
        points: isDoubleChance ? 1 : outcomePoints,
      })
    }
    if (pred.is_correct_score) {
      components.push({ label: 'Dokładny wynik', points: exactScorePoints })
    }

    // Same condition recalculate-points uses to decide whether MOD bonus applied: modBonus && basePoints > 0
    const modBonus = modBonusMap.get(pred.match_id)
    const hasModBonus = Boolean(modBonus && basePoints > 0)
    if (hasModBonus) {
      components.push({ label: 'Mecz Dnia', points: modBonus as number })
    }

    for (const b of matchBonuses.get(`${pred.user_id}:${pred.match_id}`) ?? []) {
      components.push({ label: bonusLabel(b.bonus_type), points: b.points })
    }

    const total = components.reduce((s, c) => s + c.points, 0)

    entries.push({
      kind: 'match',
      key: `m:${pred.match_id}:${pred.user_id}`,
      sortDate: match.match_date,
      userId: pred.user_id,
      matchId: pred.match_id,
      teamA: match.team_a,
      teamB: match.team_b,
      scoreA: match.score_a,
      scoreB: match.score_b,
      predictedA: pred.predicted_a,
      predictedB: pred.predicted_b,
      components,
      total,
      hasModBonus,
    })
  }

  for (const b of roundBonuses) {
    entries.push({
      kind: 'bonus',
      key: `b:${b.user_id}:${b.round}:${b.bonus_type}:${b.created_at}`,
      sortDate: b.created_at,
      userId: b.user_id,
      round: b.round,
      label: bonusLabel(b.bonus_type),
      points: b.points,
    })
  }

  return entries.sort((a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime())
}
