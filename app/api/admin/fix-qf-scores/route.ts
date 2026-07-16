import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// TEMPORARY — one-off fix: set score_a/score_b to NULL for scheduled QF matches
// that were seeded with score=0 instead of NULL. Delete after use.

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
  const QF_EXT_IDS = ['wc26_97', 'wc26_98', 'wc26_99', 'wc26_100']

  const results: Array<{ external_id: string; ok: boolean; error?: string }> = []

  for (const extId of QF_EXT_IDS) {
    const { error } = await db
      .from('matches')
      .update({ score_a: null, score_b: null })
      .eq('external_id', extId)
      .eq('status', 'scheduled')
    results.push({ external_id: extId, ok: !error, error: error?.message })
  }

  return NextResponse.json({ results })
}
