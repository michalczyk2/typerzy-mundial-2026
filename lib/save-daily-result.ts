'use server'

import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { IS_PRODUCTION_MODE } from '@/lib/tournament-config'

export async function saveDailyResult(gameType: string, dayKey: string, points: number): Promise<void> {
  if (!IS_PRODUCTION_MODE) return
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get('typerzy_session')?.value
    if (!userId) return
    const supabase = createAdminClient()
    await supabase.from('daily_challenge_points').upsert(
      { user_id: userId, game_type: gameType, day_key: dayKey, points },
      { onConflict: 'user_id,game_type,day_key' }
    )
  } catch {
    // silent — localStorage already holds the result
  }
}
