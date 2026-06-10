import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { IS_PRODUCTION_MODE } from '@/lib/tournament-config'
import { checkFootballConfig, fetchFixtures } from '@/lib/api/football-provider'

async function isAuthorized(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && auth === `Bearer ${cronSecret}`) return true

  const sessionId = req.cookies.get('typerzy_session')?.value
  if (!sessionId) return false
  const db = createAdminClient()
  const { data } = await db.from('profiles').select('role').eq('id', sessionId).single()
  return data?.role === 'admin'
}

export async function POST(req: NextRequest) {
  if (!await isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!IS_PRODUCTION_MODE) {
    console.log('[sync-matches] mock mode — no-op')
    return NextResponse.json({ message: 'Tryb lokalny — brak synchronizacji' })
  }

  const db = createAdminClient()
  const configCheck = checkFootballConfig()

  if (!configCheck.ok) {
    console.error('[sync-matches] brak konfiguracji:', configCheck.error)
    await db.from('sync_logs').insert({
      sync_type: 'matches',
      status: 'error',
      records_updated: 0,
      message: configCheck.error,
    })
    return NextResponse.json({ error: configCheck.error }, { status: 400 })
  }

  try {
    const fixtures = await fetchFixtures()

    const rows = fixtures.map(f => ({
      external_id: f.external_id,
      team_a: f.team_a,
      team_b: f.team_b,
      team_a_code: f.team_a_code,
      team_b_code: f.team_b_code,
      match_date: f.match_date,
      status: f.status,
      score_a: f.score_a,
      score_b: f.score_b,
      halftime_a: f.halftime_a,
      halftime_b: f.halftime_b,
      phase: f.phase,
      group_name: f.group_name,
      round: f.round,
      stadium: f.stadium,
      city: f.city,
      data_source: 'api' as const,
    }))

    const { error } = await db
      .from('matches')
      .upsert(rows, { onConflict: 'external_id' })

    if (error) throw error

    await db.from('sync_logs').insert({
      sync_type: 'matches',
      status: 'success',
      records_updated: rows.length,
      message: `Zsynchronizowano ${rows.length} meczów`,
    })

    console.log(`[sync-matches] upserted ${rows.length} fixtures`)
    return NextResponse.json({ message: `Zsynchronizowano ${rows.length} meczów`, count: rows.length })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[sync-matches]', msg)
    await db.from('sync_logs').insert({
      sync_type: 'matches',
      status: 'error',
      records_updated: 0,
      message: msg.slice(0, 500),
    })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// Legacy GET support for Vercel cron
export async function GET(req: NextRequest) {
  return POST(req)
}
