import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { IS_PRODUCTION_MODE } from '@/lib/tournament-config'

export async function POST(req: NextRequest) {
  if (!IS_PRODUCTION_MODE) return NextResponse.json({ message: 'Mock mode' })

  const sessionId = req.cookies.get('typerzy_session')?.value
  if (!sessionId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const db = createAdminClient()
  const { data: profile } = await db.from('profiles').select('role').eq('id', sessionId).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { match_id, winner } = body as { match_id?: string; winner?: string }
  if (!match_id || !winner) {
    return NextResponse.json({ error: 'Brak match_id lub winner' }, { status: 400 })
  }

  const { data: match, error: matchErr } = await db
    .from('matches')
    .select('id, team_a, team_b, phase')
    .eq('id', match_id)
    .single()
  if (matchErr || !match) return NextResponse.json({ error: 'Mecz nie znaleziony' }, { status: 404 })
  if (match.phase === 'group') return NextResponse.json({ error: 'Tylko mecze fazy KO' }, { status: 400 })

  // Set winner on match
  const { error: updateErr } = await db.from('matches').update({ winner }).eq('id', match_id)
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  // Find predictions that picked this winner
  const { data: preds } = await db
    .from('predictions')
    .select('id, user_id')
    .eq('match_id', match_id)
    .eq('predicted_winner', winner)

  let awarded = 0
  for (const pred of preds ?? []) {
    // Insert bonus_points record
    const { error: bonusErr } = await db.from('bonus_points').insert({
      user_id: pred.user_id,
      match_id,
      round: null,
      bonus_type: 'ko_winner_pick',
      points: 2,
      description: `Trafiony awansujący (${winner})`,
    })
    if (bonusErr) continue

    // Increment profile's bonus_points_total and total_points
    const { data: p } = await db
      .from('profiles')
      .select('bonus_points_total, total_points')
      .eq('id', pred.user_id)
      .single()
    if (p) {
      await db.from('profiles').update({
        bonus_points_total: (p.bonus_points_total ?? 0) + 2,
        total_points: (p.total_points ?? 0) + 2,
      }).eq('id', pred.user_id)
    }
    awarded++
  }

  return NextResponse.json({
    ok: true,
    match_id,
    winner,
    total_picks: (preds ?? []).length,
    awarded,
  })
}
