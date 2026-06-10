'use client'
import type { Standing } from '@/types'
import { FlagImg } from '@/components/ui/FlagImg'

interface Props { groupName: string; standings: Standing[] }

export function GroupTable({ groupName, standings }: Props) {
  const sorted = [...standings].sort((a,b) => {
    if (b.points !== a.points) return b.points - a.points
    const gdA = a.goals_for - a.goals_against
    const gdB = b.goals_for - b.goals_against
    if (gdB !== gdA) return gdB - gdA
    return b.goals_for - a.goals_for
  })
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="px-4 py-3 bg-gray-950 border-b border-gray-800">
        <h3 className="text-white font-bold">Grupa {groupName}</h3>
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-800">
            <th className="text-left py-2 px-4 text-xs text-gray-600 font-medium">Drużyna</th>
            <th className="text-center py-2 px-2 text-xs text-gray-600 font-medium w-8">M</th>
            <th className="text-center py-2 px-2 text-xs text-gray-600 font-medium w-8">W</th>
            <th className="text-center py-2 px-2 text-xs text-gray-600 font-medium w-8">R</th>
            <th className="text-center py-2 px-2 text-xs text-gray-600 font-medium w-8">P</th>
            <th className="text-center py-2 px-2 text-xs text-gray-600 font-medium w-12 hidden sm:table-cell">Bramki</th>
            <th className="text-center py-2 px-4 text-xs text-gray-600 font-medium w-8">Pkt</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((s, i) => (
            <tr key={s.team_code} className={`border-b border-gray-800 last:border-0 ${i < 2 ? 'bg-emerald-950/20' : ''}`}>
              <td className="py-3 px-4">
                <div className="flex items-center gap-2">
                  <FlagImg code={s.team_code} name={s.team} size="sm" />
                  <span className="text-white text-sm font-medium">{s.team}</span>
                  {i < 2 && <span className="text-xs text-emerald-600 hidden sm:inline">▲ A</span>}
                </div>
              </td>
              <td className="text-center py-3 px-2 text-gray-400 text-sm tabular-nums">{s.played}</td>
              <td className="text-center py-3 px-2 text-gray-300 text-sm tabular-nums">{s.won}</td>
              <td className="text-center py-3 px-2 text-gray-400 text-sm tabular-nums">{s.drawn}</td>
              <td className="text-center py-3 px-2 text-gray-500 text-sm tabular-nums">{s.lost}</td>
              <td className="text-center py-3 px-2 text-gray-400 text-sm tabular-nums hidden sm:table-cell">{s.goals_for}:{s.goals_against}</td>
              <td className="text-center py-3 px-4 text-white font-black tabular-nums">{s.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-4 py-2 border-t border-gray-800 text-xs text-gray-600">🟢 awansują do 1/16</div>
    </div>
  )
}
