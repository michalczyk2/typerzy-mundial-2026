import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// TEMPORARY — one-off seed for 3rd-place and Final teams. Delete after use.

async function requireAdmin(req: NextRequest) {
  const sessionId = req.cookies.get('typerzy_session')?.value
  if (!sessionId) return false
  const db = createAdminClient()
  const { data } = await db.from('profiles').select('role').eq('id', sessionId).single()
  return data?.role === 'admin'
}

export async function POST(req: NextRequest) {
  if (!await requireAdmin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const db = createAdminClient()

  const updates = [
    {
      external_id: 'wc26_103',
      team_a: 'France', team_b: 'England',
      team_a_code: 'fr', team_b_code: 'gb-eng',
      score_a: null, score_b: null, status: 'scheduled', winner: null,
    },
    {
      external_id: 'wc26_104',
      team_a: 'Spain', team_b: 'Argentina',
      team_a_code: 'es', team_b_code: 'ar',
      score_a: null, score_b: null, status: 'scheduled', winner: null,
    },
  ]

  const results: Array<{ external_id: string; ok: boolean; error?: string }> = []

  for (const { external_id, ...fields } of updates) {
    const { error } = await db.from('matches').update(fields).eq('external_id', external_id)
    results.push({ external_id, ok: !error, error: error?.message })
  }

  return NextResponse.json({ results })
}
