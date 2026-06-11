import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { IS_PRODUCTION_MODE } from '@/lib/tournament-config'
import { fetchWC26Fixtures, calculateStandings } from '@/lib/api/football-provider'

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
    db.from('matches').select('id, external_id, team_a, team_b').is('external_id', null),
    db.from('matches').select('id, external_id, team_a, team_b').like('external_id', 'ofb_%'),
  ])

  const legacy = [...(nullResult.data ?? []), ...(ofbResult.data ?? [])]
  if (legacy.length === 0) return null

  const legacyIds = legacy.map((m: { id: string }) => m.id)
  const { data: preds } = await db
    .from('predictions')
    .select('match_id')
    .in('match_id', legacyIds)
    .limit(1)

  if (!preds || preds.length === 0) return null

  const examples = (legacy as { id: string; external_id: string | null; team_a: string; team_b: string }[])
    .slice(0, 3)
    .map(m => `${m.team_a} – ${m.team_b} (${m.external_id ?? 'brak external_id'})`)
    .join(', ')

  return (
    `Synchronizacja zablokowana: znaleziono ${legacy.length} meczów ze starym ` +
    `external_id (NULL lub ofb_*) z przypisanymi typami użytkowników — np. ${examples}. ` +
    `Usuń lub zmigruj te mecze ręcznie w Supabase zanim uruchomisz synchronizację worldcup26.ir.`
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

  const fixtures = await fetchWC26Fixtures()
  if (!fixtures || fixtures.length === 0) {
    const msg = 'worldcup26.ir API niedostępne lub brak danych'
    console.error('[sync-wc26]', msg)
    await db.from('sync_logs').insert({
      sync_type: 'wc26',
      status: 'error',
      records_updated: 0,
      message: msg,
    })
    return NextResponse.json({ error: msg }, { status: 502 })
  }

  try {
    const matchRows = fixtures.map(f => ({
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

    const { error: matchErr } = await db
      .from('matches')
      .upsert(matchRows, { onConflict: 'external_id' })

    if (matchErr) throw matchErr

    // Calculate standings directly from fetched fixtures — no second API call needed
    const standings = calculateStandings(fixtures)
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

    if (fixtures.some(f => f.status === 'finished')) {
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

    const msg = `Zsynchronizowano ${fixtures.length} meczów${standings.length ? `, ${standings.length} wpisów tabeli` : ''} z worldcup26.ir`
    await db.from('sync_logs').insert({
      sync_type: 'wc26',
      status: 'success',
      records_updated: fixtures.length,
      message: msg,
    })

    console.log('[sync-wc26]', msg)
    return NextResponse.json({ message: msg, count: fixtures.length, standings_count: standings.length })
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
  const { data } = await db
    .from('sync_logs')
    .select('created_at, status, message, records_updated')
    .eq('sync_type', 'wc26')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({ last_sync: data ?? null })
}

export async function POST(req: NextRequest) {
  if (!await isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return runSync(req)
}
