'use client'
import type { CSSProperties } from 'react'
import type { LeaderboardEntry } from '@/types'

type DotColor = 'green' | 'orange' | 'red' | 'gray'
type FormSlot = { color: DotColor; tooltip: string }

interface Props {
  entries: LeaderboardEntry[]
  currentUserId?: string
  formData?: Record<string, FormSlot[]>
  fireScores?: Record<string, number>
}

const medals = ['🥇', '🥈', '🥉']

// Flame tongues rising from the lower-left edge of the row.
// Three color layers: dark red base → orange middle → amber/yellow tips.
// Width uses CSS min() for responsive sizing (desktop vs mobile).
// Four tiers scaled by fireScore.
function fireStyle(fireScore: number): CSSProperties | null {
  if (fireScore < 1.0) return null

  let bg: string
  let speed: string
  let width: string

  if (fireScore < 1.5) {
    bg = [
      'radial-gradient(ellipse 78% 185% at 0% 88%, rgba(153,27,27,0.16) 0%, transparent 100%)',
      'radial-gradient(ellipse 56% 155% at 1% 65%, rgba(234,88,12,0.12) 0%, transparent 100%)',
      'radial-gradient(ellipse 36% 120% at 2% 42%, rgba(251,191,36,0.08) 0%, transparent 100%)',
    ].join(',')
    speed = '4.5s'
    width = 'min(160px, 42vw)'
  } else if (fireScore < 2.0) {
    bg = [
      'radial-gradient(ellipse 82% 190% at 0% 86%, rgba(153,27,27,0.20) 0%, transparent 100%)',
      'radial-gradient(ellipse 62% 165% at 1% 63%, rgba(234,88,12,0.17) 0%, transparent 100%)',
      'radial-gradient(ellipse 42% 132% at 2% 40%, rgba(251,191,36,0.12) 0%, transparent 100%)',
    ].join(',')
    speed = '3.8s'
    width = 'min(230px, 46vw)'
  } else if (fireScore < 2.5) {
    bg = [
      'radial-gradient(ellipse 86% 195% at -1% 84%, rgba(127,29,29,0.22) 0%, transparent 100%)',
      'radial-gradient(ellipse 68% 172% at 1% 62%, rgba(185,28,28,0.18) 0%, transparent 100%)',
      'radial-gradient(ellipse 50% 148% at 2% 42%, rgba(234,88,12,0.16) 0%, transparent 100%)',
      'radial-gradient(ellipse 32% 112% at 2% 22%, rgba(251,191,36,0.11) 0%, transparent 100%)',
    ].join(',')
    speed = '3.0s'
    width = 'min(310px, 50vw)'
  } else {
    bg = [
      'radial-gradient(ellipse 90% 200% at -1% 82%, rgba(127,29,29,0.26) 0%, transparent 100%)',
      'radial-gradient(ellipse 74% 180% at 0% 62%, rgba(185,28,28,0.23) 0%, transparent 100%)',
      'radial-gradient(ellipse 56% 158% at 1% 44%, rgba(234,88,12,0.20) 0%, transparent 100%)',
      'radial-gradient(ellipse 38% 128% at 2% 26%, rgba(251,146,60,0.16) 0%, transparent 100%)',
      'radial-gradient(ellipse 24% 95% at 1% 10%, rgba(251,191,36,0.12) 0%, transparent 100%)',
    ].join(',')
    speed = '2.5s'
    width = 'min(400px, 55vw)'
  }

  return {
    width,
    background: bg,
    animation: `fire-dance ${speed} ease-in-out infinite`,
    zIndex: 0,
  }
}

const DOT_CLASS: Record<DotColor, string> = {
  green:  'bg-emerald-500',
  orange: 'bg-orange-400',
  red:    'bg-red-500',
  gray:   'bg-gray-700',
}

function FormDot({ slot }: { slot: FormSlot | undefined }) {
  const color: DotColor = slot?.color ?? 'gray'
  const title = slot?.tooltip ?? 'Brak danych'
  return <div className={`w-2 h-2 rounded-full shrink-0 ${DOT_CLASS[color]}`} title={title} />
}

export function LeaderboardTable({ entries, currentUserId, formData = {}, fireScores = {} }: Props) {
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
            const score = fireScores[entry.id] ?? 0
            const fire = fireStyle(score)
            return (
              <tr key={entry.id} className="border-b border-gray-800 last:border-0 transition-colors bg-gray-900 hover:bg-gray-800/50">
                {/* Position column — fire overlay anchored here so it starts at the true left edge */}
                <td className="py-3 px-4 text-center relative">
                  {fire && (
                    <div
                      className="absolute inset-y-0 left-0 pointer-events-none fire-layer"
                      style={fire}
                    />
                  )}
                  <span className="relative z-[1]">
                    {i < 3
                      ? <span className="text-lg">{medals[i]}</span>
                      : <span className="text-gray-500 text-sm">{entry.position}</span>
                    }
                  </span>
                </td>

                <td className="py-3 px-4">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-sm text-white">{entry.nick}</span>
                    {isMe && <span className="text-sm leading-none">👤</span>}
                    {score >= 2.0 && <span className="text-xs leading-none">🔥</span>}
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
