import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { IS_PRODUCTION_MODE } from '@/lib/tournament-config'
import {
  fetchWC26Fixtures,
  fetchOpenfootballFixtures,
  calculateStandings,
  type WC26FetchError,
} from '@/lib/api/football-provider'
import { populateBracketFromStandings } from '@/lib/bracket-populate'

export const maxDuration = 60

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

// Normalize a team name for fuzzy matching: lowercase, no accents, no punctuation, collapse spaces
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Enrich existing wc26_* KO matches from openfootball data (ET scores, penalty winner, status)
async function enrichFromOpenfootball(db: DbClient): Promise<{ enriched: number; errors: string[] }> {
  const ofbFixtures = await fetchOpenfootballFixtures()
  if (!ofbFixtures || ofbFixtures.length === 0) return { enriched: 0, errors: [] }

  const koOfb = ofbFixtures.filter(f => f.phase !== 'group' && f.status === 'finished')
  if (koOfb.length === 0) return { enriched: 0, errors: [] }

  // Build normalized name index for OFB fixtures: "normA|normB" → fixture
  const ofbIndex = new Map<string, typeof koOfb[0]>()
  for (const f of koOfb) {
    const key = `${normalizeName(f.team_a)}|${normalizeName(f.team_b)}`
    ofbIndex.set(key, f)
  }

  // Fetch existing wc26_* KO matches from DB
  const { data: dbMatches, error } = await db
    .from('matches')
    .select('id, external_id, team_a, team_b, status, score_a, score_b')
    .like('external_id', 'wc26_%')
    .neq('phase', 'group')
    .or('is_archived.is.null,is_archived.eq.false')

  if (error) return { enriched: 0, errors: [error.message] }

  let enriched = 0
  const errors: string[] = []

  for (const dbMatch of dbMatches ?? []) {
    if (!dbMatch.team_a || !dbMatch.team_b) continue
    const key = `${normalizeName(dbMatch.team_a)}|${normalizeName(dbMatch.team_b)}`
    const ofb = ofbIndex.get(key)
    if (!ofb) continue

    // Only update if OFB has a finished result that the DB doesn't show yet
    if (dbMatch.status === 'finished' && dbMatch.score_a !== null && dbMatch.score_b !== null) continue

    const updates: Record<string, unknown> = {
      status: 'finished',
      score_a: ofb.score_a,
      score_b: ofb.score_b,
      halftime_a: ofb.halftime_a,
      halftime_b: ofb.halftime_b,
      score_a_90: ofb.score_a_90,
      score_b_90: ofb.score_b_90,
    }
    if (ofb.penalty_winner) {
      updates.winner = ofb.penalty_winner === 'home' ? dbMatch.team_a : dbMatch.team_b
    }

    const { error: upErr } = await db.from('matches').update(updates).eq('id', dbMatch.id)
    if (upErr) errors.push(`${dbMatch.external_id}: ${upErr.message}`)
    else enriched++
  }

  return { enriched, errors }
}

async function runSync(req: NextRequest): Promise<NextResponse> {
  if (!IS_PRODUCTION_MODE) {
    return NextResponse.json({ message: 'Tryb lokalny — brak synchronizacji' })
  }

  // Declare db outside try so catch block can attempt sync_log without calling createAdminClient() again
  let db: DbClient | null = null

  try {
    db = createAdminClient()

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

    let wc26Error: WC26FetchError | null = null as WC26FetchError | null
    const fixtures = await fetchWC26Fixtures(
      { timeoutMs: 30_000 },
      (err) => { wc26Error = err },
    )

    // If WC26 returned nothing, fall back to openfootball enrichment
    if (!fixtures || fixtures.length === 0) {
      const wc26ErrMsg = wc26Error
        ? `worldcup26.ir: ${wc26Error.reason}${wc26Error.httpStatus ? ` (HTTP ${wc26Error.httpStatus})` : ''}`
        : 'worldcup26.ir: brak danych'

      console.error('[sync-wc26]', wc26ErrMsg, '— próbuję openfootball jako fallback')

      // Step 1: fill KO team slots from existing R32 results so OFB can match by team name
      const pre = await populateBracketFromStandings(db)
      if (pre.updated > 0)
        console.log(`[sync-wc26] Pre-OFB bracket: uzupełniono ${pre.updated} slotów`)

      // Step 2: enrich KO results from OFB (R16+ with now-known team names)
      const { enriched, errors: enrichErrors } = await enrichFromOpenfootball(db)

      // Step 3: cascade bracket again — OFB may have added R16 results → fills QF slots
      let postUpdated = 0
      if (enriched > 0 || pre.updated > 0) {
        const post = await populateBracketFromStandings(db)
        postUpdated = post.updated
        if (postUpdated > 0)
          console.log(`[sync-wc26] Post-OFB bracket: uzupełniono ${postUpdated} slotów`)
      }

      const totalFilled = pre.updated + postUpdated
      const parts: string[] = []
      if (enriched > 0) parts.push(`uzupełniono ${enriched} wyników KO z openfootball`)
      if (totalFilled > 0) parts.push(`wypełniono ${totalFilled} slotów drabinki`)
      const msg = `WC26 niedostępne (${wc26ErrMsg})${parts.length ? '. ' + parts.join(', ') + '.' : '. Brak nowych danych.'}`

      const didSomething = enriched > 0 || totalFilled > 0
      await db.from('sync_logs').insert({
        sync_type: 'wc26',
        status: didSomething ? 'success' : 'error',
        records_updated: enriched + totalFilled,
        message: msg.slice(0, 500),
      })

      console.log('[sync-wc26]', msg)
      return NextResponse.json(
        didSomething
          ? { message: msg, wc26_error: wc26ErrMsg, ofb_enriched: enriched, bracket_filled: totalFilled, errors: enrichErrors }
          : { error: wc26ErrMsg, message: msg, wc26_error: wc26ErrMsg, ofb_enriched: 0, errors: enrichErrors },
        { status: didSomething ? 200 : 503 },
      )
    }

    let fixturesToApply = fixtures
    let skippedNewFixtures = 0
    const { data: existingWc26, error: existingErr } = await db
      .from('matches')
      .select('external_id')
      .like('external_id', 'wc26_%')
      .or('is_archived.is.null,is_archived.eq.false')

    if (existingErr) throw existingErr
    const existingIds = new Set((existingWc26 ?? []).map(m => m.external_id).filter(Boolean))
    const groupFixtures = existingIds.size > 0
      ? fixtures.filter(f => f.phase === 'group' && existingIds.has(f.external_id))
      : fixtures.filter(f => f.phase === 'group')
    const koFixtures = fixtures.filter(f => f.phase !== 'group')
    fixturesToApply = [...groupFixtures, ...koFixtures]
    skippedNewFixtures = fixtures.length - fixturesToApply.length

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

    // Also try openfootball to fill in ET/penalty details for KO matches
    const { enriched: ofbEnriched } = await enrichFromOpenfootball(db)
    if (ofbEnriched > 0)
      console.log(`[sync-wc26] OFB enrichment: uzupełniono ET/penalties dla ${ofbEnriched} meczów KO`)

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

    const populateResult = await populateBracketFromStandings(db)
    if (populateResult.updated > 0)
      console.log(`[sync-wc26] Bracket: uzupełniono ${populateResult.updated} meczów KO z grup`)

    const msg = `Zsynchronizowano ${matchRows.length} istniejacych meczow${standings.length ? `, ${standings.length} wpisow tabeli` : ''} z worldcup26.ir${skippedNewFixtures ? `; pominieto ${skippedNewFixtures} nowych meczow z API` : ''}${ofbEnriched ? `; ${ofbEnriched} meczow wzbogaconych z OFB` : ''}`
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
      ofb_enriched: ofbEnriched,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[sync-wc26] CAUGHT:', msg)
    // Best-effort log — db may be null if createAdminClient() itself threw
    if (db) {
      try {
        await db.from('sync_logs').insert({
          sync_type: 'wc26',
          status: 'error',
          records_updated: 0,
          message: msg.slice(0, 500),
        })
      } catch (logErr) {
        console.error('[sync-wc26] sync_logs write failed:', logErr instanceof Error ? logErr.message : logErr)
      }
    } else {
      console.error('[sync-wc26] db client was null — createAdminClient() likely threw. Check SUPABASE env vars.')
    }
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
  try {
    if (!await isAuthorized(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return runSync(req)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[sync-wc26] POST handler error:', msg)
    return NextResponse.json({ error: `Handler error: ${msg}` }, { status: 500 })
  }
}
