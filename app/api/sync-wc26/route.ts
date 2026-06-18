import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { IS_PRODUCTION_MODE } from '@/lib/tournament-config'
import { fetchWC26Fixtures, calculateStandings } from '@/lib/api/football-provider'

export const maxDuration = 60

const WC26_SYNC_TIMEOUT_MS = 30_000

// Part C — Vercel Cron architecture (ready to activate in vercel.json when needed):
// { "path": "/api/sync-wc26", "schedule": "*/30 12-23 * * *" }  — co 30 min w godz. 12-23 UTC
// { "path": "/api/sync-wc26", "schedule": "0 */2 * * *" }        — co 2 godz. poza dniem meczowym

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

type DbClient = ReturnType<typeof createAdminClient>

async function checkLegacyConflicts(db: DbClient): Promise<string | null> {
  const [nullResult, ofbResult] = await Promise.all([
    db.from('matches').select('id, external_id, team_a, team_b').is('external_id', null).or('is_archived.is.null,is_archived.eq.false'),
    db.from('matches').select('id, external_id, team_a, team_b').like('external_id', 'ofb_%').or('is_archived.is.null,is_archived.eq.false'),
  ])

  const legacy = [...(nullResult.data ?? []), ...(ofbResult.data ?? [])] as {
    id: string
    external_id: string | null
    team_a: string
    team_b: string
  }[]

  if (legacy.length === 0) return null

  const legacyIds = legacy.map(m => m.id)
  const { data: preds } = await db
    .from('predictions')
    .select('match_id')
    .in('match_id', legacyIds)
    .limit(1)

  if (!preds || preds.length === 0) {
    return (
      `Synchronizacja zablokowana: ${legacy.length} aktywnych starych meczow (NULL lub ofb_*) bez typow. ` +
      `Najpierw uruchom Audyt duplikatow i archiwizuj bezpieczne rekordy. Nie wykonano DELETE.`
    )
  }

  const examples = legacy
    .slice(0, 3)
    .map(m => `${m.team_a} – ${m.team_b} (${m.external_id ?? 'null'})`)
    .join(', ')

  return (
    `Synchronizacja zablokowana: ${legacy.length} meczów ze starym external_id (NULL lub ofb_*) ` +
    `ma przypisane typy użytkowników — np. ${examples}. ` +
    `Uruchom migrację 20260614_fix_duplicates.sql (Fazy 1–3) w Supabase, aby przepiąć typy na WC26-mecze i usunąć duplikaty.`
  )
}

async function runSync(req: NextRequest): Promise<NextResponse> {
  if (!IS_PRODUCTION_MODE) {
    return NextResponse.json({ message: 'Tryb lokalny — brak synchronizacji' })
  }

  const db = createAdminClient()

  const conflictMsg = await checkLegacyConflicts(db)
  if (conflictMsg) {
    await db.from('sync_logs').insert({
      sync_type: 'wc26',
      status: 'error',
      records_updated: 0,
      message: conflictMsg,
    })
    return NextResponse.json({ error: conflictMsg }, { status: 409 })
  }

  const fixtures = await fetchWC26Fixtures({ timeoutMs: WC26_SYNC_TIMEOUT_MS })
  if (!fixtures || fixtures.length === 0) {
    const msg = 'worldcup26.ir odpowiada za wolno albo nie zwrocilo danych w limicie 30s. Sprobuj ponownie; nie wykonano zadnych zmian.'
    console.error('[sync-wc26]', msg)
    await db.from('sync_logs').insert({
      sync_type: 'wc26',
      status: 'error',
      records_updated: 0,
      message: msg,
    })
    return NextResponse.json({ error: msg }, { status: 503 })
  }

  try {
    let fixturesToApply = fixtures
    let skippedNewFixtures = 0
    const { data: existingWc26, error: existingErr } = await db
      .from('matches')
      .select('external_id')
      .like('external_id', 'wc26_%')
      .or('is_archived.is.null,is_archived.eq.false')

    if (existingErr) throw existingErr
    const existingIds = new Set((existingWc26 ?? []).map(m => m.external_id).filter(Boolean))
    if (existingIds.size > 0) {
      fixturesToApply = fixtures.filter(f => existingIds.has(f.external_id))
      skippedNewFixtures = fixtures.length - fixturesToApply.length
    }

    const matchRows = fixturesToApply.map(f => ({
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

    if (matchRows.length === 0) {
      const msg = 'worldcup26.ir zwrocilo dane, ale zaden rekord nie pasuje do aktywnych wc26_* w bazie. Nie utworzono nowych meczow.'
      await db.from('sync_logs').insert({
        sync_type: 'wc26',
        status: 'success',
        records_updated: 0,
        message: msg,
      })
      return NextResponse.json({ message: msg, count: 0, skipped_new_fixtures: skippedNewFixtures })
    }

    const { error: matchErr } = await db
      .from('matches')
      .upsert(matchRows, { onConflict: 'external_id' })

    if (matchErr) throw matchErr

    // Calculate standings directly from fetched fixtures — no second API call needed
    const standings = calculateStandings(fixturesToApply)
    if (standings.length > 0) {
      const { error: standErr } = await db
        .from('standings')
        .upsert(
          standings.map(s => ({
            group_name: s.group_name,
            team_code: s.team_code,
            team_name: s.team_name,
            played: s.played,
            won: s.won,
            drawn: s.drawn,
            lost: s.lost,
            goals_for: s.goals_for,
            goals_against: s.goals_against,
            points: s.points,
            position: s.position,
          })),
          { onConflict: 'group_name,team_code' }
        )
      if (standErr) console.error('[sync-wc26] standings upsert:', standErr.message)
    }

    if (fixturesToApply.some(f => f.status === 'finished')) {
      const baseUrl = new URL(req.url).origin
      const recalcHeaders: Record<string, string> = { 'content-type': 'application/json' }
      const cronSecret = process.env.CRON_SECRET
      if (cronSecret) {
        recalcHeaders['authorization'] = `Bearer ${cronSecret}`
      } else {
        const sessionId = req.cookies.get('typerzy_session')?.value
        if (sessionId) recalcHeaders['cookie'] = `typerzy_session=${sessionId}`
      }
      await fetch(`${baseUrl}/api/recalculate-points`, { method: 'POST', headers: recalcHeaders })
        .catch(e => console.error('[sync-wc26] recalculate-points:', e))
    }

    const msg = `Zsynchronizowano ${matchRows.length} istniejacych meczow${standings.length ? `, ${standings.length} wpisow tabeli` : ''} z worldcup26.ir${skippedNewFixtures ? `; pominieto ${skippedNewFixtures} nowych meczow z API` : ''}`
    await db.from('sync_logs').insert({
      sync_type: 'wc26',
      status: 'success',
      records_updated: matchRows.length,
      message: msg,
    })

    console.log('[sync-wc26]', msg)
    return NextResponse.json({
      message: msg,
      count: matchRows.length,
      standings_count: standings.length,
      skipped_new_fixtures: skippedNewFixtures,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[sync-wc26]', msg)
    await db.from('sync_logs').insert({
      sync_type: 'wc26',
      status: 'error',
      records_updated: 0,
      message: msg.slice(0, 500),
    })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// Vercel cron calls GET with CRON_SECRET → run sync
// Admin panel calls GET without CRON_SECRET → return last sync info
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && auth === `Bearer ${cronSecret}`) {
    return runSync(req)
  }

  if (!await isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createAdminClient()
  const [syncLogRes, countRes] = await Promise.all([
    db.from('sync_logs')
      .select('created_at, status, message, records_updated')
      .eq('sync_type', 'wc26')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    db.from('matches')
      .select('*', { count: 'exact', head: true })
      .like('external_id', 'wc26_%')
      .neq('is_archived', true),
  ])

  return NextResponse.json({
    last_sync: syncLogRes.data ?? null,
    active_wc26_count: countRes.count ?? 0,
  })
}

export async function POST(req: NextRequest) {
  if (!await isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return runSync(req)
}
