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
// Returns:
//  - duplicates: legacy (NULL or ofb_*) + canonical (wc26_*) pairs
//  - orphanedLegacy: active ofb_* with no wc26_* counterpart
export async function GET(req: NextRequest) {
  if (!IS_PRODUCTION_MODE) {
    return NextResponse.json({ duplicates: [], orphanedLegacy: [], message: 'Tryb lokalny' })
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

  type OrphanedMatch = {
    id: string
    externalId: string | null
    teamA: string
    teamB: string
    matchDate: string
    dataSource: string
    predictionsCount: number
    bonusPointsCount: number
    modEventsCount: number
  }

  const duplicates: DuplicatePair[] = []
  const pairedLegacyIds = new Set<string>()

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
        pairedLegacyIds.add(leg.id as string)
      }
    }
  }

  // Orphaned: active legacy matches with no wc26_* counterpart
  const orphanedRaw = legacy.filter(leg => !pairedLegacyIds.has(leg.id as string))
  const orphanedIds = orphanedRaw.map(m => m.id as string)

  let orphanedLegacy: OrphanedMatch[] = []
  if (orphanedIds.length > 0) {
    const [predsRes, bonusRes, modRes] = await Promise.all([
      db.from('predictions').select('match_id').in('match_id', orphanedIds),
      db.from('bonus_points').select('match_id').in('match_id', orphanedIds),
      db.from('match_of_day_events').select('match_id').in('match_id', orphanedIds),
    ])

    const predCounts = new Map<string, number>()
    const bonusCounts = new Map<string, number>()
    const modCounts = new Map<string, number>()

    for (const p of predsRes.data ?? []) {
      const id = p.match_id as string
      predCounts.set(id, (predCounts.get(id) ?? 0) + 1)
    }
    for (const b of bonusRes.data ?? []) {
      const id = b.match_id as string
      bonusCounts.set(id, (bonusCounts.get(id) ?? 0) + 1)
    }
    for (const m of modRes.data ?? []) {
      const id = m.match_id as string
      modCounts.set(id, (modCounts.get(id) ?? 0) + 1)
    }

    orphanedLegacy = orphanedRaw.map(leg => ({
      id: leg.id as string,
      externalId: leg.external_id as string | null,
      teamA: leg.team_a as string,
      teamB: leg.team_b as string,
      matchDate: leg.match_date as string,
      dataSource: leg.data_source as string,
      predictionsCount: predCounts.get(leg.id as string) ?? 0,
      bonusPointsCount: bonusCounts.get(leg.id as string) ?? 0,
      modEventsCount: modCounts.get(leg.id as string) ?? 0,
    }))
  }

  const allOrphanedSafe = orphanedLegacy.every(
    m => m.predictionsCount === 0 && m.bonusPointsCount === 0 && m.modEventsCount === 0
  )

  const msgs = []
  if (duplicates.length > 0) msgs.push(`${duplicates.length} par duplikatów`)
  if (orphanedLegacy.length > 0) msgs.push(`${orphanedLegacy.length} aktywnych ofb_* bez pary`)
  if (msgs.length === 0) msgs.push('Brak problemów')

  return NextResponse.json({
    duplicates,
    orphanedLegacy,
    allOrphanedSafe,
    count: duplicates.length,
    orphanedCount: orphanedLegacy.length,
    legacyTotal: legacy.length,
    message: msgs.join(' · '),
  })
}
