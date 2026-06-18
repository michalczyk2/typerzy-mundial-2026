import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { IS_PRODUCTION_MODE } from '@/lib/tournament-config'

type MatchRow = {
  id: string
  external_id: string | null
  team_a: string
  team_b: string
  official_match_day: string | null
  match_date: string
}

type DuplicatePair = {
  legacy: MatchRow
  canonical: MatchRow
}

async function isAdmin(req: NextRequest): Promise<boolean> {
  const sessionId = req.cookies.get('typerzy_session')?.value
  if (!sessionId) return false
  const db = createAdminClient()
  const { data } = await db.from('profiles').select('role').eq('id', sessionId).single()
  return data?.role === 'admin'
}

function matchDay(match: MatchRow): string {
  return match.official_match_day ?? new Date(match.match_date).toISOString().slice(0, 10)
}

function isDuplicatePair(legacy: MatchRow, canonical: MatchRow): boolean {
  const sameTeams =
    legacy.team_a.toLowerCase() === canonical.team_a.toLowerCase() &&
    legacy.team_b.toLowerCase() === canonical.team_b.toLowerCase()
  const dayDiff = Math.abs(
    new Date(matchDay(legacy)).getTime() - new Date(matchDay(canonical)).getTime()
  ) / 86_400_000

  return sameTeams && dayDiff <= 1
}

function countByMatch(rows: { match_id: string }[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const row of rows) {
    counts.set(row.match_id, (counts.get(row.match_id) ?? 0) + 1)
  }
  return counts
}

// POST /api/admin/matches/archive-safe-duplicates
// Re-audits active ofb_* -> wc26_* duplicate pairs, then archives only safe ofb_* rows.
export async function POST(req: NextRequest) {
  if (!IS_PRODUCTION_MODE) {
    return NextResponse.json({ error: 'Tylko w trybie produkcyjnym' }, { status: 400 })
  }

  if (!await isAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createAdminClient()

  const [legacyRes, canonicalRes] = await Promise.all([
    db.from('matches')
      .select('id, external_id, team_a, team_b, official_match_day, match_date')
      .like('external_id', 'ofb_%')
      .neq('is_archived', true),
    db.from('matches')
      .select('id, external_id, team_a, team_b, official_match_day, match_date')
      .like('external_id', 'wc26_%')
      .neq('is_archived', true),
  ])

  if (legacyRes.error) {
    return NextResponse.json({ error: legacyRes.error.message }, { status: 500 })
  }
  if (canonicalRes.error) {
    return NextResponse.json({ error: canonicalRes.error.message }, { status: 500 })
  }

  const legacy = (legacyRes.data ?? []) as MatchRow[]
  const canonical = (canonicalRes.data ?? []) as MatchRow[]
  const pairs: DuplicatePair[] = []

  for (const oldMatch of legacy) {
    const newMatch = canonical.find(match => isDuplicatePair(oldMatch, match))
    if (newMatch) pairs.push({ legacy: oldMatch, canonical: newMatch })
  }

  const legacyIds = pairs.map(pair => pair.legacy.id)
  if (legacyIds.length === 0) {
    return NextResponse.json({
      success: true,
      archived: 0,
      auditedPairs: 0,
      message: 'Brak aktywnych bezpiecznych duplikatów ofb_* do archiwizacji.',
    })
  }

  const [predsRes, bonusRes, modRes] = await Promise.all([
    db.from('predictions').select('match_id').in('match_id', legacyIds),
    db.from('bonus_points').select('match_id').in('match_id', legacyIds),
    db.from('match_of_day_events').select('match_id').in('match_id', legacyIds),
  ])

  if (predsRes.error) {
    return NextResponse.json({ error: predsRes.error.message }, { status: 500 })
  }
  if (bonusRes.error) {
    return NextResponse.json({ error: bonusRes.error.message }, { status: 500 })
  }
  if (modRes.error) {
    return NextResponse.json({ error: modRes.error.message }, { status: 500 })
  }

  const predCounts = countByMatch((predsRes.data ?? []) as { match_id: string }[])
  const bonusCounts = countByMatch((bonusRes.data ?? []) as { match_id: string }[])
  const modCounts = countByMatch((modRes.data ?? []) as { match_id: string }[])

  const violations = pairs
    .map(pair => ({
      legacyId: pair.legacy.id,
      legacyExt: pair.legacy.external_id,
      canonicalId: pair.canonical.id,
      canonicalExt: pair.canonical.external_id,
      teamA: pair.legacy.team_a,
      teamB: pair.legacy.team_b,
      day: matchDay(pair.legacy),
      predictionsCount: predCounts.get(pair.legacy.id) ?? 0,
      bonusPointsCount: bonusCounts.get(pair.legacy.id) ?? 0,
      modEventsCount: modCounts.get(pair.legacy.id) ?? 0,
    }))
    .filter(row =>
      row.predictionsCount !== 0 ||
      row.bonusPointsCount !== 0 ||
      row.modEventsCount !== 0
    )

  if (violations.length > 0) {
    return NextResponse.json({
      error: 'Archiwizacja zablokowana: część rekordów ofb_* ma powiązane dane.',
      auditedPairs: pairs.length,
      violationCount: violations.length,
      violations,
    }, { status: 409 })
  }

  const { data: archivedRows, error: updateErr } = await db
    .from('matches')
    .update({ is_archived: true })
    .in('id', legacyIds)
    .like('external_id', 'ofb_%')
    .neq('is_archived', true)
    .select('id')

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    archived: archivedRows?.length ?? 0,
    auditedPairs: pairs.length,
    message: `Zarchiwizowano ${archivedRows?.length ?? 0}/${pairs.length} bezpiecznych duplikatów ofb_*.`,
  })
}
