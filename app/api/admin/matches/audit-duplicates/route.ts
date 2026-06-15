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

// GET /api/admin/matches/audit-duplicates
// Returns duplicate match pairs: legacy (NULL or ofb_*) vs canonical (wc26_*).
export async function GET(req: NextRequest) {
  if (!IS_PRODUCTION_MODE) {
    return NextResponse.json({ duplicates: [], message: 'Tryb lokalny' })
  }

  if (!await isAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createAdminClient()

  const [legacyRes, canonicalRes] = await Promise.all([
    db.from('matches')
      .select('id, external_id, team_a, team_b, official_match_day, match_date, round, group_name, data_source')
      .or('external_id.is.null,external_id.like.ofb_%')
      .neq('is_archived', true),
    db.from('matches')
      .select('id, external_id, team_a, team_b, official_match_day, match_date, round, group_name')
      .like('external_id', 'wc26_%')
      .neq('is_archived', true),
  ])

  const legacy = legacyRes.data ?? []
  const canonical = canonicalRes.data ?? []

  type DuplicatePair = {
    legacyId: string
    legacyExt: string | null
    legacyTeamA: string
    legacyTeamB: string
    legacyDay: string
    legacyRound: number
    legacyGroup: string | null
    legacySource: string
    canonicalId: string
    canonicalExt: string
    canonicalDay: string
  }

  const duplicates: DuplicatePair[] = []

  for (const leg of legacy) {
    const legDay = (leg.official_match_day as string | null)
      ?? new Date(leg.match_date as string).toISOString().slice(0, 10)

    for (const can of canonical) {
      const canDay = (can.official_match_day as string | null)
        ?? new Date(can.match_date as string).toISOString().slice(0, 10)

      const nameMatch =
        (leg.team_a as string).toLowerCase() === (can.team_a as string).toLowerCase() &&
        (leg.team_b as string).toLowerCase() === (can.team_b as string).toLowerCase()

      const dayDiff = Math.abs(
        new Date(legDay).getTime() - new Date(canDay).getTime()
      ) / 86_400_000

      if (nameMatch && dayDiff <= 1) {
        duplicates.push({
          legacyId: leg.id as string,
          legacyExt: leg.external_id as string | null,
          legacyTeamA: leg.team_a as string,
          legacyTeamB: leg.team_b as string,
          legacyDay: legDay,
          legacyRound: leg.round as number,
          legacyGroup: leg.group_name as string | null,
          legacySource: leg.data_source as string,
          canonicalId: can.id as string,
          canonicalExt: can.external_id as string,
          canonicalDay: canDay,
        })
      }
    }
  }

  return NextResponse.json({
    duplicates,
    count: duplicates.length,
    legacyTotal: legacy.length,
    message: duplicates.length === 0
      ? 'Brak duplikatów — dane są czyste.'
      : `Znaleziono ${duplicates.length} par duplikatów.`,
  })
}
