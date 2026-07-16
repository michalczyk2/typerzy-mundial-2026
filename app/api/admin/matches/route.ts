import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function requireAdmin(req: NextRequest) {
  const sessionId = req.cookies.get('typerzy_session')?.value
  if (!sessionId) return null
  const db = createAdminClient()
  const { data } = await db.from('profiles').select('id, role').eq('id', sessionId).single()
  return data?.role === 'admin' ? sessionId : null
}

// PATCH — update match score and/or status (admin only)
export async function PATCH(req: NextRequest) {
  if (!await requireAdmin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  try {
    const { id, score_a, score_b, status, score_a_90, score_b_90 } = await req.json()
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const update: Record<string, unknown> = {}
    // score_a/score_b: undefined = not provided (skip), null = explicitly clear, number = set
    if (score_a !== undefined) update.score_a = score_a ?? null
    if (score_b !== undefined) update.score_b = score_b ?? null
    if (status) update.status = status
    // 90-minute regulation score for KO matches decided in extra time — null clears
    // the override (falls back to score_a/score_b in scoring).
    if (score_a_90 !== undefined) update.score_a_90 = score_a_90
    if (score_b_90 !== undefined) update.score_b_90 = score_b_90

    const db = createAdminClient()
    const { error } = await db.from('matches').update(update).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[admin/matches PATCH]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
