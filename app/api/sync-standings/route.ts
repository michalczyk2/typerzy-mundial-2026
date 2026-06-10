import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { IS_PRODUCTION_MODE } from '@/lib/tournament-config'
import { checkFootballConfig, fetchStandings } from '@/lib/api/football-provider'

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
    console.log('[sync-standings] mock mode — no-op')
    return NextResponse.json({ message: 'Tryb lokalny — brak synchronizacji' })
  }

  const db = createAdminClient()
  const configCheck = checkFootballConfig()

  if (!configCheck.ok) {
    console.error('[sync-standings] brak konfiguracji:', configCheck.error)
    await db.from('sync_logs').insert({
      sync_type: 'standings',
      status: 'error',
      records_updated: 0,
      message: configCheck.error,
    })
    return NextResponse.json({ error: configCheck.error }, { status: 400 })
  }

  try {
    const standings = await fetchStandings()

    const rows = standings.map(s => ({
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
    }))

    const { error } = await db
      .from('standings')
      .upsert(rows, { onConflict: 'group_name,team_code' })

    if (error) throw error

    await db.from('sync_logs').insert({
      sync_type: 'standings',
      status: 'success',
      records_updated: rows.length,
      message: `Zsynchronizowano ${rows.length} wpisów tabeli`,
    })

    console.log(`[sync-standings] upserted ${rows.length} standings`)
    return NextResponse.json({ message: `Zsynchronizowano ${rows.length} wpisów tabeli`, count: rows.length })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[sync-standings]', msg)
    await db.from('sync_logs').insert({
      sync_type: 'standings',
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
