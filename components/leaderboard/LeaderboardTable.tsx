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

// Layered radial-gradient fire effect anchored to the left edge of the row.
// Div is placed inside the first (position) td with position:absolute, extending
// rightward 480px; outer overflow-hidden clips it at the table boundary.
// Five tiers: 1.0–1.49 amber warmup → 4.0+ blazing red/orange/yellow.
function fireStyle(fireScore: number): CSSProperties | null {
  if (fireScore < 1.0) return null

  let bg: string
  let speed: string

  if (fireScore < 1.5) {
    bg = [
      'radial-gradient(ellipse 38% 140% at 0% 55%, rgba(251,191,36,0.20) 0%, transparent 100%)',
      'radial-gradient(ellipse 26% 100% at 0% 32%, rgba(251,191,36,0.14) 0%, transparent 85%)',
    ].join(',')
    speed = '3.4s'
  } else if (fireScore < 2.0) {
    bg = [
      'radial-gradient(ellipse 52% 155% at 0% 58%, rgba(251,146,60,0.28) 0%, transparent 100%)',
      'radial-gradient(ellipse 36% 120% at 0% 36%, rgba(251,146,60,0.22) 0%, transparent 90%)',
      'radial-gradient(ellipse 24% 88% at 1% 20%, rgba(251,191,36,0.18) 0%, transparent 80%)',
    ].join(',')
    speed = '2.8s'
  } else if (fireScore < 3.0) {
    bg = [
      'radial-gradient(ellipse 62% 165% at 0% 60%, rgba(249,115,22,0.32) 0%, transparent 100%)',
      'radial-gradient(ellipse 46% 142% at 0% 40%, rgba(251,146,60,0.28) 0%, transparent 92%)',
      'radial-gradient(ellipse 32% 112% at 1% 24%, rgba(251,146,60,0.22) 0%, transparent 82%)',
      'radial-gradient(ellipse 22% 80% at 0% 14%, rgba(251,191,36,0.18) 0%, transparent 72%)',
    ].join(',')
    speed = '2.2s'
  } else if (fireScore < 4.0) {
    bg = [
      'radial-gradient(ellipse 76% 172% at -2% 62%, rgba(239,68,68,0.35) 0%, transparent 100%)',
      'radial-gradient(ellipse 58% 158% at 0% 44%, rgba(249,115,22,0.38) 0%, transparent 95%)',
      'radial-gradient(ellipse 42% 132% at 1% 28%, rgba(251,146,60,0.30) 0%, transparent 88%)',
      'radial-gradient(ellipse 28% 102% at 0% 15%, rgba(251,146,60,0.24) 0%, transparent 78%)',
      'radial-gradient(ellipse 20% 72% at 2% 72%, rgba(251,191,36,0.20) 0%, transparent 65%)',
    ].join(',')
    speed = '1.8s'
  } else {
    bg = [
      'radial-gradient(ellipse 88% 180% at -3% 65%, rgba(220,38,38,0.40) 0%, transparent 100%)',
      'radial-gradient(ellipse 68% 165% at -1% 47%, rgba(239,68,68,0.42) 0%, transparent 98%)',
      'radial-gradient(ellipse 52% 148% at 1% 32%, rgba(249,115,22,0.38) 0%, transparent 92%)',
      'radial-gradient(ellipse 38% 120% at 0% 18%, rgba(251,146,60,0.30) 0%, transparent 82%)',
      'radial-gradient(ellipse 28% 92% at 2% 78%, rgba(251,146,60,0.26) 0%, transparent 75%)',
      'radial-gradient(ellipse 18% 65% at 1% 8%, rgba(251,191,36,0.22) 0%, transparent 65%)',
    ].join(',')
    speed = '1.4s'
  }

  return {
    width: '480px',
    background: bg,
    animation: `fire-dance ${speed} ease-in-out infinite`,
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
                  {i < 3
                    ? <span className="text-lg">{medals[i]}</span>
                    : <span className="text-gray-500 text-sm">{entry.position}</span>
                  }
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
