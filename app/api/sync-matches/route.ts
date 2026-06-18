import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { IS_PRODUCTION_MODE } from '@/lib/tournament-config'
import { checkFootballConfig, fetchFixtures, fetchWC26Fixtures } from '@/lib/api/football-provider'

export const maxDuration = 60

const WC26_SYNC_TIMEOUT_MS = 30_000

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
    // Jeśli WC26-mecze już są w bazie, nie rób fallbacku na OFB — to tworzy duplikaty
    const { count: wc26Count } = await db
      .from('matches')
      .select('id', { count: 'exact', head: true })
      .like('external_id', 'wc26_%')

    let fixtures
    let skippedNewFixtures = 0
    if ((wc26Count ?? 0) > 0) {
      // Baza ma już dane WC26 — używaj wyłącznie WC26, bez OFB fallbacku
      fixtures = await fetchWC26Fixtures({ timeoutMs: WC26_SYNC_TIMEOUT_MS })
      if (!fixtures || fixtures.length === 0) {
        const msg = 'worldcup26.ir odpowiada za wolno albo nie zwrocilo danych w limicie 30s. Sync mecze pomija OFB fallback, bo baza ma juz wc26_*.'
        console.warn('[sync-matches]', msg)
        await db.from('sync_logs').insert({ sync_type: 'matches', status: 'error', records_updated: 0, message: msg })
        return NextResponse.json({ error: msg }, { status: 503 })
      }

      const fetchedCount = fixtures.length
      const { data: existing, error: existingErr } = await db
        .from('matches')
        .select('external_id')
        .like('external_id', 'wc26_%')
        .or('is_archived.is.null,is_archived.eq.false')

      if (existingErr) throw existingErr
      const existingIds = new Set((existing ?? []).map(m => m.external_id).filter(Boolean))
      fixtures = fixtures.filter(f => existingIds.has(f.external_id))
      skippedNewFixtures = fetchedCount - fixtures.length
    } else {
      fixtures = await fetchFixtures()
    }

    const rows = fixtures.map(f => ({
      external_id: f.external_id,
      team_a: f.team_a,
      team_b: f.team_b,
      team_a_code: f.team_a_code,
      team_b_code: f.team_b_code,
      match_date: f.match_date,
      official_match_day: f.official_match_day,
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
      message: `Zsynchronizowano ${rows.length} meczow${skippedNewFixtures ? `, pominieto ${skippedNewFixtures} nowych z API` : ''}`,
    })

    console.log(`[sync-matches] upserted ${rows.length} fixtures`)
    return NextResponse.json({
      message: `Zsynchronizowano ${rows.length} meczow`,
      count: rows.length,
      skipped_new_fixtures: skippedNewFixtures,
    })
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
