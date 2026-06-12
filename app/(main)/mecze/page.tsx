'use client'
import { useState, useMemo, useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { MatchCard } from '@/components/matches/MatchCard'
import { ChampionPicker } from '@/components/matches/ChampionPicker'
import { FlagImg } from '@/components/ui/FlagImg'
import { cn } from '@/lib/utils'

type Filter = 'all' | 'upcoming' | 'live' | 'finished'

interface ChampionState {
  pick: { team_code: string; team_name: string } | null
  enabled: boolean
}

export default function MeczePage() {
  const { currentUser, matches, predictions } = useAppStore()
  const [filter, setFilter] = useState<Filter>('all')
  const [champion, setChampion] = useState<ChampionState>({ pick: null, enabled: false })
  const [pickerOpen, setPickerOpen] = useState(false)

  useEffect(() => {
    if (!currentUser) return
    fetch('/api/champion-prediction')
      .then(r => r.json())
      .then((data: { pick: ChampionState['pick']; enabled: boolean }) => {
        setChampion({ pick: data.pick, enabled: data.enabled })
      })
      .catch(() => {})
  }, [currentUser])

  const filtered = useMemo(() => {
    if (filter === 'all') return matches
    if (filter === 'upcoming') return matches.filter(m => m.status === 'scheduled')
    if (filter === 'live') return matches.filter(m => m.status === 'live')
    return matches.filter(m => m.status === 'finished')
  }, [matches, filter])

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: 'Wszystkie' },
    { key: 'upcoming', label: 'Nadchodzące' },
    { key: 'live', label: 'Na żywo' },
    { key: 'finished', label: 'Zakończone' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-black text-white mb-4">Mecze</h1>

      {champion.enabled && (
        <button
          onClick={() => setPickerOpen(true)}
          className="w-full flex items-center gap-3 bg-gray-900 border border-gray-800 hover:border-emerald-700 rounded-xl p-4 mb-6 transition-colors text-left"
        >
          <span className="text-lg">🏆</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Twój mistrz turnieju</p>
            {champion.pick ? (
              <div className="flex items-center gap-2 mt-0.5">
                <FlagImg code={champion.pick.team_code} name={champion.pick.team_name} size="sm" />
                <span className="text-white font-semibold text-sm">{champion.pick.team_name}</span>
              </div>
            ) : (
              <p className="text-emerald-400 text-sm font-medium mt-0.5">Wytypuj mistrza — bonus +20 pkt</p>
            )}
          </div>
          <span className="text-gray-600 text-sm shrink-0">{champion.pick ? 'Zmień' : 'Wybierz'} →</span>
        </button>
      )}

      <div className="flex gap-2 mb-6 flex-wrap">
        {filters.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={cn('px-4 py-2 rounded-full text-sm font-medium transition-all',
              filter === f.key ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white')}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500">Brak meczów w tej kategorii.</div>
        ) : (
          filtered.map(match => {
            const pred = predictions.find(pr => pr.match_id === match.id && pr.user_id === currentUser?.id)
            return (
              <MatchCard key={match.id} match={match} prediction={pred} currentUser={currentUser} />
            )
          })
        )}
      </div>

      {pickerOpen && (
        <ChampionPicker
          currentPick={champion.pick}
          onClose={() => setPickerOpen(false)}
          onSaved={(code, name) => {
            setChampion(s => ({ ...s, pick: { team_code: code, team_name: name } }))
            setPickerOpen(false)
          }}
        />
      )}
    </div>
  )
}
