export type UserRole = 'admin' | 'user'
export type UserStatus = 'pending' | 'active' | 'blocked'
export type MatchStatus = 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled'
export type MatchPhase = 'group' | 'round_of_32' | 'round_of_16' | 'quarterfinal' | 'semifinal' | 'third_place' | 'final'
export type DataSource = 'api' | 'manual' | 'mock'
export type PredictionResult = 'home' | 'draw' | 'away' | 'home_or_draw' | 'away_or_draw'
export type FormEffect = 'hot' | 'sniper' | 'cold' | 'storm' | 'curse' | 'wooden' | 'var' | 'none'
export type FormEffectOverride = 'auto' | FormEffect
export type FormDisplayMode = 'off' | 'badge_only' | 'badge_and_title' | 'full_effects'
export type FormStyleVariant = 'light' | 'sport' | 'premium' | 'game' | 'strong'

export interface FormVisualSettings {
  display_mode: FormDisplayMode
  style_variant: FormStyleVariant
}

export interface MatchEvent {
  minute: number
  type: 'goal' | 'yellow_card' | 'red_card' | 'substitution'
  team: 'home' | 'away'
  player: string
}

export interface MatchStats {
  possession_home: number
  possession_away: number
  shots_home: number
  shots_away: number
  shots_on_target_home: number
  shots_on_target_away: number
  corners_home: number
  corners_away: number
  fouls_home: number
  fouls_away: number
  yellow_cards_home: number
  yellow_cards_away: number
  red_cards_home: number
  red_cards_away: number
}

export interface User {
  id: string
  nick: string
  role: UserRole
  status: UserStatus
  total_points: number
  match_points: number
  bonus_points: number
  predictions_count: number
  correct_outcomes: number
  correct_scores: number
  current_streak: number
  best_streak: number
  tournament_winner_pick: string | null
  form_effect_override: FormEffectOverride
  custom_form_title: string | null
  admin_note?: string | null
  created_at: string
}

export interface Match {
  id: string
  api_id: string | null
  external_id?: string | null
  phase: MatchPhase
  group_name: string | null
  round: number
  match_date: string
  official_match_day?: string | null
  stadium: string | null
  city: string | null
  team_a: string
  team_b: string
  team_a_code: string
  team_b_code: string
  status: MatchStatus
  score_a: number | null
  score_b: number | null
  score_a_90?: number | null
  score_b_90?: number | null
  halftime_a: number | null
  halftime_b: number | null
  data_source: DataSource
  last_synced_at: string | null
  created_at: string
  is_archived?: boolean | null
  winner?: string | null
  bracket_position?: string | null
  home_placeholder?: string | null
  away_placeholder?: string | null
  winner_goes_to_match_id?: string | null
  loser_goes_to_match_id?: string | null
  referee?: string | null
  events?: MatchEvent[] | null
  stats?: MatchStats | null
}

export interface Prediction {
  id: string
  user_id: string
  match_id: string
  predicted_a: number
  predicted_b: number
  predicted_result: PredictionResult
  points_earned: number
  is_correct_outcome: boolean
  is_correct_score: boolean
  is_locked: boolean
  created_at: string
  updated_at: string
  is_admin_override?: boolean
  admin_override_reason?: string | null
  admin_override_by?: string | null
  admin_override_at?: string | null
  predicted_winner?: string | null
}

export interface TournamentWinnerPrediction {
  id: string
  user_id: string
  team_code: string
  team_name: string
  points: number | null
  locked_at: string | null
  is_correct: boolean | null
  created_at: string
  updated_at: string
}

export interface BonusPoint {
  id: string
  user_id: string
  match_id: string | null
  round: number | null
  bonus_type: 'round_king' | 'streak_3' | 'streak_5' | 'risky_pick' | 'tournament_winner' | 'perfect_round'
  points: number
  description: string
  created_at: string
}

export interface Standing {
  id: string
  group_name: string
  team: string
  team_code: string
  played: number
  won: number
  drawn: number
  lost: number
  goals_for: number
  goals_against: number
  goal_difference: number
  points: number
  position: number
  updated_at: string
}

export interface SyncLog {
  id: string
  sync_type: 'matches' | 'results' | 'standings' | 'points' | 'wc26'
  status: 'success' | 'error' | 'partial'
  records_updated: number
  message: string
  created_at: string
}

export interface AccessCode {
  id: string
  code: string
  is_active: boolean
  created_at: string
}

export interface LeaderboardEntry extends User {
  position: number
  is_leader: boolean
  is_last: boolean
}

export interface LastPrediction {
  is_correct_score: boolean
  is_correct_outcome: boolean
  points_earned: number
}

export interface MatchWithPrediction extends Match {
  my_prediction?: Prediction
  predictions?: Prediction[]
}

// --- Finance module (private betting tracker) ---
export type BetStatus = 'pending' | 'won' | 'lost' | 'cashout' | 'void'
export type TransactionType = 'deposit' | 'withdrawal'

export interface Bet {
  id: string
  user_id: string
  date: string
  sport: string
  league: string
  event_name: string
  bet_type: string
  bookmaker: string
  stake: number
  odds: number
  status: BetStatus
  cash_out_amount?: number | null
  payout: number
  profit: number
  note?: string | null
  created_at: string
  updated_at: string
}

export interface BettingTransaction {
  id: string
  user_id: string
  type: TransactionType
  amount: number
  date: string
  note?: string | null
  created_at: string
}

export interface BettingSettings {
  id?: string
  user_id?: string
  starting_balance: number
  manual_current_balance?: number | null
  monthly_loss_limit?: number | null
  created_at?: string
  updated_at?: string
}

// --- Match of Day ---
export interface MatchOfDayEvent {
  id: string
  official_match_day: string  // YYYY-MM-DD
  match_id: string
  vote_deadline: string       // ISO 8601
  selected_bonus_points: number | null
  status: 'voting' | 'locked' | 'settled'
  created_at: string
  updated_at: string
}

export interface MatchOfDayVote {
  id: string
  event_id: string
  user_id: string
  bonus_points: 1 | 2 | 3 | 4
  created_at: string
  updated_at: string
}

// --- Super Social ---
export interface SuperSocialPlayerPrediction {
  user_id: string
  nick: string
  predicted_a: number | null
  predicted_b: number | null
  predicted_result: string | null
  predicted_winner: string | null
  points_earned: number | null
  is_correct_outcome: boolean | null
  is_correct_score: boolean | null
}

export interface SuperSocialMatch {
  id: string
  team_a: string
  team_b: string
  team_a_code: string
  team_b_code: string
  match_date: string
  status: MatchStatus
  score_a: number | null
  score_b: number | null
  round: number
  phase: MatchPhase
  group_name: string | null
  winner: string | null
  predictions: SuperSocialPlayerPrediction[]
}

export interface SuperSocialResponse {
  matches: SuperSocialMatch[]
  players: { user_id: string; nick: string }[]
}
