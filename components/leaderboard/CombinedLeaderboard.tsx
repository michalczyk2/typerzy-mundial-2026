'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import type { DCLeaderboardEntry } from '@/app/api/data/leaderboard-combined/route'

export function CombinedLeaderboard() {
  const { currentUser } = useAppStore()
  const [entries, setEntries] = useState<DCLeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/data/leaderboard-combined')
      .then(r => r.json())
      .then(({ entries: data }: { entries: DCLeaderboardEntry[] }) => {
        if (Array.isArray(data)) setEntries(data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <div className="mb-4">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-violet-500">Daily Challenge</p>
        <h2 className="mt-1 text-xl font-black text-white">Ranking Daily Challenge</h2>
        <p className="mt-1 text-xs text-gray-500">Punkty z mini-gier · niezależny od rankingu typów meczowych</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-xl border border-gray-800 bg-gray-900 px-4 py-8 text-center">
          <p className="text-sm text-gray-500">Brak danych — punkty DC są zapisywane w Supabase po pierwszej grze.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-800">
          <div className="grid grid-cols-[2rem_1fr_4rem_5rem] gap-x-3 border-b border-gray-800 bg-gray-900/80 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-600">
            <span>#</span>
            <span>Gracz</span>
            <span className="text-center">Gry</span>
            <span className="text-right">Punkty DC</span>
          </div>

          {entries.map((entry, i) => {
            const isMe = entry.user_id === currentUser?.id
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null
            return (
              <div
                key={entry.user_id}
                className={cn(
                  'grid grid-cols-[2rem_1fr_4rem_5rem] gap-x-3 border-b border-gray-800/50 px-4 py-3 last:border-0',
                  isMe ? 'bg-violet-950/30' : 'bg-gray-950/50'
                )}
              >
                <span className="flex items-center text-sm font-bold text-gray-600">
                  {medal ?? i + 1}
                </span>
                <span className={cn('flex items-center text-sm font-semibold', isMe ? 'text-violet-300' : 'text-white')}>
                  {entry.nick}
                  {isMe && <span className="ml-1.5 text-[10px] font-bold text-violet-500">(Ty)</span>}
                </span>
                <span className="flex items-center justify-center text-sm text-gray-500">{entry.games_played}</span>
                <span className={cn('flex items-center justify-end text-sm font-black', entry.total_dc_points > 0 ? 'text-violet-300' : 'text-gray-600')}>
                  {entry.total_dc_points} pkt
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
