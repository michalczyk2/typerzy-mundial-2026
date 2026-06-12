import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { IS_PRODUCTION_MODE } from '@/lib/tournament-config'
import { SCORING_DEFAULTS } from '@/lib/scoring'

async function isAdmin(req: NextRequest): Promise<boolean> {
  const sessionId = req.cookies.get('typerzy_session')?.value
  if (!sessionId) return false
  const db = createAdminClient()
  const { data } = await db.from('profiles').select('role').eq('id', sessionId).single()
  return data?.role === 'admin'
}

export async function GET(req: NextRequest) {
  if (!await isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!IS_PRODUCTION_MODE) return NextResponse.json({ picks: [], enabled: true })

  const db = createAdminClient()

  const [picksRes, settingRes] = await Promise.all([
    db.from('tournament_winner_predictions')
      .select('id, user_id, team_code, team_name, locked_at, is_correct, created_at, profiles!inner(nick)')
      .order('created_at'),
    db.from('scoring_settings').select('value').eq('key', 'champion_prediction_enabled').single(),
  ])

  const picks = (picksRes.data ?? []).map((p: Record<string, unknown>) => ({
    id: p.id,
    user_id: p.user_id,
    team_code: p.team_code,
    team_name: p.team_name,
    locked_at: p.locked_at,
    is_correct: p.is_correct,
    created_at: p.created_at,
    nick: (p.profiles as Record<string, unknown> | null)?.nick,
  }))

  const enabled = (settingRes.data?.value ?? 1) === 1
  return NextResponse.json({ picks, enabled })
}

export async function PATCH(req: NextRequest) {
  if (!await isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!IS_PRODUCTION_MODE) return NextResponse.json({ message: 'Tryb lokalny — brak efektu' })

  const body = await req.json().catch(() => ({}))
  const { action, team_code } = body as { action?: string; team_code?: string }
  const db = createAdminClient()

  if (action === 'toggle') {
    const { data: setting } = await db
      .from('scoring_settings').select('value').eq('key', 'champion_prediction_enabled').single()
    const newValue = (setting?.value ?? 1) === 1 ? 0 : 1
    await db.from('scoring_settings')
      .update({ value: newValue, updated_at: new Date().toISOString() })
      .eq('key', 'champion_prediction_enabled')
    return NextResponse.json({ enabled: newValue === 1 })
  }

  if (action === 'set_winner') {
    if (!team_code?.trim()) return NextResponse.json({ error: 'Brakuje team_code' }, { status: 400 })
    const code = team_code.trim()

    await db.from('tournament_winner_predictions').update({ is_correct: false })
    await db.from('tournament_winner_predictions').update({ is_correct: true }).eq('team_code', code)

    const { data: winners } = await db
      .from('tournament_winner_predictions')
      .select('user_id')
      .eq('team_code', code)

    if (!winners?.length) return NextResponse.json({ winners: 0 })

    const { data: bonusSetting } = await db
      .from('scoring_settings').select('value').eq('key', 'tournament_winner_bonus').single()
    const bonusPoints = bonusSetting?.value ?? SCORING_DEFAULTS.tournament_winner_bonus.value

    let awarded = 0
    for (const winner of winners) {
      const { data: existing } = await db
        .from('bonus_points')
        .select('id')
        .eq('user_id', winner.user_id)
        .eq('bonus_type', 'tournament_winner')
        .single()
      if (existing) continue

      await db.from('bonus_points').insert({
        user_id: winner.user_id,
        match_id: null,
        round: null,
        bonus_type: 'tournament_winner',
        points: bonusPoints,
        description: `Trafiony mistrz turnieju: ${code}`,
      })

      const { data: profile } = await db
        .from('profiles')
        .select('bonus_points_total, total_points')
        .eq('id', winner.user_id)
        .single()

      if (profile) {
        await db.from('profiles').update({
          bonus_points_total: (profile.bonus_points_total ?? 0) + bonusPoints,
          total_points: (profile.total_points ?? 0) + bonusPoints,
          updated_at: new Date().toISOString(),
        }).eq('id', winner.user_id)
      }

      awarded++
    }

    return NextResponse.json({ winners: awarded })
  }

  return NextResponse.json({ error: 'Nieznana akcja' }, { status: 400 })
}
