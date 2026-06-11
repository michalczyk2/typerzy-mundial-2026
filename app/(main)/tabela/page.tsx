'use client'
import { useMemo } from 'react'
import { useAppStore } from '@/lib/store'
import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable'
import type { LeaderboardEntry } from '@/types'

export default function TabelaPage() {
  const { currentUser, users } = useAppStore()

  const leaderboard = useMemo((): LeaderboardEntry[] => {
    const activeUsers = users.filter(u => u.status === 'active' && u.role !== 'admin')
    const sorted = [...activeUsers].sort((a,b) => b.total_points - a.total_points)
    const maxPts = sorted[0]?.total_points ?? 0
    const minPts = sorted[sorted.length-1]?.total_points ?? 0
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
      <div className="mb-4 grid grid-cols-3 gap-3">
        {[
          { label: 'Trafny wynik', value: '5 pkt', color: 'text-amber-400' },
          { label: 'Trafna końcówka', value: '3 pkt', color: 'text-emerald-400' },
          { label: 'Bonusy', value: '+2–20', color: 'text-purple-400' },
        ].map(({label, value, color}) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
            <p className={`text-lg font-black ${color}`}>{value}</p>
            <p className="text-gray-500 text-xs mt-0.5">{label}</p>
          </div>
        ))}
      </div>
      <LeaderboardTable entries={leaderboard} currentUserId={currentUser?.id} />
    </div>
  )
}
