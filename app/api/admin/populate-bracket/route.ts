import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { populateBracketFromStandings, advanceBracketWinners } from '@/lib/bracket-populate'

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
  const db = createAdminClient()

  const [populateResult, advanceResult] = await Promise.all([
    populateBracketFromStandings(db),
    advanceBracketWinners(db),
  ])

  const errors = [...populateResult.errors, ...advanceResult.errors]

  const parts: string[] = []
  if (populateResult.updated > 0) parts.push(`uzupełniono ${populateResult.updated} meczów KO z grup`)
  if (populateResult.skipped > 0) parts.push(`pominięto ${populateResult.skipped} (grupy niegotowe lub już wypełnione)`)
  if (advanceResult.advanced > 0) parts.push(`awansowano ${advanceResult.advanced} zwycięzców`)

  const message = parts.length > 0
    ? parts.join(', ') + '.'
    : 'Brak zmian — grupy niegotowe, brak zakończonych meczów lub wszystko już wypełnione.'

  return NextResponse.json({
    message,
    updated: populateResult.updated,
    skipped: populateResult.skipped,
    advanced: advanceResult.advanced,
    errors,
  })
}

export async function GET(req: NextRequest) { return POST(req) }
