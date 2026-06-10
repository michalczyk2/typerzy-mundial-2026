'use client'
import type { LeaderboardEntry } from '@/types'
import { cn } from '@/lib/utils'

interface Props { entries: LeaderboardEntry[]; currentUserId?: string }

const medals = ['🥇','🥈','🥉']

export function LeaderboardTable({ entries, currentUserId }: Props) {
  if (entries.length === 0) {
    return <div className="text-center py-12 text-gray-500">Brak danych — zostań pierwszym typerym!</div>
  }
  return (
    <div className="overflow-hidden rounded-xl border border-gray-800">
      <table className="w-full">
        <thead>
          <tr className="bg-gray-950 border-b border-gray-800">
            <th className="text-left py-3 px-4 text-xs text-gray-500 font-medium w-10">#</th>
            <th className="text-left py-3 px-4 text-xs text-gray-500 font-medium">Gracz</th>
            <th className="text-right py-3 px-4 text-xs text-gray-500 font-medium">Pkt</th>
            <th className="text-right py-3 px-2 text-xs text-gray-500 font-medium hidden sm:table-cell">Trafne</th>
            <th className="text-right py-3 px-2 text-xs text-gray-500 font-medium hidden sm:table-cell">Dokładne</th>
            <th className="text-right py-3 px-4 text-xs text-gray-500 font-medium hidden sm:table-cell">Bonusy</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, i) => {
            const isMe = entry.id === currentUserId
            return (
              <tr key={entry.id} className={cn('border-b border-gray-800 last:border-0 transition-colors',
                isMe ? 'bg-emerald-950/40' : 'bg-gray-900 hover:bg-gray-800/50')}>
                <td className="py-3 px-4 text-center">
                  {i < 3 ? <span className="text-lg">{medals[i]}</span> : <span className="text-gray-500 text-sm">{entry.position}</span>}
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <span className={cn('font-semibold text-sm', isMe ? 'text-emerald-400' : 'text-white')}>{entry.nick}</span>
                    {isMe && <span className="text-xs text-emerald-600">(ja)</span>}
                  </div>
                </td>
                <td className="py-3 px-4 text-right">
                  <span className={cn('font-black text-lg tabular-nums', isMe ? 'text-emerald-400' : 'text-white')}>{entry.total_points}</span>
                </td>
                <td className="py-3 px-2 text-right hidden sm:table-cell">
                  <span className="text-gray-300 text-sm tabular-nums">{entry.correct_outcomes}</span>
                </td>
                <td className="py-3 px-2 text-right hidden sm:table-cell">
                  <span className="text-amber-400 text-sm tabular-nums">{entry.correct_scores}</span>
                </td>
                <td className="py-3 px-4 text-right hidden sm:table-cell">
                  <span className="text-purple-400 text-sm tabular-nums">{entry.bonus_points}</span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
