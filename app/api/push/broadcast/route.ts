import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/admin'
import { IS_PRODUCTION_MODE } from '@/lib/tournament-config'

export async function POST(req: NextRequest) {
  if (!IS_PRODUCTION_MODE) {
    return NextResponse.json({ message: 'Mock mode — no push sent' })
  }

  const sessionId = req.cookies.get('typerzy_session')?.value
  if (!sessionId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const db = createAdminClient()
  const { data: profile } = await db.from('profiles').select('role').eq('id', sessionId).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const title = String(body.title ?? '').trim()
  const text = String(body.text ?? '').trim()
  if (!title || !text) {
    return NextResponse.json({ error: 'Brak tytułu lub treści' }, { status: 400 })
  }

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
  const vapidEmail = process.env.VAPID_EMAIL
  if (!vapidPublicKey || !vapidPrivateKey || !vapidEmail) {
    return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 500 })
  }

  webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey)

  const { data: subscriptions } = await db
    .from('push_subscriptions')
    .select('user_id, endpoint, p256dh, auth')

  if (!subscriptions?.length) {
    return NextResponse.json({ message: 'Brak subskrybentów', sent: 0 })
  }

  let sent = 0
  const expired: string[] = []
  const errors: { endpoint: string; status?: number; message?: string }[] = []

  await Promise.allSettled(
    subscriptions.map(async sub => {
      const payload = JSON.stringify({
        title,
        body: text,
        url: '/mecze',
        tag: 'broadcast',
      })
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        )
        sent++
      } catch (err: unknown) {
        const e = err as { statusCode?: number; message?: string }
        const status = e.statusCode
        errors.push({ endpoint: sub.endpoint.slice(-40), status, message: e.message })
        if (status === 410 || status === 404) expired.push(sub.endpoint)
      }
    })
  )

  if (expired.length > 0) {
    await db.from('push_subscriptions').delete().in('endpoint', expired)
  }

  return NextResponse.json({
    ok: sent > 0,
    sent,
    total: subscriptions.length,
    message: `Wysłano do ${sent}/${subscriptions.length} subskrybentów.`,
    errors: errors.length > 0 ? errors : undefined,
    debug: errors,
  })
}
