import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  console.log('[push/subscribe] body:', JSON.stringify(await req.clone().json().catch(() => 'parse error')))
  console.log('[push/subscribe] session:', req.cookies.get('typerzy_session')?.value ? 'OK' : 'BRAK')
  const sessionId = req.cookies.get('typerzy_session')?.value
  if (!sessionId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { endpoint, keys } = body as {
      endpoint: string
      keys: { p256dh: string; auth: string }
    }

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json({ error: 'Invalid subscription object' }, { status: 400 })
    }

    const db = createAdminClient()

    const { data: profile } = await db
      .from('profiles')
      .select('id, status')
      .eq('id', sessionId)
      .single()

    if (!profile || profile.status !== 'active') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { error } = await db.from('push_subscriptions').upsert(
      {
        user_id: sessionId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,endpoint' }
    )

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[push/subscribe]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
