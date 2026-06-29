import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function requireAdmin(req: NextRequest) {
  const sessionId = req.cookies.get('typerzy_session')?.value
  if (!sessionId) return null
  const db = createAdminClient()
  const { data } = await db.from('profiles').select('id, role').eq('id', sessionId).single()
  return data?.role === 'admin' ? sessionId : null
}

// POST — admin-only manual correction of a single player's prediction for a single match.
// Bypasses the normal lock-time check (that's the entire point of this endpoint).
// Does not touch normal player-facing /api/predictions logic or lock behavior.
export async function POST(req: NextRequest) {
  const adminId = await requireAdmin(req)
  if (!adminId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { match_id, user_id, predicted_a, predicted_b, reason, predicted_winner } = body

    if (!match_id || typeof match_id !== 'string') {
      return NextResponse.json({ error: 'Brak match_id' }, { status: 400 })
    }
    if (!user_id || typeof user_id !== 'string') {
      return NextResponse.json({ error: 'Brak user_id' }, { status: 400 })
    }

    const isValidScore = (v: unknown): v is number =>
      typeof v === 'number' && Number.isInteger(v) && v >= 0

    if (!isValidScore(predicted_a) || !isValidScore(predicted_b)) {
      return NextResponse.json(
        { error: 'Wynik typu musi być liczbą całkowitą >= 0' },
        { status: 400 }
      )
    }

    const reasonTrimmed = typeof reason === 'string' ? reason.trim() : ''
    if (reasonTrimmed.length < 3) {
      return NextResponse.json(
        { error: 'Powód korekty jest wymagany (min. 3 znaki)' },
        { status: 400 }
      )
    }

    const db = createAdminClient()

    const { data: match } = await db
      .from('matches')
      .select('id, is_archived')
      .eq('id', match_id)
      .single()
    if (!match) return NextResponse.json({ error: 'Mecz nie istnieje' }, { status: 404 })
    if (match.is_archived) {
      return NextResponse.json({ error: 'Mecz jest zarchiwizowany' }, { status: 400 })
    }

    const { data: targetUser } = await db
      .from('profiles')
      .select('id, status')
      .eq('id', user_id)
      .single()
    if (!targetUser) return NextResponse.json({ error: 'Gracz nie istnieje' }, { status: 404 })
    if (targetUser.status !== 'active') {
      return NextResponse.json({ error: 'Gracz nie jest aktywny' }, { status: 400 })
    }

    const predicted_result = predicted_a > predicted_b ? 'home' : predicted_a < predicted_b ? 'away' : 'draw'

    const { error: upsertErr } = await db
      .from('predictions')
      .upsert(
        {
          user_id,
          match_id,
          predicted_a,
          predicted_b,
          predicted_result,
          predicted_winner: typeof predicted_winner === 'string' ? predicted_winner : null,
          is_admin_override: true,
          admin_override_reason: reasonTrimmed,
          admin_override_by: adminId,
          admin_override_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,match_id' }
      )

    if (upsertErr) {
      return NextResponse.json({ error: upsertErr.message }, { status: 500 })
    }

    // Reuse the existing points recalculation so scoring/bonus logic stays single-source-of-truth.
    const recalcUrl = new URL('/api/recalculate-points', req.url)
    const cookieHeader = req.headers.get('cookie') ?? ''
    const recalcRes = await fetch(recalcUrl, { method: 'POST', headers: { cookie: cookieHeader } })
    const recalcJson = await recalcRes.json().catch(() => ({}))

    return NextResponse.json({
      ok: true,
      recalculated: recalcRes.ok,
      recalcMessage: recalcJson.message ?? recalcJson.error ?? null,
    })
  } catch (err) {
    console.error('[admin/predictions POST]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
