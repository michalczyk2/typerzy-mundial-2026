'use client'
import { useMemo } from 'react'
import { useAppStore } from '@/lib/store'
import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable'
import type { LeaderboardEntry } from '@/types'

const LEGEND = [
  { dot: 'bg-emerald-500', label: 'dokładny wynik' },
  { dot: 'bg-amber-400',   label: 'trafiona końcówka' },
  { dot: 'bg-red-500',     label: 'pudło' },
]

export default function TabelaPage() {
  const { currentUser, users, lastPredictions } = useAppStore()

  const leaderboard = useMemo((): LeaderboardEntry[] => {
    const activeUsers = users.filter(u => u.status === 'active' && u.role !== 'admin')
    const sorted = [...activeUsers].sort((a, b) => b.total_points - a.total_points)
    const maxPts = sorted[0]?.total_points ?? 0
    const minPts = sorted[sorted.length - 1]?.total_points ?? 0
    return sorted.map((user, i) => ({
      ...user,
      position: i + 1,
      is_leader: user.total_points === maxPts,
      is_last: user.total_points === minPts && sorted.length > 1,
    }))
  }, [users])

  return (
    <div>
      <h1 className="text-2xl font-black text-white mb-6">Tabela typerów</h1>

      {/* Scoring summary */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        {[
          { label: 'Trafny wynik', value: '5 pkt', color: 'text-amber-400' },
          { label: 'Trafna końcówka', value: '3 pkt', color: 'text-emerald-400' },
          { label: 'Bonusy', value: '+2–20', color: 'text-purple-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
            <p className={`text-lg font-black ${color}`}>{value}</p>
            <p className="text-gray-500 text-xs mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 px-1">
        {LEGEND.map(({ dot, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${dot}`} />
            <span className="text-xs text-gray-500">{label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <span className="text-sm leading-none">🔥</span>
          <span className="text-xs text-gray-500">forma gracza</span>
        </div>
      </div>

      <LeaderboardTable
        entries={leaderboard}
        currentUserId={currentUser?.id}
        lastPredictions={lastPredictions}
      />
    </div>
  )
}
