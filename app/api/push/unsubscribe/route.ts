import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const sessionId = req.cookies.get('typerzy_session')?.value
  if (!sessionId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { endpoint } = body as { endpoint?: string }

    const db = createAdminClient()

    if (endpoint) {
      await db
        .from('push_subscriptions')
        .delete()
        .eq('user_id', sessionId)
        .eq('endpoint', endpoint)
    } else {
      await db
        .from('push_subscriptions')
        .delete()
        .eq('user_id', sessionId)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[push/unsubscribe]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
