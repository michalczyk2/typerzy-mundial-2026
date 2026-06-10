import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { IS_PRODUCTION_MODE } from '@/lib/tournament-config'

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

  try {
    const db = createAdminClient()
    await db.from('sync_logs').insert({
      sync_type: 'matches',
      status: 'skipped',
      records_updated: 0,
      message: 'API meczowe nie skonfigurowane — sync pominięty',
    })
    return NextResponse.json({ message: 'API meczowe nie skonfigurowane — sync pominięty' })
  } catch (err) {
    console.error('[sync-matches]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// Legacy GET support for Vercel cron
export async function GET(req: NextRequest) {
  return POST(req)
}
