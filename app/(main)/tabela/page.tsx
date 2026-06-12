'use client'
import { useMemo, useState, useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable'
import type { LeaderboardEntry } from '@/types'

const LEGEND = [
  { dot: 'bg-emerald-500', label: 'zdobył punkty w tym meczu' },
  { dot: 'bg-red-500',     label: 'typował, 0 pkt' },
  { dot: 'bg-gray-700',    label: 'brak typu / nie rozliczono' },
]

const BONUS_META: Record<string, { label: string; desc: string; settingKey: string }> = {
  perfect_round:     { label: '⭐ Perfekcyjna kolejka', desc: 'Trafisz wszystkie mecze w jednej kolejce grupowej.',  settingKey: 'perfect_round_bonus' },
  streak_3:          { label: '🔥 Passa x3',            desc: '3 trafione typy z rzędu.',                             settingKey: 'streak_3_bonus' },
  streak_5:          { label: '🔥🔥 Passa x5',           desc: '5 trafionych typów z rzędu.',                         settingKey: 'streak_5_bonus' },
  risky_pick:        { label: '🎯 Idealny typ',          desc: 'Jedyny gracz, który trafia klasyczny typ + dokładny wynik (8 pkt) w danym meczu. Typ "drużyna lub remis" się nie liczy.', settingKey: 'risky_pick_bonus' },
  tournament_winner: { label: '🏆 Zwycięzca turnieju',  desc: 'Trafiony mistrz turnieju wytypowany przed startem.',  settingKey: 'tournament_winner_bonus' },
}

const FALLBACK_POINTS: Record<string, number> = {
  perfect_round_bonus: 5, streak_3_bonus: 2, streak_5_bonus: 5,
  risky_pick_bonus: 2, tournament_winner_bonus: 20,
}

type FormSlot = { points: number | null; tooltip: string }

export default function TabelaPage() {
  const { currentUser, users, matches, predictions, bonusPoints } = useAppStore()
  const [pointsMap, setPointsMap] = useState<Record<string, number>>(FALLBACK_POINTS)

  useEffect(() => {
    fetch('/api/admin/scoring-settings')
      .then(r => r.json())
      .then(({ settings }: { settings: { key: string; value: number }[] }) => {
        if (!settings?.length) return
        setPointsMap(Object.fromEntries(settings.map(s => [s.key, s.value])))
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

  const lastFiveMatches = useMemo(() => [...matches]
    .filter(m => m.status === 'finished' && m.score_a !== null && m.score_b !== null)
    .sort((a, b) => new Date(b.match_date).getTime() - new Date(a.match_date).getTime())
    .slice(0, 5)
    .reverse(), [matches])

  const formData = useMemo((): Record<string, FormSlot[]> => {
    const result: Record<string, FormSlot[]> = {}
    for (const entry of leaderboard) {
      result[entry.id] = lastFiveMatches.map(match => {
        const pred = predictions.find(p => p.user_id === entry.id && p.match_id === match.id)
        const label = `${match.team_a} vs ${match.team_b} (${match.score_a ?? '?'}:${match.score_b ?? '?'})`
        const tooltip = pred
          ? `${label} | Typ: ${pred.predicted_a}:${pred.predicted_b} | ${(pred.points_earned ?? 0) > 0 ? '+' + pred.points_earned + ' pkt' : '0 pkt'}`
          : `${label} | Brak typu`
        return { points: pred ? (pred.points_earned ?? 0) : null, tooltip }
      })
    }
    return result
  }, [leaderboard, lastFiveMatches, predictions])

  const myBonuses = useMemo(() => bonusPoints.filter(b => b.user_id === currentUser?.id), [bonusPoints, currentUser])
  const totalBonus = myBonuses.reduce((s, b) => s + b.points, 0)

  return (
    <div>
      <h1 className="text-2xl font-black text-white mb-6">Tabela typerów</h1>

      <LeaderboardTable
        entries={leaderboard}
        currentUserId={currentUser?.id}
        formData={formData}
      />

      {/* Legend */}
      <div className="mt-4 mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 px-1">
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

      {/* Scoring summary */}
      <div className="mb-8 grid grid-cols-3 gap-3">
        {[
          { label: 'Dokładny wynik', value: '5 pkt', color: 'text-emerald-400' },
          { label: 'Trafna końcówka', value: '3 pkt', color: 'text-amber-400' },
          { label: 'Szansa podwójna', value: '1 pkt', color: 'text-blue-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
            <p className={`text-lg font-black ${color}`}>{value}</p>
            <p className="text-gray-500 text-xs mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Bonuses section */}
      <h2 className="text-lg font-bold text-white mb-3">Bonusy</h2>
      <div className="grid gap-3 mb-6">
        {Object.entries(BONUS_META).map(([key, meta]) => (
          <div key={key} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-start justify-between gap-3">
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

      {/* My bonuses */}
      {currentUser && myBonuses.length > 0 && (
        <>
          <h2 className="text-base font-bold text-white mb-3">Moje bonusy</h2>
          <div className="space-y-2 mb-6">
            {myBonuses.map(bonus => {
              const meta = BONUS_META[bonus.bonus_type]
              return (
                <div key={bonus.id} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex items-center justify-between">
                  <p className="text-white text-sm font-medium">{meta?.label || bonus.bonus_type}</p>
                  <span className="text-emerald-400 font-black">+{bonus.points}</span>
                </div>
              )
            })}
            <div className="bg-emerald-950/40 border border-emerald-900 rounded-xl px-4 py-3 flex items-center justify-between">
              <span className="text-emerald-300 font-bold text-sm">Suma bonusów</span>
              <span className="text-emerald-400 font-black">+{totalBonus}</span>
            </div>
          </div>
        </>
      )}

      {/* Bonus ranking */}
      <h2 className="text-base font-bold text-white mb-3">Ranking bonusów</h2>
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
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
                className={`flex items-center justify-between px-4 py-3 border-b border-gray-800 last:border-0 ${user.id === currentUser?.id ? 'bg-emerald-950/30' : ''}`}
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
    </div>
  )
}
