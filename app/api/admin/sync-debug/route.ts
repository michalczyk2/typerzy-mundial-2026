import { NextRequest, NextResponse } from 'next/server'
import { IS_PRODUCTION_MODE } from '@/lib/tournament-config'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchOpenfootballFixtures } from '@/lib/api/football-provider'

// TEMPORARY DIAGNOSTIC ENDPOINT — remove after the sync issue is diagnosed
// Returns step-by-step results so the exact failure point is visible.

async function isAuthorized(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && auth === `Bearer ${cronSecret}`) return true
  const sessionId = req.cookies.get('typerzy_session')?.value
  if (!sessionId) return false
  try {
    const db = createAdminClient()
    const { data } = await db.from('profiles').select('role').eq('id', sessionId).single()
    return data?.role === 'admin'
  } catch {
    return false
  }
}

export async function GET(req: NextRequest) {
  if (!await isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: Record<string, unknown> = {}

  // 1. IS_PRODUCTION_MODE
  results.is_production_mode = IS_PRODUCTION_MODE

  // 2. Env vars present (values redacted)
  results.env_vars = {
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    CRON_SECRET: !!process.env.CRON_SECRET,
    SUPABASE_URL_VALUE_PREFIX: process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 30) ?? 'NOT SET',
  }

  // 3. createAdminClient()
  try {
    const db = createAdminClient()
    results.create_admin_client = 'OK'

    // 4. Simple DB query
    try {
      const { count, error } = await db
        .from('sync_logs')
        .select('*', { count: 'exact', head: true })
        .eq('sync_type', 'wc26')
      if (error) throw error
      results.db_query_sync_logs = { ok: true, count }
    } catch (e) {
      results.db_query_sync_logs = { ok: false, error: e instanceof Error ? e.message : String(e) }
    }

    // 5. Last sync_log entry
    try {
      const { data, error } = await db
        .from('sync_logs')
        .select('created_at, status, message, records_updated')
        .eq('sync_type', 'wc26')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      results.last_sync_log = data
    } catch (e) {
      results.last_sync_log = { error: e instanceof Error ? e.message : String(e) }
    }

    // 6. Active wc26 match count
    try {
      const { count, error } = await db
        .from('matches')
        .select('*', { count: 'exact', head: true })
        .like('external_id', 'wc26_%')
        .neq('is_archived', true)
      if (error) throw error
      results.active_wc26_matches = count
    } catch (e) {
      results.active_wc26_matches = { error: e instanceof Error ? e.message : String(e) }
    }

    // 7. ALL non-group KO matches — full picture of bracket state (team_a_code included)
    try {
      const { data, error } = await db
        .from('matches')
        .select('id, external_id, phase, team_a, team_b, team_a_code, team_b_code, home_placeholder, away_placeholder, status, score_a, score_b, match_date, winner')
        .like('external_id', 'wc26_%')
        .neq('phase', 'group')
        .or('is_archived.is.null,is_archived.eq.false')
        .order('match_date', { ascending: true })
      if (error) throw error
      results.ko_all_matches = data

      // Equivalent of: WHERE team_a IS NULL OR team_a = '' OR team_b IS NULL OR team_b = ''
      type Row = Record<string, string | null>
      results.ko_empty_team_slots = (data ?? []).filter(
        (m: Row) => !m.team_a || !m.team_b
      )
      // Separately: missing codes even when team name is set
      results.ko_missing_codes = (data ?? []).filter(
        (m: Row) => (m.team_a && !m.team_a_code) || (m.team_b && !m.team_b_code)
      )
    } catch (e) {
      results.ko_all_matches = { error: e instanceof Error ? e.message : String(e) }
      results.ko_empty_team_slots = []
      results.ko_missing_codes = []
    }

  } catch (e) {
    results.create_admin_client = { error: e instanceof Error ? e.message : String(e) }
  }

  // 8. Openfootball connectivity (no DB needed)
  try {
    const fixtures = await fetchOpenfootballFixtures()
    const koFinished = (fixtures ?? []).filter(f => f.phase !== 'group' && f.status === 'finished')
    results.openfootball = {
      ok: fixtures !== null,
      total: fixtures?.length ?? 0,
      ko_finished: koFinished.length,
      sample: koFinished.slice(0, 3).map(f => `${f.team_a} ${f.score_a}–${f.score_b} ${f.team_b} [${f.phase}]`),
    }
  } catch (e) {
    results.openfootball = { ok: false, error: e instanceof Error ? e.message : String(e) }
  }

  return NextResponse.json(results)
}
