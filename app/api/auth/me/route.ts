import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { User } from '@/types'

export async function GET(req: NextRequest) {
  const sessionId = req.cookies.get('typerzy_session')?.value
  if (!sessionId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const db = createAdminClient()
    const { data: profile } = await db.from('profiles').select('*').eq('id', sessionId).single()
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 401 })
    }
    if (profile.status === 'blocked') {
      return NextResponse.json({ error: 'Blocked' }, { status: 403 })
    }

    const user: User = {
      id: profile.id,
      nick: profile.nick,
      role: profile.role,
      status: profile.status,
      total_points: profile.total_points ?? 0,
      match_points: profile.match_points ?? 0,
      bonus_points: profile.bonus_points_total ?? 0,
      predictions_count: profile.predictions_count ?? 0,
      correct_outcomes: profile.correct_outcomes ?? 0,
      correct_scores: profile.correct_scores ?? 0,
      current_streak: profile.current_streak ?? 0,
      best_streak: profile.best_streak ?? 0,
      tournament_winner_pick: profile.tournament_winner_pick ?? null,
      form_effect_override: profile.form_effect_override ?? 'auto',
      custom_form_title: profile.custom_form_title ?? null,
      created_at: profile.created_at,
    }
    return NextResponse.json({ user })
  } catch (err) {
    console.error('[auth/me]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
