'use client'
import { useMemo, useState, useEffect } from 'react'
import { useAppStore } from '@/lib/store'

const BONUS_META: Record<string, { label: string; desc: string; settingKey: string }> = {
  round_king:         { label: '👑 Król kolejki',        desc: 'Najwięcej punktów w danej kolejce grupowej', settingKey: 'round_winner_bonus' },
  streak_3:           { label: '🔥 Passa x3',            desc: '3 trafne typy z rzędu (wynik lub dokładny)', settingKey: 'streak_3_bonus' },
  streak_5:           { label: '🔥🔥 Passa x5',          desc: '5 trafnych typów z rzędu',                  settingKey: 'streak_5_bonus' },
  risky_pick:         { label: '🎲 Ryzykowny typ',        desc: 'Jedynym graczem, który trafił wynik meczu', settingKey: 'risky_pick_bonus' },
  tournament_winner:  { label: '🏆 Zwycięzca turnieju',  desc: 'Typowanie mistrza przed turniejem',          settingKey: 'tournament_winner_bonus' },
}

const FALLBACK_POINTS: Record<string, number> = {
  round_winner_bonus: 3, streak_3_bonus: 2, streak_5_bonus: 5,
  risky_pick_bonus: 2, tournament_winner_bonus: 20,
}

export default function BonusyPage() {
  const { currentUser, users, bonusPoints } = useAppStore()
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

  const myBonuses = useMemo(() => bonusPoints.filter(b => b.user_id === currentUser?.id), [bonusPoints, currentUser])
  const totalBonus = myBonuses.reduce((s,b) => s+b.points, 0)

  return (
    <div>
      <h1 className="text-2xl font-black text-white mb-2">Bonusy</h1>
      <p className="text-gray-500 text-sm mb-6">Dodatkowe punkty za wyjątkowe osiągnięcia</p>

      <div className="grid gap-3 mb-8">
        {Object.entries(BONUS_META).map(([key, meta]) => (
          <div key={key} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-start gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-white font-semibold">{meta.label}</span>
                <span className="text-emerald-400 font-black text-sm">+{pointsMap[meta.settingKey] ?? FALLBACK_POINTS[meta.settingKey]} pkt</span>
              </div>
              <p className="text-gray-500 text-xs mt-1">{meta.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <h2 className="text-lg font-bold text-white mb-4">Moje bonusy</h2>
      {myBonuses.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">Nie masz jeszcze żadnych bonusów — wróć w trakcie turnieju!</div>
      ) : (
        <div className="space-y-3">
          {myBonuses.map(bonus => {
            const meta = BONUS_META[bonus.bonus_type]
            return (
              <div key={bonus.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">{meta?.label || bonus.bonus_type}</p>
                  {bonus.description && <p className="text-gray-500 text-xs mt-0.5">{bonus.description}</p>}
                </div>
                <span className="text-emerald-400 font-black text-lg">+{bonus.points}</span>
              </div>
            )
          })}
          <div className="bg-emerald-950/40 border border-emerald-900 rounded-xl p-4 flex items-center justify-between">
            <span className="text-emerald-300 font-bold">Suma bonusów</span>
            <span className="text-emerald-400 font-black text-xl">+{totalBonus}</span>
          </div>
        </div>
      )}

      <h2 className="text-lg font-bold text-white mt-8 mb-4">Ranking bonusów</h2>
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {users.filter(u=>u.status==='active').sort((a,b) => {
          const aB = bonusPoints.filter(bp=>bp.user_id===a.id).reduce((s,bp)=>s+bp.points,0)
          const bB = bonusPoints.filter(bp=>bp.user_id===b.id).reduce((s,bp)=>s+bp.points,0)
          return bB - aB
        }).map((user, i) => {
          const total = bonusPoints.filter(bp=>bp.user_id===user.id).reduce((s,bp)=>s+bp.points,0)
          return (
            <div key={user.id} className={`flex items-center justify-between px-4 py-3 border-b border-gray-800 last:border-0 ${user.id===currentUser?.id ? 'bg-emerald-950/30' : ''}`}>
              <div className="flex items-center gap-3">
                <span className="text-gray-600 text-sm w-6 text-center">{i+1}</span>
                <span className={`font-medium text-sm ${user.id===currentUser?.id ? 'text-emerald-400' : 'text-white'}`}>{user.nick}</span>
              </div>
              <span className="text-purple-400 font-bold">{total > 0 ? `+${total}` : '0'} pkt</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
