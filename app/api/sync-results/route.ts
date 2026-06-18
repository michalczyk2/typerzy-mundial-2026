import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { IS_PRODUCTION_MODE } from '@/lib/tournament-config'
import { checkFootballConfig, fetchWC26Fixtures } from '@/lib/api/football-provider'

export const maxDuration = 60

const WC26_RESULTS_TIMEOUT_MS = 30_000

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
    console.log('[sync-results] mock mode — no-op')
    return NextResponse.json({ message: 'Tryb lokalny — brak synchronizacji' })
  }

  const db = createAdminClient()
  const configCheck = checkFootballConfig()

  if (!configCheck.ok) {
    console.error('[sync-results] brak konfiguracji:', configCheck.error)
    await db.from('sync_logs').insert({
      sync_type: 'results',
      status: 'error',
      records_updated: 0,
      message: configCheck.error,
    })
    return NextResponse.json({ error: configCheck.error }, { status: 400 })
  }

  try {
    const fixtures = await fetchWC26Fixtures({ timeoutMs: WC26_RESULTS_TIMEOUT_MS })
    if (!fixtures || fixtures.length === 0) {
      const msg = 'worldcup26.ir odpowiada za wolno albo nie zwrocilo danych w limicie 30s. Sync wynikow nie uzywa fallbacku OFB, zeby nie mieszac wc26_* i ofb_*. Sprobuj ponownie albo wpisz wynik recznie w Adminie i uruchom Przelicz punkty.'
      console.error('[sync-results]', msg)
      await db.from('sync_logs').insert({
        sync_type: 'results',
        status: 'error',
        records_updated: 0,
        message: msg,
      })
      return NextResponse.json({ error: msg }, { status: 503 })
    }

    const relevant = fixtures.filter(f => ['live', 'finished'].includes(f.status))

    let updated = 0
    for (const f of relevant) {
      if (!f.external_id) continue
      const { error, count } = await db
        .from('matches')
        .update({
          status: f.status,
          score_a: f.score_a,
          score_b: f.score_b,
          halftime_a: f.halftime_a,
          halftime_b: f.halftime_b,
        }, { count: 'exact' })
        .eq('external_id', f.external_id)
        .like('external_id', 'wc26_%')
        .or('is_archived.is.null,is_archived.eq.false')
      if (!error) updated += count ?? 0
      else console.error('[sync-results] update error for', f.external_id, error.message)
    }

    const message = `Zaktualizowano ${updated} wynikow z worldcup26.ir`
    await db.from('sync_logs').insert({
      sync_type: 'results',
      status: 'success',
      records_updated: updated,
      message,
    })

    // Trigger point recalculation for finished matches
    if (updated > 0 && relevant.some(f => f.status === 'finished')) {
      const baseUrl = new URL(req.url).origin
      const recalcHeaders: Record<string, string> = { 'content-type': 'application/json' }
      const cronSecret = process.env.CRON_SECRET
      if (cronSecret) {
        recalcHeaders['authorization'] = `Bearer ${cronSecret}`
      } else {
        const sessionId = req.cookies.get('typerzy_session')?.value
        if (sessionId) recalcHeaders['cookie'] = `typerzy_session=${sessionId}`
      }
      const recalcRes = await fetch(`${baseUrl}/api/recalculate-points`, {
        method: 'POST',
        headers: recalcHeaders,
      })
      if (!recalcRes.ok) {
        console.error('[sync-results] recalculate-points failed:', recalcRes.status)
      }
    }

    console.log(`[sync-results] updated ${updated} results`)
    return NextResponse.json({ message, count: updated, source_count: relevant.length })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[sync-results]', msg)
    await db.from('sync_logs').insert({
      sync_type: 'results',
      status: 'error',
      records_updated: 0,
      message: msg.slice(0, 500),
    })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  return POST(req)
}
