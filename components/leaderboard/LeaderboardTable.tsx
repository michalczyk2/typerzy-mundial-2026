'use client'
import { DEFAULT_FORM_VISUAL_SETTINGS } from '@/lib/form-visual-settings'
import type { FormEffect, FormVisualSettings, LeaderboardEntry } from '@/types'

type DotColor = 'green' | 'orange' | 'red' | 'gray'
type FormSlot = { color: DotColor; tooltip: string }

interface Props {
  entries: LeaderboardEntry[]
  currentUserId?: string
  formData?: Record<string, FormSlot[]>
  fireScores?: Record<string, number>
  formEffects?: Record<string, FormEffect>
  visualSettings?: FormVisualSettings
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

  const baseGlow = 'linear-gradient(90deg, rgba(253,224,71,0.05), transparent 82%)'

  if (fireScore < 1.5) {
    return {
      glowBg: [
        'radial-gradient(ellipse 70% 150% at 0% 88%, rgba(251,146,60,0.10) 0%, transparent 76%)',
        'radial-gradient(ellipse 44% 118% at 2% 62%, rgba(245,158,11,0.08) 0%, transparent 72%)',
        baseGlow,
      ].join(','),
      flameBg: [
        'radial-gradient(ellipse 78% 170% at 0% 92%, rgba(234,88,12,0.20) 0%, transparent 76%)',
        'radial-gradient(ellipse 54% 138% at 1% 68%, rgba(251,146,60,0.16) 0%, transparent 72%)',
        'radial-gradient(ellipse 28% 90% at 2% 46%, rgba(253,224,71,0.11) 0%, transparent 68%)',
      ].join(','),
      flameMask: buildFlameUrl('M0,100 L0,78 Q4,64 8,58 Q11,66 16,76 Q20,62 25,54 Q29,66 37,77 Q48,86 66,93 L100,100 Z'),
      speed: '5.8s',
      width: 'min(130px, 34vw)',
    }
  }

  if (fireScore < 2.0) {
    return {
      glowBg: [
        'radial-gradient(ellipse 74% 160% at 0% 88%, rgba(251,146,60,0.12) 0%, transparent 76%)',
        'radial-gradient(ellipse 50% 128% at 1% 62%, rgba(245,158,11,0.09) 0%, transparent 72%)',
        baseGlow,
      ].join(','),
      flameBg: [
        'radial-gradient(ellipse 82% 176% at 0% 92%, rgba(234,88,12,0.23) 0%, transparent 76%)',
        'radial-gradient(ellipse 58% 148% at 0% 68%, rgba(251,146,60,0.18) 0%, transparent 72%)',
        'radial-gradient(ellipse 34% 104% at 1% 45%, rgba(253,224,71,0.13) 0%, transparent 68%)',
      ].join(','),
      flameMask: buildFlameUrl('M0,100 L0,70 Q4,50 9,42 Q13,58 20,72 Q25,50 32,38 Q36,56 45,70 Q56,82 74,91 L100,100 Z'),
      speed: '5.2s',
      width: 'min(180px, 38vw)',
    }
  }

  if (fireScore < 2.5) {
    return {
      glowBg: [
        'radial-gradient(ellipse 78% 170% at -1% 86%, rgba(251,146,60,0.14) 0%, transparent 76%)',
        'radial-gradient(ellipse 56% 138% at 1% 62%, rgba(245,158,11,0.11) 0%, transparent 72%)',
        baseGlow,
      ].join(','),
      flameBg: [
        'radial-gradient(ellipse 86% 184% at -1% 91%, rgba(234,88,12,0.25) 0%, transparent 76%)',
        'radial-gradient(ellipse 62% 154% at 0% 67%, rgba(251,146,60,0.21) 0%, transparent 72%)',
        'radial-gradient(ellipse 38% 112% at 1% 44%, rgba(253,224,71,0.15) 0%, transparent 68%)',
      ].join(','),
      flameMask: buildFlameUrl('M0,100 L0,60 Q4,38 10,26 Q14,46 22,65 Q28,40 36,24 Q41,44 50,62 Q60,76 80,90 L100,100 Z'),
      speed: '4.6s',
      width: 'min(230px, 42vw)',
    }
  }

  return {
    glowBg: [
      'radial-gradient(ellipse 82% 178% at -1% 84%, rgba(251,146,60,0.15) 0%, transparent 76%)',
      'radial-gradient(ellipse 62% 148% at 0% 62%, rgba(245,158,11,0.12) 0%, transparent 72%)',
      baseGlow,
    ].join(','),
    flameBg: [
      'radial-gradient(ellipse 88% 190% at -1% 90%, rgba(234,88,12,0.27) 0%, transparent 76%)',
      'radial-gradient(ellipse 66% 162% at 0% 66%, rgba(251,146,60,0.23) 0%, transparent 72%)',
      'radial-gradient(ellipse 42% 118% at 1% 42%, rgba(253,224,71,0.16) 0%, transparent 68%)',
    ].join(','),
    flameMask: buildFlameUrl('M0,100 L0,52 Q4,30 10,18 Q14,38 23,60 Q30,34 39,18 Q45,42 55,60 Q66,76 86,90 L100,100 Z'),
    speed: '4.2s',
    width: 'min(280px, 46vw)',
  }
}

const EFFECT_CLASS: Record<FormEffect, string> = {
  hot: 'form-effect-hot',
  sniper: 'form-effect-sniper',
  cold: 'form-effect-cold',
  storm: 'form-effect-storm',
  curse: 'form-effect-curse',
  wooden: 'form-effect-wooden',
  var: 'form-effect-var',
  none: '',
}

const EFFECT_META: Record<FormEffect, { icon: string; label: string; badge: string }> = {
  hot: { icon: '🔥', label: 'Gorąca seria', badge: 'form-rank-hot' },
  sniper: { icon: '🎯', label: 'Snajper', badge: 'form-rank-sniper' },
  cold: { icon: '❄️', label: 'Zimna seria', badge: 'form-rank-cold' },
  storm: { icon: '⛈️', label: 'Czarne chmury', badge: 'form-rank-storm' },
  curse: { icon: '🔮', label: 'Klątwa typera', badge: 'form-rank-curse' },
  wooden: { icon: '🪵', label: 'Drewniana forma', badge: 'form-rank-wooden' },
  var: { icon: '👁️', label: 'VAR sprawdza typy', badge: 'form-rank-var' },
  none: { icon: '', label: '', badge: '' },
}

const DOT_CLASS: Record<DotColor, string> = {
  green: 'bg-emerald-500',
  orange: 'bg-orange-400',
  red: 'bg-red-500',
  gray: 'bg-gray-700',
}

function FormDot({ slot }: { slot: FormSlot | undefined }) {
  const color: DotColor = slot?.color ?? 'gray'
  const title = slot?.tooltip ?? 'Brak danych'
  return <div className={`w-2 h-2 rounded-full shrink-0 ${DOT_CLASS[color]}`} title={title} />
}

function FormDots({ slots }: { slots: FormSlot[] | undefined }) {
  return (
    <>
      {Array.from({ length: 5 }).map((_, idx) => (
        <FormDot key={idx} slot={slots?.[idx]} />
      ))}
    </>
  )
}

function RankMark({ index, position }: { index: number; position: number }) {
  return (
    <>
      {index < 3
        ? <span className="text-lg">{medals[index]}</span>
        : <span className="text-gray-500 text-sm">{position}</span>
      }
    </>
  )
}

function FormBadges({
  effect,
  customTitle,
  showBadge,
  showTitle,
}: {
  effect: FormEffect
  customTitle: string | null | undefined
  showBadge: boolean
  showTitle: boolean
}) {
  const meta = EFFECT_META[effect]
  const title = customTitle?.trim()
  const showRank = showBadge && effect !== 'none'

  if (!showRank && !(showTitle && title)) return null

  return (
    <>
      {showRank && (
        <span className={`form-rank ${meta.badge || 'form-rank-none'}`} title={meta.label}>
          {meta.icon && <span className="form-rank-icon">{meta.icon}</span>}
          <span className="form-rank-label">{meta.label}</span>
        </span>
      )}
      {showTitle && title && (
        <span className="form-custom-title" title={title}>{title}</span>
      )}
    </>
  )
}

export function LeaderboardTable({
  entries,
  currentUserId,
  formData = {},
  fireScores = {},
  formEffects = {},
  visualSettings = DEFAULT_FORM_VISUAL_SETTINGS,
}: Props) {
  if (entries.length === 0) {
    return <div className="text-center py-12 text-gray-500">Brak danych - zostań pierwszym typerem!</div>
  }

  return (
    <div className={`leaderboard-form-system form-style-${visualSettings.style_variant} form-mode-${visualSettings.display_mode} overflow-hidden rounded-xl border border-gray-800`}>
      <div className="md:hidden divide-y divide-gray-800/80">
        {entries.map((entry, i) => {
          const isMe = entry.id === currentUserId
          const effect = formEffects[entry.id] ?? 'none'
          const showEffects = visualSettings.display_mode === 'full_effects'
          const showBadge = visualSettings.display_mode !== 'off'
          const showTitle = visualSettings.display_mode === 'badge_and_title' || visualSettings.display_mode === 'full_effects'

          return (
            <div
              key={entry.id}
              className={`leaderboard-mobile-card bg-gray-900 transition-colors ${showEffects ? EFFECT_CLASS[effect] : ''}`}
            >
              <div className="flex items-start gap-3 px-3 py-3">
                <div className="w-8 shrink-0 pt-0.5 text-center">
                  <RankMark index={i} position={entry.position} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-sm font-semibold text-white">{entry.nick}</span>
                    {isMe && <span className="shrink-0 rounded-full border border-gray-700 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase leading-none text-gray-300" title="Ty">Ty</span>}
                  </div>
                  <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
                    <FormBadges
                      effect={effect}
                      customTitle={entry.custom_form_title}
                      showBadge={showBadge}
                      showTitle={showTitle}
                    />
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <div className="text-lg font-black leading-none text-white tabular-nums">{entry.total_points}</div>
                  <div className="mt-0.5 text-[0.62rem] font-semibold uppercase tracking-wide text-gray-500">pkt</div>
                </div>
              </div>

              <div className="px-3 pb-3">
                <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-800/70 bg-gray-950/35 px-2.5 py-2">
                  <span className="shrink-0 text-[0.68rem] font-bold uppercase tracking-wide text-gray-500">Ostatnie 5</span>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <FormDots slots={formData[entry.id]} />
                  </div>
                </div>

                <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[0.68rem]">
                  <div className="rounded-md border border-gray-800/70 bg-gray-950/25 px-2 py-1.5">
                    <div className="text-gray-500">Trafne</div>
                    <div className="font-semibold text-gray-200 tabular-nums">{entry.correct_outcomes}</div>
                  </div>
                  <div className="rounded-md border border-gray-800/70 bg-gray-950/25 px-2 py-1.5">
                    <div className="text-gray-500">Dokladne</div>
                    <div className="font-semibold text-amber-300 tabular-nums">{entry.correct_scores}</div>
                  </div>
                  <div className="rounded-md border border-gray-800/70 bg-gray-950/25 px-2 py-1.5">
                    <div className="text-gray-500">Bonusy</div>
                    <div className="font-semibold text-purple-300 tabular-nums">{entry.bonus_points}</div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <table className="hidden w-full md:table">
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
            const effect = formEffects[entry.id] ?? 'none'
            const showEffects = visualSettings.display_mode === 'full_effects'
            const showBadge = visualSettings.display_mode !== 'off'
            const showTitle = visualSettings.display_mode === 'badge_and_title' || visualSettings.display_mode === 'full_effects'
            const config = null as ReturnType<typeof getFireConfig>
            const meta = EFFECT_META[effect]
            const customTitle = entry.custom_form_title?.trim()
            const showRank = showBadge && effect !== 'none'

            return (
              <tr
                key={entry.id}
                className={`border-b border-gray-800 last:border-0 transition-colors bg-gray-900 hover:bg-gray-800/50 ${showEffects ? EFFECT_CLASS[effect] : ''}`}
              >
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

                <td className="py-3 px-4 relative z-[2]">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-semibold text-sm text-white truncate">{entry.nick}</span>
                    {isMe && <span className="text-sm leading-none" title="Ty">👤</span>}
                    {showRank && (
                      <span className={`form-rank ${meta.badge || 'form-rank-none'}`} title={meta.label}>
                        {meta.icon && <span className="form-rank-icon">{meta.icon}</span>}
                        <span className="form-rank-label">{meta.label}</span>
                      </span>
                    )}
                    {showTitle && customTitle && (
                      <span className="form-custom-title" title={customTitle}>{customTitle}</span>
                    )}
                  </div>
                </td>

                <td className="py-3 px-4 text-right relative z-[2]">
                  <span className="font-black text-lg tabular-nums text-white">
                    {entry.total_points}
                  </span>
                </td>
                <td className="py-3 px-2 text-right hidden sm:table-cell relative z-[2]">
                  <span className="text-gray-300 text-sm tabular-nums">{entry.correct_outcomes}</span>
                </td>
                <td className="py-3 px-2 text-right hidden sm:table-cell relative z-[2]">
                  <span className="text-amber-400 text-sm tabular-nums">{entry.correct_scores}</span>
                </td>
                <td className="py-3 px-2 text-right hidden sm:table-cell relative z-[2]">
                  <span className="text-purple-400 text-sm tabular-nums">{entry.bonus_points}</span>
                </td>

                <td className="py-3 px-3 relative z-[2]">
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
