import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { IS_PRODUCTION_MODE } from '@/lib/tournament-config'
import { MOCK_PREDICTIONS } from '@/lib/mock-data'
import type { LastPrediction } from '@/types'

// Public endpoint — no authentication required.
// Returns the last 5 LOCKED predictions per user for leaderboard display.
// is_locked=false (active picks before match starts) are NEVER included.

function groupLast5(rows: { user_id: string; is_correct_outcome: boolean; is_correct_score: boolean; points_earned: number }[]): Record<string, LastPrediction[]> {
  const byUser: Record<string, LastPrediction[]> = {}
  for (const p of rows) {
    if (!byUser[p.user_id]) byUser[p.user_id] = []
    byUser[p.user_id].push({
      is_correct_score: p.is_correct_score,
      is_correct_outcome: p.is_correct_outcome,
      points_earned: p.points_earned,
    })
  }
  for (const uid in byUser) byUser[uid] = byUser[uid].slice(-5)
  return byUser
}

export async function GET() {
  if (!IS_PRODUCTION_MODE) {
    const locked = MOCK_PREDICTIONS
      .filter(p => p.is_locked)
      .map(p => ({
        user_id: p.user_id,
        is_correct_outcome: p.is_correct_outcome,
        is_correct_score: p.is_correct_score,
        points_earned: p.points_earned,
      }))
    return NextResponse.json({ last_predictions: groupLast5(locked) })
  }

  try {
    const db = createAdminClient()
    const { data, error } = await db
      .from('predictions')
      .select('user_id, is_correct_outcome, is_correct_score, points_earned')
      .eq('is_locked', true)
      .order('created_at', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ last_predictions: groupLast5(data ?? []) })
  } catch (err) {
    console.error('[data/last-predictions GET]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
