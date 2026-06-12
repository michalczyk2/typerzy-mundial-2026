'use client'
import { useMemo, useState, useEffect } from 'react'
import { useAppStore } from '@/lib/store'

const BONUS_META: Record<string, { label: string; desc: string; example: string; settingKey: string }> = {
  perfect_round:      {
    label: '⭐ Perfekcyjna kolejka',
    desc: 'Trafisz wynik (W/R/P) każdego meczu w danej kolejce fazy grupowej — min. 3 pkt za każdy mecz.',
    example: 'Kolejka 1 ma 16 meczów. Trafiasz wszystkie — bonus przyznany.',
    settingKey: 'perfect_round_bonus',
  },
  streak_3:           {
    label: '🔥 Passa x3',
    desc: '3 trafne typy z rzędu (wynik lub dokładny wynik) w dowolnym momencie turnieju.',
    example: 'Mecz A trafiony, B trafiony, C trafiony — bonus po meczu C.',
    settingKey: 'streak_3_bonus',
  },
  streak_5:           {
    label: '🔥🔥 Passa x5',
    desc: '5 trafnych typów z rzędu. Kumuluje się z bonusem za passę x3.',
    example: 'Seria 5 trafionych meczów pod rząd — dostajesz oba bonusy.',
    settingKey: 'streak_5_bonus',
  },
  risky_pick:         {
    label: '🎲 Ryzykowny typ',
    desc: 'Byłeś jedynym graczem w grupie, który trafił wynik danego meczu (W/R/P).',
    example: 'Wszyscy typują remis, Ty typujesz wygraną — i masz rację. Bonus tylko dla Ciebie.',
    settingKey: 'risky_pick_bonus',
  },
  tournament_winner:  {
    label: '🏆 Zwycięzca turnieju',
    desc: 'Wytypowałeś mistrza turnieju przed startem rozgrywek. Typ blokuje się po otwarciu turnieju.',
    example: 'Wpisujesz Brazylię przed 1. gwizdkiem — Brazylia wygrywa — dostajesz bonus.',
    settingKey: 'tournament_winner_bonus',
  },
}

const FALLBACK_POINTS: Record<string, number> = {
  perfect_round_bonus: 5, streak_3_bonus: 2, streak_5_bonus: 5,
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
          <div key={key} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-white font-semibold">{meta.label}</span>
              <span className="text-emerald-400 font-black text-sm shrink-0">+{pointsMap[meta.settingKey] ?? FALLBACK_POINTS[meta.settingKey]} pkt</span>
            </div>
            <p className="text-gray-400 text-xs">{meta.desc}</p>
            <p className="text-gray-600 text-xs mt-1 italic">{meta.example}</p>
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
        {users.filter(u=>u.status==='active' && u.role !== 'admin').sort((a,b) => {
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
