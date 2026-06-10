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
    const fixtures = await fetchFixtures()
    const relevant = fixtures.filter(f => ['live', 'finished'].includes(f.status))

    let updated = 0
    for (const f of relevant) {
      if (!f.external_id) continue
      const { error } = await db
        .from('matches')
        .update({
          status: f.status,
          score_a: f.score_a,
          score_b: f.score_b,
          halftime_a: f.halftime_a,
          halftime_b: f.halftime_b,
        })
        .eq('external_id', f.external_id)
      if (!error) updated++
      else console.error('[sync-results] update error for', f.external_id, error.message)
    }

    await db.from('sync_logs').insert({
      sync_type: 'results',
      status: 'success',
      records_updated: updated,
      message: `Zaktualizowano ${updated} wyników`,
    })

    // Trigger point recalculation for finished matches
    if (relevant.some(f => f.status === 'finished')) {
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
    return NextResponse.json({ message: `Zaktualizowano ${updated} wyników`, count: updated })
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
