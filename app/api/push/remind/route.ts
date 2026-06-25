import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/admin'
import { IS_PRODUCTION_MODE } from '@/lib/tournament-config'

const REMIND_MINUTES_BEFORE = 60

function isAuthorized(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization')
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) return true
  const sessionCookie = req.cookies.get('typerzy_session')?.value
  if (!sessionCookie) return false
  return false
}

export async function POST(req: NextRequest) {
  if (!IS_PRODUCTION_MODE) {
    return NextResponse.json({ message: 'Mock mode — no push sent' })
  }

  const authHeader = req.headers.get('authorization')
  const sessionId = req.cookies.get('typerzy_session')?.value

  const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`
  let isAdmin = false
  if (!isCron && sessionId) {
    const db = createAdminClient()
    const { data } = await db.from('profiles').select('role').eq('id', sessionId).single()
    isAdmin = data?.role === 'admin'
  }
  if (!isCron && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
  const vapidEmail = process.env.VAPID_EMAIL

  if (!vapidPublicKey || !vapidPrivateKey || !vapidEmail) {
    return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 500 })
  }

  webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey)

  const db = createAdminClient()
  const now = new Date()
  const windowStart = new Date(now.getTime())
  const windowEnd = new Date(now.getTime() + REMIND_MINUTES_BEFORE * 60 * 1000)

  const { data: upcomingMatches } = await db
    .from('matches')
    .select('id, team_a, team_b, match_date')
    .eq('status', 'scheduled')
    .eq('is_archived', false)
    .gte('match_date', windowStart.toISOString())
    .lte('match_date', windowEnd.toISOString())

  if (!upcomingMatches?.length) {
    return NextResponse.json({ message: 'No upcoming matches in window', sent: 0 })
  }

  const matchIds = upcomingMatches.map(m => m.id)

  const { data: predictions } = await db
    .from('predictions')
    .select('user_id, match_id')
    .in('match_id', matchIds)

  const usersWithPredictions = new Set((predictions ?? []).map(p => p.user_id))

  const { data: subscriptions } = await db
    .from('push_subscriptions')
    .select('user_id, endpoint, p256dh, auth')
    .in('user_id', [...usersWithPredictions])

  if (!subscriptions?.length) {
    return NextResponse.json({ message: 'No subscribers with predictions', sent: 0 })
  }

  const matchLabel = upcomingMatches.length === 1
    ? `${upcomingMatches[0].team_a} vs ${upcomingMatches[0].team_b}`
    : `${upcomingMatches.length} meczów`

  let sent = 0
  const expired: string[] = []

  await Promise.allSettled(
    subscriptions.map(async sub => {
      const payload = JSON.stringify({
        title: '⚽ Mecz za godzinę!',
        body: `${matchLabel} — sprawdź swój typ przed startem.`,
        url: '/mecze',
        tag: 'match-reminder',
      })
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        )
        sent++
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode
        if (status === 410 || status === 404) {
          expired.push(sub.endpoint)
        }
      }
    })
  )

  if (expired.length > 0) {
    await db.from('push_subscriptions').delete().in('endpoint', expired)
  }

  return NextResponse.json({ message: `Sent ${sent} notifications`, sent, expired: expired.length })
}

export async function GET(req: NextRequest) {
  return POST(req)
}
