import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { IS_PRODUCTION_MODE } from '@/lib/tournament-config'

async function isAdmin(req: NextRequest): Promise<boolean> {
  const sessionId = req.cookies.get('typerzy_session')?.value
  if (!sessionId) return false
  const db = createAdminClient()
  const { data } = await db.from('profiles').select('role').eq('id', sessionId).single()
  return data?.role === 'admin'
}

// POST /api/admin/matches/archive
// Body: { match_id: string, archived: boolean }
// Archives or unarchives a single match. Does NOT migrate predictions.
// Use migrations/004_deduplicate_matches.sql to migrate predictions before archiving.
export async function POST(req: NextRequest) {
  if (!IS_PRODUCTION_MODE) {
    return NextResponse.json({ error: 'Tylko w trybie produkcyjnym' }, { status: 400 })
  }

  if (!await isAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const { match_id, archived } = body as { match_id?: string; archived?: boolean }

  if (!match_id || typeof archived !== 'boolean') {
    return NextResponse.json({ error: 'Wymagane: match_id (string) i archived (boolean)' }, { status: 400 })
  }

  const db = createAdminClient()

  const { data: match, error: fetchErr } = await db
    .from('matches')
    .select('id, team_a, team_b, external_id, is_archived')
    .eq('id', match_id)
    .single()

  if (fetchErr || !match) {
    return NextResponse.json({ error: 'Mecz nie znaleziony' }, { status: 404 })
  }

  const { error: updateErr } = await db
    .from('matches')
    .update({ is_archived: archived })
    .eq('id', match_id)

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  const action = archived ? 'zarchiwizowano' : 'przywrócono z archiwum'
  return NextResponse.json({
    success: true,
    matchId: match_id,
    teamA: match.team_a,
    teamB: match.team_b,
    archived,
    message: `${match.team_a} vs ${match.team_b} — ${action}.`,
  })
}
