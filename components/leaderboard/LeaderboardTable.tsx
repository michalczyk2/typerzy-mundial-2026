'use client'
import type { CSSProperties } from 'react'
import type { LeaderboardEntry } from '@/types'

type FormSlot = { points: number | null; tooltip: string }

interface Props {
  entries: LeaderboardEntry[]
  currentUserId?: string
  formData?: Record<string, FormSlot[]>
}

const medals = ['🥇', '🥈', '🥉']

// Returns inline style for the fire gradient background based on current_streak.
// 0-1: no effect. 2: subtle. 3-4: medium. 5-7: hot. 8+: blazing.
function streakStyle(streak: number): CSSProperties | null {
  if (streak < 2) return null
  let width: string
  let rgb: string
  let opacity: string
  if (streak === 2) {
    width = '22%'; rgb = '251,191,36'; opacity = '0.22' // amber-300
  } else if (streak <= 4) {
    width = '38%'; rgb = '251,146,60'; opacity = '0.30' // orange-400
  } else if (streak <= 7) {
    width = '55%'; rgb = '249,115,22'; opacity = '0.38' // orange-500
  } else {
    width = '80%'; rgb = '239,68,68';  opacity = '0.42' // red-500
  }
  return {
    width,
    background: `linear-gradient(90deg, rgba(${rgb},${opacity}) 0%, rgba(${rgb},${parseFloat(opacity) * 0.4}) 65%, transparent 100%)`,
    animation: 'streak-flicker 2.2s ease-in-out infinite',
  }
}

function FormDot({ slot }: { slot: FormSlot | undefined }) {
  if (!slot || slot.points === null)
    return <div className="w-2 h-2 rounded-full bg-gray-700 shrink-0" title={slot?.tooltip ?? 'Brak danych'} />
  if (slot.points > 0)
    return <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title={slot.tooltip} />
  return <div className="w-2 h-2 rounded-full bg-red-500 shrink-0" title={slot.tooltip} />
}

export function LeaderboardTable({ entries, currentUserId, formData = {} }: Props) {
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
            <th className="text-right py-3 px-2 text-xs text-gray-500 font-medium hidden sm:table-cell">Bonusy</th>
            <th className="text-center py-3 px-3 text-xs text-gray-500 font-medium whitespace-nowrap">Ostatnie 5</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, i) => {
            const isMe = entry.id === currentUserId
            const fire = streakStyle(entry.current_streak)
            return (
              <tr key={entry.id} className="border-b border-gray-800 last:border-0 transition-colors bg-gray-900 hover:bg-gray-800/50">
                <td className="py-3 px-4 text-center">
                  {i < 3
                    ? <span className="text-lg">{medals[i]}</span>
                    : <span className="text-gray-500 text-sm">{entry.position}</span>
                  }
                </td>

                {/* Player name cell — fire streak background effect */}
                <td className="py-3 px-4 relative overflow-hidden">
                  {fire && (
                    <div
                      className="absolute inset-y-0 left-0 pointer-events-none"
                      style={fire}
                    />
                  )}
                  <div className="relative flex items-center gap-1.5">
                    <span className="font-semibold text-sm text-white">{entry.nick}</span>
                    {isMe && <span className="text-sm leading-none">👤</span>}
                  </div>
                </td>

                <td className="py-3 px-4 text-right">
                  <span className="font-black text-lg tabular-nums text-white">
                    {entry.total_points}
                  </span>
                </td>
                <td className="py-3 px-2 text-right hidden sm:table-cell">
                  <span className="text-gray-300 text-sm tabular-nums">{entry.correct_outcomes}</span>
                </td>
                <td className="py-3 px-2 text-right hidden sm:table-cell">
                  <span className="text-amber-400 text-sm tabular-nums">{entry.correct_scores}</span>
                </td>
                <td className="py-3 px-2 text-right hidden sm:table-cell">
                  <span className="text-purple-400 text-sm tabular-nums">{entry.bonus_points}</span>
                </td>

                {/* Ostatnie 5 rozliczonych meczów — te same dla każdego gracza */}
                <td className="py-3 px-3">
                  <div className="flex items-center gap-1 justify-center">
                    {Array.from({ length: 5 }).map((_, idx) => (
                      <FormDot key={idx} slot={formData[entry.id]?.[idx]} />
                    ))}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
