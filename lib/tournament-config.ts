export const TOURNAMENT_NAME = 'FIFA World Cup 2026'
export const TOURNAMENT_START_DATE = '2026-06-11'
export const TOURNAMENT_END_DATE = '2026-07-19'
export const EXPECTED_MATCHES_COUNT = 104
export const DEFAULT_ACCESS_CODE = 'TYPERZY2026'

// True when real Supabase credentials are set (not placeholder values)
export const IS_PRODUCTION_MODE = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/^https:\/\/[a-z0-9]+\.supabase\.co$/)
)
