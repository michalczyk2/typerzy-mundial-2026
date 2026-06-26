'use client'

import { useEffect, useState } from 'react'
import { IS_PRODUCTION_MODE } from '@/lib/tournament-config'

type PermissionState = 'default' | 'granted' | 'denied' | 'unsupported' | 'loading'

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const buffer = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) buffer[i] = rawData.charCodeAt(i)
  return buffer.buffer
}

export function PushNotificationButton() {
  const [permission, setPermission] = useState<PermissionState>('loading')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
      setPermission('unsupported')
      return
    }
    setPermission(Notification.permission as PermissionState)
  }, [])

  if (!IS_PRODUCTION_MODE || permission === 'loading') return null
  if (permission === 'unsupported') {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-gray-800 px-3 py-2 text-xs text-gray-500">
        🔔 <span>Dodaj apkę do ekranu głównego, aby włączyć powiadomienia</span>
      </div>
    )
  }

  const handleSubscribe = async () => {
    if (busy) return
    setBusy(true)
    try {
      const result = await Notification.requestPermission()
      if (result !== 'granted') {
        setPermission('denied')
        return
      }
      setPermission('granted')

      const reg = await navigator.serviceWorker.ready
      const existing = await reg.pushManager.getSubscription()
      if (existing) {
        await existing.unsubscribe()
      }

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) return

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })

      const json = sub.toJSON()
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          keys: { p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' },
        }),
      })
    } catch {
      // permission denied or SW not ready
    } finally {
      setBusy(false)
    }
  }

  const handleUnsubscribe = async () => {
    if (busy) return
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setPermission('default')
    } catch {
      // ignore
    } finally {
      setBusy(false)
    }
  }

  if (permission === 'denied') {
    return (
      <span className="text-xs text-gray-600" title="Powiadomienia zablokowane w przeglądarce">
        🔕 Zablokowane
      </span>
    )
  }

  if (permission === 'granted') {
    return (
      <button
        onClick={handleUnsubscribe}
        disabled={busy}
        className="flex items-center gap-1.5 rounded-full border border-emerald-800/60 bg-emerald-950/40 px-3 py-1.5 text-xs font-semibold text-emerald-400 transition hover:bg-emerald-950/70 disabled:opacity-50"
      >
        🔔 Powiadomienia włączone
      </button>
    )
  }

  return (
    <button
      onClick={handleSubscribe}
      disabled={busy}
      className="flex items-center gap-1.5 rounded-full border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs font-semibold text-gray-400 transition hover:border-gray-600 hover:text-gray-300 disabled:opacity-50"
    >
      🔔 Włącz powiadomienia
    </button>
  )
}
