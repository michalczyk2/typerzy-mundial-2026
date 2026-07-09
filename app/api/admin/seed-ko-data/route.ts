import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// TEMPORARY — one-off KO data seeding; delete after use

async function isAuthorized(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && auth === `Bearer ${cronSecret}`) return true
  const sessionId = req.cookies.get('typerzy_session')?.value
  if (!sessionId) return false
  try {
    const db = createAdminClient()
    const { data } = await db.from('profiles').select('role').eq('id', sessionId).single()
    return data?.role === 'admin'
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  if (!await isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createAdminClient()
  const log: Record<string, unknown> = {}

  // KROK 1 — UPDATE winner dla zakończonych R16
  const r16Winners = [
    { external_id: 'wc26_89', winner: 'France' },
    { external_id: 'wc26_94', winner: 'Belgium' },
    { external_id: 'wc26_95', winner: 'Argentina' },
  ]
  log.r16_winner = []
  for (const u of r16Winners) {
    const { error } = await db.from('matches').update({ winner: u.winner }).eq('external_id', u.external_id)
    ;(log.r16_winner as unknown[]).push({ external_id: u.external_id, winner: u.winner, ok: !error, error: error?.message })
  }

  // KROK 2 — UPSERT 4 meczów ćwierćfinału
  // Daty jako UTC (PL = UTC+2): 22:00→20:00, 21:00→19:00, 23:00→21:00, 03:00→01:00
  const qfMatches = [
    {
      external_id: 'wc26_97',  phase: 'quarterfinal',
      team_a: 'France',    team_b: 'Morocco',      team_a_code: 'fr',  team_b_code: 'ma',
      home_placeholder: 'Zwycięzca meczu 89', away_placeholder: 'Zwycięzca meczu 90',
      match_date: '2026-07-09T20:00:00Z', status: 'scheduled',
      score_a: 0, score_b: 0, halftime_a: null, halftime_b: null,
      round: 1, group_name: null, data_source: 'manual', is_archived: false,
    },
    {
      external_id: 'wc26_98',  phase: 'quarterfinal',
      team_a: 'Spain',     team_b: 'Belgium',      team_a_code: 'es',  team_b_code: 'be',
      home_placeholder: 'Zwycięzca meczu 93', away_placeholder: 'Zwycięzca meczu 94',
      match_date: '2026-07-10T19:00:00Z', status: 'scheduled',
      score_a: 0, score_b: 0, halftime_a: null, halftime_b: null,
      round: 1, group_name: null, data_source: 'manual', is_archived: false,
    },
    {
      external_id: 'wc26_99',  phase: 'quarterfinal',
      team_a: 'Norway',    team_b: 'England',      team_a_code: 'no',  team_b_code: 'gb-eng',
      home_placeholder: 'Zwycięzca meczu 91', away_placeholder: 'Zwycięzca meczu 92',
      match_date: '2026-07-11T21:00:00Z', status: 'scheduled',
      score_a: 0, score_b: 0, halftime_a: null, halftime_b: null,
      round: 1, group_name: null, data_source: 'manual', is_archived: false,
    },
    {
      external_id: 'wc26_100', phase: 'quarterfinal',
      team_a: 'Argentina', team_b: 'Switzerland',  team_a_code: 'ar',  team_b_code: 'ch',
      home_placeholder: 'Zwycięzca meczu 95', away_placeholder: 'Zwycięzca meczu 96',
      match_date: '2026-07-12T01:00:00Z', status: 'scheduled',
      score_a: 0, score_b: 0, halftime_a: null, halftime_b: null,
      round: 1, group_name: null, data_source: 'manual', is_archived: false,
    },
  ]
  log.qf_upserts = []
  for (const match of qfMatches) {
    const { error } = await db.from('matches').upsert(match, { onConflict: 'external_id' })
    ;(log.qf_upserts as unknown[]).push({ external_id: match.external_id, ok: !error, error: error?.message })
  }

  // KROK 3 — UPSERT 2 meczów półfinału (bez drużyn — zostaną wypełnione kaskadowo)
  const sfMatches = [
    {
      external_id: 'wc26_101', phase: 'semifinal',
      team_a: '', team_b: '', team_a_code: '', team_b_code: '',
      home_placeholder: 'Zwycięzca meczu 97', away_placeholder: 'Zwycięzca meczu 98',
      match_date: '2026-07-14T19:00:00Z', status: 'scheduled',
      score_a: null, score_b: null, halftime_a: null, halftime_b: null,
      round: 1, group_name: null, data_source: 'manual', is_archived: false,
    },
    {
      external_id: 'wc26_102', phase: 'semifinal',
      team_a: '', team_b: '', team_a_code: '', team_b_code: '',
      home_placeholder: 'Zwycięzca meczu 99', away_placeholder: 'Zwycięzca meczu 100',
      match_date: '2026-07-15T19:00:00Z', status: 'scheduled',
      score_a: null, score_b: null, halftime_a: null, halftime_b: null,
      round: 1, group_name: null, data_source: 'manual', is_archived: false,
    },
  ]
  log.sf_upserts = []
  for (const match of sfMatches) {
    const { error } = await db.from('matches').upsert(match, { onConflict: 'external_id' })
    ;(log.sf_upserts as unknown[]).push({ external_id: match.external_id, ok: !error, error: error?.message })
  }

  return NextResponse.json(log)
}
