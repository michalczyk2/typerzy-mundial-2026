import { NextResponse } from 'next/server'
import { IS_PRODUCTION_MODE } from '@/lib/tournament-config'
import { createAdminClient } from '@/lib/supabase/admin'

export type DCLeaderboardEntry = {
  user_id: string
  nick: string
  total_dc_points: number
  games_played: number
}

export async function GET() {
  if (!IS_PRODUCTION_MODE) {
    return NextResponse.json({ entries: [] })
  }

  try {
    const supabase = createAdminClient()

    const { data: dcRows, error: dcError } = await supabase
      .from('daily_challenge_points')
      .select('user_id, points')

    if (dcError) {
      return NextResponse.json({ entries: [] })
    }

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, nick')
      .eq('status', 'active')
      .neq('role', 'admin')

    if (profilesError) {
      return NextResponse.json({ entries: [] })
    }

    const aggregated = new Map<string, { total: number; games: number }>()
    for (const row of (dcRows ?? [])) {
      const existing = aggregated.get(row.user_id) ?? { total: 0, games: 0 }
      aggregated.set(row.user_id, { total: existing.total + row.points, games: existing.games + 1 })
    }

    const entries: DCLeaderboardEntry[] = (profiles ?? [])
      .map(profile => {
        const agg = aggregated.get(profile.id) ?? { total: 0, games: 0 }
        return {
          user_id: profile.id,
          nick: profile.nick,
          total_dc_points: agg.total,
          games_played: agg.games,
        }
      })
      .sort((a, b) => b.total_dc_points - a.total_dc_points)

    return NextResponse.json({ entries })
  } catch {
    return NextResponse.json({ entries: [] })
  }
}
