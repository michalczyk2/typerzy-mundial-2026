'use client'
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

function buildFlameUrl(d: string): string {
  return `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'><path fill='white' d='${d}'/></svg>")`
}

interface FireConfig {
  glowBg: string
  flameBg: string
  flameMask: string
  speed: string
  width: string
}

function getFireConfig(fireScore: number): FireConfig | null {
  if (fireScore < 1.0) return null

  if (fireScore < 1.5) {
    return {
      glowBg: [
        'radial-gradient(ellipse 78% 185% at 0% 88%, rgba(153,27,27,0.09) 0%, transparent 100%)',
        'radial-gradient(ellipse 56% 155% at 1% 65%, rgba(234,88,12,0.07) 0%, transparent 100%)',
        'radial-gradient(ellipse 36% 120% at 2% 42%, rgba(251,191,36,0.05) 0%, transparent 100%)',
      ].join(','),
      flameBg: [
        'radial-gradient(ellipse 85% 190% at 0% 90%, rgba(153,27,27,0.35) 0%, transparent 100%)',
        'radial-gradient(ellipse 60% 160% at 0% 68%, rgba(234,88,12,0.28) 0%, transparent 100%)',
        'radial-gradient(ellipse 38% 125% at 1% 45%, rgba(251,191,36,0.20) 0%, transparent 100%)',
      ].join(','),
      flameMask: buildFlameUrl('M0,100 L0,68 Q3,54 5,48 Q7,54 10,64 Q13,52 15,46 Q17,54 22,66 Q28,74 40,84 L100,100 Z'),
      speed: '4.5s',
      width: 'min(160px, 42vw)',
    }
  }

  if (fireScore < 2.0) {
    return {
      glowBg: [
        'radial-gradient(ellipse 82% 190% at 0% 86%, rgba(153,27,27,0.11) 0%, transparent 100%)',
        'radial-gradient(ellipse 62% 165% at 1% 63%, rgba(234,88,12,0.09) 0%, transparent 100%)',
        'radial-gradient(ellipse 42% 132% at 2% 40%, rgba(251,191,36,0.07) 0%, transparent 100%)',
      ].join(','),
      flameBg: [
        'radial-gradient(ellipse 88% 195% at 0% 88%, rgba(153,27,27,0.40) 0%, transparent 100%)',
        'radial-gradient(ellipse 65% 168% at 0% 65%, rgba(234,88,12,0.32) 0%, transparent 100%)',
        'radial-gradient(ellipse 45% 140% at 1% 42%, rgba(251,146,60,0.25) 0%, transparent 100%)',
        'radial-gradient(ellipse 28% 108% at 1% 22%, rgba(251,191,36,0.18) 0%, transparent 100%)',
      ].join(','),
      flameMask: buildFlameUrl('M0,100 L0,58 Q3,42 6,32 Q9,42 13,54 Q16,38 20,28 Q23,38 28,50 Q32,38 36,44 Q40,50 48,60 Q58,70 72,80 L100,100 Z'),
      speed: '3.8s',
      width: 'min(230px, 46vw)',
    }
  }

  if (fireScore < 2.5) {
    return {
      glowBg: [
        'radial-gradient(ellipse 86% 195% at -1% 84%, rgba(127,29,29,0.12) 0%, transparent 100%)',
        'radial-gradient(ellipse 68% 172% at 1% 62%, rgba(185,28,28,0.10) 0%, transparent 100%)',
        'radial-gradient(ellipse 50% 148% at 2% 42%, rgba(234,88,12,0.09) 0%, transparent 100%)',
        'radial-gradient(ellipse 32% 112% at 2% 22%, rgba(251,191,36,0.06) 0%, transparent 100%)',
      ].join(','),
      flameBg: [
        'radial-gradient(ellipse 90% 200% at -1% 86%, rgba(127,29,29,0.44) 0%, transparent 100%)',
        'radial-gradient(ellipse 70% 175% at 0% 65%, rgba(185,28,28,0.38) 0%, transparent 100%)',
        'radial-gradient(ellipse 52% 152% at 1% 44%, rgba(234,88,12,0.30) 0%, transparent 100%)',
        'radial-gradient(ellipse 34% 118% at 1% 25%, rgba(251,146,60,0.22) 0%, transparent 100%)',
        'radial-gradient(ellipse 18% 85% at 0% 8%, rgba(251,191,36,0.16) 0%, transparent 100%)',
      ].join(','),
      flameMask: buildFlameUrl('M0,100 L0,44 Q3,28 7,16 Q10,28 15,40 Q18,26 23,14 Q26,26 32,38 Q36,24 40,30 Q44,38 50,46 Q56,38 60,44 Q66,52 75,62 L88,78 L100,100 Z'),
      speed: '3.0s',
      width: 'min(310px, 50vw)',
    }
  }

  return {
    glowBg: [
      'radial-gradient(ellipse 90% 200% at -1% 82%, rgba(127,29,29,0.14) 0%, transparent 100%)',
      'radial-gradient(ellipse 74% 180% at 0% 62%, rgba(185,28,28,0.12) 0%, transparent 100%)',
      'radial-gradient(ellipse 56% 158% at 1% 44%, rgba(234,88,12,0.10) 0%, transparent 100%)',
      'radial-gradient(ellipse 38% 128% at 2% 26%, rgba(251,146,60,0.08) 0%, transparent 100%)',
      'radial-gradient(ellipse 24% 95% at 1% 10%, rgba(251,191,36,0.06) 0%, transparent 100%)',
    ].join(','),
    flameBg: [
      'radial-gradient(ellipse 92% 205% at -2% 85%, rgba(127,29,29,0.48) 0%, transparent 100%)',
      'radial-gradient(ellipse 76% 182% at 0% 65%, rgba(185,28,28,0.42) 0%, transparent 100%)',
      'radial-gradient(ellipse 58% 162% at 0% 46%, rgba(234,88,12,0.35) 0%, transparent 100%)',
      'radial-gradient(ellipse 40% 132% at 1% 28%, rgba(251,146,60,0.26) 0%, transparent 100%)',
      'radial-gradient(ellipse 26% 98% at 0% 10%, rgba(251,191,36,0.18) 0%, transparent 100%)',
    ].join(','),
    flameMask: buildFlameUrl('M0,100 L0,34 Q3,18 7,8 Q10,18 16,30 Q19,16 24,6 Q27,16 33,28 Q36,14 41,22 Q45,30 50,20 Q53,12 58,24 Q62,34 68,26 Q72,18 76,30 Q80,40 86,52 L95,68 L100,100 Z'),
    speed: '2.5s',
    width: 'min(400px, 55vw)',
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
            const config = getFireConfig(score)
            return (
              <tr key={entry.id} className="border-b border-gray-800 last:border-0 transition-colors bg-gray-900 hover:bg-gray-800/50">
                {/* Position column — fire overlay anchored here so it starts at the true left edge */}
                <td className="py-3 px-4 text-center relative">
                  {config && (
                    <>
                      <div
                        className="absolute inset-y-0 left-0 pointer-events-none fire-layer"
                        style={{
                          width: config.width,
                          background: config.glowBg,
                          animation: `fire-dance ${config.speed} ease-in-out infinite`,
                          zIndex: 0,
                        }}
                      />
                      <div
                        className="absolute inset-y-0 left-0 pointer-events-none fire-layer"
                        style={{
                          width: config.width,
                          background: config.flameBg,
                          maskImage: config.flameMask,
                          WebkitMaskImage: config.flameMask,
                          maskSize: '100% 100%',
                          WebkitMaskSize: '100% 100%',
                          maskRepeat: 'no-repeat',
                          WebkitMaskRepeat: 'no-repeat',
                          animation: `fire-shape ${config.speed} ease-in-out infinite`,
                          zIndex: 1,
                        }}
                      />
                    </>
                  )}
                  <span className="relative z-[2]">
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
