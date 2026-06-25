'use client'
import { useMemo, useState, useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable'
import { PointsHistory } from '@/components/leaderboard/PointsHistory'
import { Accordion } from '@/components/ui/Accordion'
import { DEFAULT_FORM_VISUAL_SETTINGS } from '@/lib/form-visual-settings'
import type { FormEffect, FormVisualSettings, LeaderboardEntry } from '@/types'
import type { LeaderboardFormPred, LeaderboardFormMatch } from '@/app/api/data/leaderboard-form/route'

const LEGEND = [
  { dot: 'bg-emerald-500', label: 'pełne trafienie' },
  { dot: 'bg-orange-400',  label: 'częściowe trafienie' },
  { dot: 'bg-red-500',     label: 'typował, 0 pkt' },
  { dot: 'bg-gray-700',    label: 'brak typu / nierozliczono' },
]

const BONUS_META: Record<string, { label: string; desc: string; settingKey: string }> = {
  perfect_round:     { label: '⭐ Perfekcyjna kolejka', desc: 'Trafisz wszystkie mecze w jednej kolejce grupowej.',  settingKey: 'perfect_round_bonus' },
  streak_3:          { label: '🔥 Passa x3',            desc: '3 trafione typy z rzędu.',                             settingKey: 'streak_3_bonus' },
  streak_5:          { label: '🔥🔥 Passa x5',           desc: '5 trafionych typów z rzędu.',                         settingKey: 'streak_5_bonus' },
  risky_pick:        { label: '🎯 Idealny typ',          desc: 'Jedyny gracz, który trafia klasyczny typ + dokładny wynik (8 pkt) w danym meczu. Typ "drużyna lub remis" się nie liczy.', settingKey: 'risky_pick_bonus' },
  tournament_winner: { label: '🏆 Zwycięzca turnieju',  desc: 'Trafiony mistrz turnieju wytypowany przed startem.',  settingKey: 'tournament_winner_bonus' },
}

const FALLBACK_POINTS: Record<string, number> = {
  outcome_points: 3, exact_score_points: 5,
  perfect_round_bonus: 5, streak_3_bonus: 2, streak_5_bonus: 5,
  risky_pick_bonus: 2, tournament_winner_bonus: 20,
}

type DotColor = 'green' | 'orange' | 'red' | 'gray'
type FormSlot = { color: DotColor; tooltip: string }

const FORM_STATUS_LEGEND: { effect: FormEffect; label: string; desc: string }[] = [
  { effect: 'hot', label: '🔥 Gorąca seria', desc: 'kilka trafień z rzędu' },
  { effect: 'sniper', label: '🎯 Snajper', desc: 'kilka dokładnych trafień' },
  { effect: 'cold', label: '❄️ Zimna seria', desc: '5 nietrafionych typów' },
  { effect: 'storm', label: '⛈️ Czarne chmury', desc: 'bardzo słaba ostatnia forma' },
  { effect: 'curse', label: '🔮 Klątwa typera', desc: 'pechowa seria' },
  { effect: 'wooden', label: '🪵 Drewniana forma', desc: 'brak skuteczności lub typów' },
  { effect: 'var', label: '👁️ VAR sprawdza typy', desc: 'forma mieszana, podejrzanie blisko' },
]

// Counts scoring streak from most recent match backwards.
// green=+1.0, orange=+0.5; red/gray breaks the streak.
// Returns 0 if fewer than 2 consecutive scoring hits (no fire for a single hit).
function calcFireScore(slots: FormSlot[]): number {
  let score = 0
  let count = 0
  for (let i = slots.length - 1; i >= 0; i--) {
    const c = slots[i].color
    if (c === 'green') { score += 1.0; count++ }
    else if (c === 'orange') { score += 0.5; count++ }
    else break
  }
  return count >= 2 ? score : 0
}

function hasRedRun(colors: DotColor[], runLength: number): boolean {
  let run = 0
  for (const color of colors) {
    run = color === 'red' ? run + 1 : 0
    if (run >= runLength) return true
  }
  return false
}

function getFormEffect(entry: LeaderboardEntry, lastFive: FormSlot[] | undefined, fireScore: number): FormEffect {
  const override = entry.form_effect_override ?? 'auto'
  if (override !== 'auto') return override
  if (!lastFive || lastFive.length < 5) return fireScore > 0 ? 'hot' : 'none'

  const colors = lastFive.map(slot => slot.color)
  const redCount = colors.filter(color => color === 'red').length
  const orangeCount = colors.filter(color => color === 'orange').length
  const greenCount = colors.filter(color => color === 'green').length
  const grayCount = colors.filter(color => color === 'gray').length
  const hasGreen = colors.includes('green')

  if (redCount === 5) return 'cold'
  if (redCount >= 4) return 'storm'
  if (hasRedRun(colors, 3)) return 'curse'
  if (grayCount >= 3 || (grayCount >= 2 && redCount >= 1)) return 'wooden'
  if (!hasGreen && orangeCount + redCount >= 3 && orangeCount >= 1) return 'var'
  if (greenCount >= 2) return 'sniper'
  if (fireScore > 0) return 'hot'
  return 'none'
}

function dotColor(
  pred: { points_earned: number; predicted_result: string | null } | undefined,
  outcomePoints: number,
  exactScorePoints: number,
): DotColor {
  if (!pred) return 'gray'
  if (pred.points_earned === 0) return 'red'
  const isDouble = pred.predicted_result === 'home_or_draw' || pred.predicted_result === 'away_or_draw'
  const max = isDouble ? 1 + exactScorePoints : outcomePoints + exactScorePoints
  return pred.points_earned >= max ? 'green' : 'orange'
}

function dotStatus(color: DotColor): string {
  if (color === 'green')  return 'Pełne trafienie'
  if (color === 'orange') return 'Częściowe trafienie'
  if (color === 'red')    return '0 pkt'
  return 'Brak typu'
}

export default function TabelaPage() {
  const { currentUser, users, bonusPoints } = useAppStore()
  const [pointsMap, setPointsMap] = useState<Record<string, number>>(FALLBACK_POINTS)
  const [formMatches, setFormMatches] = useState<LeaderboardFormMatch[]>([])
  const [formPreds, setFormPreds] = useState<LeaderboardFormPred[]>([])
  const [visualSettings, setVisualSettings] = useState<FormVisualSettings>(DEFAULT_FORM_VISUAL_SETTINGS)

  useEffect(() => {
    fetch('/api/admin/scoring-settings')
      .then(r => r.json())
      .then(({ settings }: { settings: { key: string; value: number }[] }) => {
        if (!settings?.length) return
        setPointsMap(Object.fromEntries(settings.map(s => [s.key, s.value])))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/data/leaderboard-form')
      .then(r => r.json())
      .then(({ matches, predictions }: { matches: LeaderboardFormMatch[]; predictions: LeaderboardFormPred[] }) => {
        if (matches) setFormMatches(matches)
        if (predictions) setFormPreds(predictions)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/data/form-visual-settings')
      .then(r => r.json())
      .then(({ settings }: { settings?: FormVisualSettings }) => {
        if (settings) setVisualSettings(settings)
      })
      .catch(() => {})
  }, [])

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

  const formData = useMemo((): Record<string, FormSlot[]> => {
    const outcomePoints = pointsMap['outcome_points'] ?? FALLBACK_POINTS['outcome_points']
    const exactScorePoints = pointsMap['exact_score_points'] ?? FALLBACK_POINTS['exact_score_points']
    const result: Record<string, FormSlot[]> = {}
    for (const entry of leaderboard) {
      result[entry.id] = formMatches.map(match => {
        const pred = formPreds.find(p => p.user_id === entry.id && p.match_id === match.id)
        const color = dotColor(pred, outcomePoints, exactScorePoints)
        const label = `${match.team_a} vs ${match.team_b} (${match.score_a}:${match.score_b})`
        const tooltip = pred
          ? `${label} | Typ: ${pred.predicted_a}:${pred.predicted_b} | ${pred.points_earned > 0 ? '+' + pred.points_earned + ' pkt' : '0 pkt'} | ${dotStatus(color)}`
          : `${label} | Brak typu`
        return { color, tooltip }
      })
    }
    return result
  }, [leaderboard, formMatches, formPreds, pointsMap])

  const fireScores = useMemo((): Record<string, number> => {
    const result: Record<string, number> = {}
    for (const entry of leaderboard) {
      const slots = formData[entry.id]
      result[entry.id] = slots?.length ? calcFireScore(slots) : 0
    }
    return result
  }, [leaderboard, formData])

  const formEffects = useMemo((): Record<string, FormEffect> => {
    const result: Record<string, FormEffect> = {}
    for (const entry of leaderboard) {
      result[entry.id] = getFormEffect(entry, formData[entry.id], fireScores[entry.id] ?? 0)
    }
    return result
  }, [leaderboard, formData, fireScores])

  const myBonuses = useMemo(() => bonusPoints.filter(b => b.user_id === currentUser?.id), [bonusPoints, currentUser])
  const totalBonus = myBonuses.reduce((s, b) => s + b.points, 0)

  return (
    <div>
      <h1 className="text-2xl font-black text-white mb-6">Tabela typerów</h1>

      <LeaderboardTable
        entries={leaderboard}
        currentUserId={currentUser?.id}
        formData={formData}
        fireScores={fireScores}
        formEffects={formEffects}
        visualSettings={visualSettings}
      />

      {/* Legend */}
      <Accordion title="Legenda kropek" className="mt-4 mb-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {LEGEND.map(({ dot, label }) => (
          <div key={label} className="flex items-center gap-2 rounded-lg bg-gray-950/45 px-2.5 py-2">
            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${dot}`} />
            <span className="text-xs text-gray-500">{label}</span>
          </div>
        ))}
        </div>
      </Accordion>

      <Accordion title="Statusy / Rangi formy" className="mb-3">
        <div className={`form-legend-panel form-style-${visualSettings.style_variant}`}>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {FORM_STATUS_LEGEND.map(({ effect, label, desc }) => (
              <div key={effect} className={`form-legend-card form-legend-card-${effect}`}>
                <span className={`form-status-dot form-status-dot-${effect}`} />
                <div className="min-w-0">
                  <p className="truncate text-xs font-black text-gray-100">{label}</p>
                  <p className="truncate text-[0.68rem] text-gray-500">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Accordion>

      {/* Bonuses section */}
      <Accordion title="Bonusy" className="mb-3">
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { label: 'Dokładny wynik', value: '5 pkt', color: 'text-emerald-400' },
            { label: 'Trafna końcówka', value: '3 pkt', color: 'text-amber-400' },
            { label: 'Szansa podwójna', value: '1 pkt', color: 'text-blue-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-gray-950/50 border border-gray-800/70 rounded-lg p-3 text-center">
              <p className={`text-lg font-black ${color}`}>{value}</p>
              <p className="text-gray-500 text-xs mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-3 mb-4">
          {Object.entries(BONUS_META).map(([key, meta]) => (
            <div key={key} className="bg-gray-950/50 border border-gray-800/70 rounded-lg p-4 flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm">{meta.label}</p>
                <p className="text-gray-400 text-xs mt-0.5">{meta.desc}</p>
              </div>
              <span className="text-emerald-400 font-black text-sm shrink-0">
                +{pointsMap[meta.settingKey] ?? FALLBACK_POINTS[meta.settingKey]} pkt
              </span>
            </div>
          ))}
        </div>

        {currentUser && myBonuses.length > 0 && (
          <>
            <h3 className="text-sm font-bold text-white mb-3">Moje bonusy</h3>
            <div className="space-y-2">
              {myBonuses.map(bonus => {
                const meta = BONUS_META[bonus.bonus_type]
                return (
                  <div key={bonus.id} className="bg-gray-950/50 border border-gray-800/70 rounded-lg px-4 py-3 flex items-center justify-between">
                    <p className="text-white text-sm font-medium">{meta?.label || bonus.bonus_type}</p>
                    <span className="text-emerald-400 font-black">+{bonus.points}</span>
                  </div>
                )
              })}
              <div className="bg-emerald-950/40 border border-emerald-900 rounded-lg px-4 py-3 flex items-center justify-between">
                <span className="text-emerald-300 font-bold text-sm">Suma bonusów</span>
                <span className="text-emerald-400 font-black">+{totalBonus}</span>
              </div>
            </div>
          </>
        )}
      </Accordion>

      {/* Bonus ranking */}
      <Accordion title="Ranking bonusów" className="mb-3">
        <div className="rounded-lg overflow-hidden border border-gray-800/70">
          {users
            .filter(u => u.status === 'active' && u.role !== 'admin')
            .sort((a, b) => {
              const aB = bonusPoints.filter(bp => bp.user_id === a.id).reduce((s, bp) => s + bp.points, 0)
              const bB = bonusPoints.filter(bp => bp.user_id === b.id).reduce((s, bp) => s + bp.points, 0)
              return bB - aB
            })
            .map((user, i) => {
              const total = bonusPoints.filter(bp => bp.user_id === user.id).reduce((s, bp) => s + bp.points, 0)
              return (
                <div
                  key={user.id}
                  className={`flex items-center justify-between px-4 py-3 border-b border-gray-800/70 last:border-0 ${user.id === currentUser?.id ? 'bg-emerald-950/30' : 'bg-gray-950/50'}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-gray-600 text-sm w-6 text-center">{i + 1}</span>
                    <span className={`font-medium text-sm ${user.id === currentUser?.id ? 'text-emerald-400' : 'text-white'}`}>
                      {user.nick}
                    </span>
                  </div>
                  <span className="text-purple-400 font-bold">{total > 0 ? `+${total}` : '0'} pkt</span>
                </div>
              )
            })}
        </div>
      </Accordion>

      <PointsHistory
        users={users.filter(u => u.status === 'active' && u.role !== 'admin')}
        outcomePoints={pointsMap['outcome_points'] ?? FALLBACK_POINTS['outcome_points']}
        exactScorePoints={pointsMap['exact_score_points'] ?? FALLBACK_POINTS['exact_score_points']}
      />
    </div>
  )
}
