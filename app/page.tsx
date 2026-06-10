'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/lib/store'
import { IS_PRODUCTION_MODE } from '@/lib/tournament-config'
import { Button } from '@/components/ui/Button'

export default function LoginPage() {
  const [nick, setNick] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login, loginAsync } = useAppStore()
  const router = useRouter()

  const handleLogin = async () => {
    setError('')
    setLoading(true)
    try {
      const result = IS_PRODUCTION_MODE
        ? await loginAsync(nick.trim(), code.trim())
        : login(nick.trim(), code.trim())

      if (result === 'ok') {
        router.push('/mecze')
      } else if (result === 'pending') {
        setError('Twoje konto czeka na zatwierdzenie przez administratora. Wróć później.')
      } else if (result === 'blocked') {
        setError('Twoje konto zostało zablokowane. Skontaktuj się z administratorem.')
      } else if (result === 'wrong_code') {
        setError('Nieprawidłowy kod dostępu.')
      } else {
        setError('Nieznany nick lub błędny kod.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="text-6xl mb-4">🌍</div>
          <h1 className="text-3xl font-black text-white tracking-tight">TYPERZY 2026</h1>
          <p className="text-gray-500 mt-2 text-sm">FIFA World Cup · Prywatna liga</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-xs text-gray-500 font-medium mb-1.5">TWÓJ NICK</label>
            <input type="text" value={nick} onChange={e => setNick(e.target.value)}
              placeholder="np. Dawid"
              disabled={loading}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition-colors disabled:opacity-50"
              onKeyDown={e => e.key === 'Enter' && handleLogin()} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 font-medium mb-1.5">KOD DOSTĘPU</label>
            <input type="password" value={code} onChange={e => setCode(e.target.value)}
              placeholder="••••••••••••"
              disabled={loading}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition-colors disabled:opacity-50"
              onKeyDown={e => e.key === 'Enter' && handleLogin()} />
          </div>

          {error && (
            <div className="bg-red-950/50 border border-red-900 rounded-xl px-4 py-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <Button className="w-full" onClick={handleLogin} disabled={!nick || !code || loading}>
            {loading ? 'Logowanie...' : 'Wejdź'}
          </Button>
        </div>

        <p className="text-center text-gray-700 text-xs mt-6">Dostęp tylko dla zaproszonych · Kod od admina</p>
      </div>
    </div>
  )
}
