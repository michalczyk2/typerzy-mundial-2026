import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { IS_PRODUCTION_MODE } from '@/lib/tournament-config'

async function getUserId(req: NextRequest): Promise<string | null> {
  const sessionId = req.cookies.get('typerzy_session')?.value
  if (!sessionId) return null
  const db = createAdminClient()
  const { data } = await db.from('profiles').select('id').eq('id', sessionId).single()
  return data?.id ?? null
}

export async function GET(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!IS_PRODUCTION_MODE) {
    return NextResponse.json({ pick: null, enabled: true })
  }

  const db = createAdminClient()

  const [pickRes, settingRes] = await Promise.all([
    db.from('tournament_winner_predictions').select('*').eq('user_id', userId).single(),
    db.from('scoring_settings').select('value').eq('key', 'champion_prediction_enabled').single(),
  ])

  const enabled = (settingRes.data?.value ?? 1) === 1

  return NextResponse.json({ pick: pickRes.data ?? null, enabled })
}

export async function POST(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!IS_PRODUCTION_MODE) {
    return NextResponse.json({ message: 'Tryb lokalny — brak efektu' })
  }

  const db = createAdminClient()

  const { data: setting } = await db
    .from('scoring_settings')
    .select('value')
    .eq('key', 'champion_prediction_enabled')
    .single()

  if ((setting?.value ?? 1) !== 1) {
    return NextResponse.json({ error: 'Typowanie mistrza jest zablokowane' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { team_code, team_name } = body as { team_code?: string; team_name?: string }

  if (!team_code?.trim() || !team_name?.trim()) {
    return NextResponse.json({ error: 'Brakuje team_code lub team_name' }, { status: 400 })
  }

  const { data: existing } = await db
    .from('tournament_winner_predictions')
    .select('id, locked_at')
    .eq('user_id', userId)
    .single()

  if (existing?.locked_at) {
    return NextResponse.json({ error: 'Typ jest zablokowany i nie można go zmienić' }, { status: 403 })
  }

  const now = new Date().toISOString()

  const { error } = await db.from('tournament_winner_predictions').upsert(
    { user_id: userId, team_code: team_code.trim(), team_name: team_name.trim(), updated_at: now },
    { onConflict: 'user_id' },
  )

  if (error) {
    console.error('[champion-prediction] upsert error:', error)
    return NextResponse.json({ error: 'Błąd zapisu' }, { status: 500 })
  }

  await db.from('profiles').update({
    tournament_winner_pick: team_code.trim(),
    updated_at: now,
  }).eq('id', userId)

  return NextResponse.json({ message: 'Zapisano typ mistrza' })
}
