import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Prediction } from '@/types'

export async function GET(req: NextRequest) {
  const sessionId = req.cookies.get('typerzy_session')?.value
  if (!sessionId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const db = createAdminClient()
    const { data, error } = await db
      .from('predictions')
      .select('*')
      .eq('user_id', sessionId)
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const predictions: Prediction[] = (data ?? []).map(row => ({
      id: row.id,
      user_id: row.user_id,
      match_id: row.match_id,
      predicted_a: row.predicted_a,
      predicted_b: row.predicted_b,
      predicted_result: row.predicted_result,
      predicted_winner: row.predicted_winner ?? null,
      points_earned: row.points_earned ?? 0,
      is_correct_outcome: row.is_correct_outcome ?? false,
      is_correct_score: row.is_correct_score ?? false,
      is_locked: row.is_locked ?? false,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }))

    return NextResponse.json({ predictions })
  } catch (err) {
    console.error('[data/predictions GET]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
