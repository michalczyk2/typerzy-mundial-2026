'use client'
import { useState, useMemo, useEffect, useCallback } from 'react'
import { useAppStore } from '@/lib/store'
import { MatchCard } from '@/components/matches/MatchCard'
import { ChampionPicker } from '@/components/matches/ChampionPicker'
import { FlagImg } from '@/components/ui/FlagImg'
import { MatchOfDayBanner } from '@/components/match-of-day/MatchOfDayBanner'
import { cn } from '@/lib/utils'
import { IS_PRODUCTION_MODE } from '@/lib/tournament-config'
import { PushNotificationButton } from '@/components/PushNotificationButton'

type Filter = 'all' | 'upcoming' | 'live' | 'finished'

interface ChampionState {
  pick: { team_code: string; team_name: string } | null
  enabled: boolean
}

interface MatchOfDayData {
  enabled?: boolean
  event: {
    id: string
    official_match_day: string
    vote_deadline: string
    selected_bonus_points: number | null
    status: 'voting' | 'locked' | 'settled'
    match: {
      id: string
      team_a: string
      team_b: string
      team_a_code: string
      team_b_code: string
      match_date: string
      status: string
      score_a: number | null
      score_b: number | null
    }
  }
  isVotingOpen: boolean
  myVote: number | null
  voteCounts: Record<number, number> | null
  totalVotes: number
}

export default function MeczePage() {
  const { currentUser, matches, predictions } = useAppStore()
  const [filter, setFilter] = useState<Filter>('upcoming')
  const [champion, setChampion] = useState<ChampionState>({ pick: null, enabled: false })
  const [pickerOpen, setPickerOpen] = useState(false)
  const [modData, setModData] = useState<MatchOfDayData | null>(null)
  const [voting, setVoting] = useState(false)

  useEffect(() => {
    if (!currentUser) return
    fetch('/api/champion-prediction')
      .then(r => r.json())
      .then((data: { pick: ChampionState['pick']; enabled: boolean }) => {
        setChampion({ pick: data.pick, enabled: data.enabled })
      })
      .catch(() => {})
  }, [currentUser])

  useEffect(() => {
    if (!IS_PRODUCTION_MODE) return
    fetch('/api/match-of-day/current')
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        if (json?.enabled === false) { setModData(null); return }
        if (json?.event) setModData(json)
      })
      .catch(() => {})
  }, [])

  const handleVote = useCallback(async (eventId: string, bonusPoints: number) => {
    if (voting) return
    setVoting(true)
    try {
      const res = await fetch('/api/match-of-day/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventId, bonus_points: bonusPoints }),
      })
      if (res.ok) {
        const refreshRes = await fetch('/api/match-of-day/current')
        if (refreshRes.ok) {
          const json = await refreshRes.json()
          if (json?.event) setModData(json)
        }
      }
    } finally {
      setVoting(false)
    }
  }, [voting])

  const filtered = useMemo(() => {
    if (filter === 'all') return matches
    if (filter === 'upcoming') return [...matches.filter(m => m.status === 'scheduled')].sort((a, b) => new Date(a.match_date).getTime() - new Date(b.match_date).getTime())
    if (filter === 'live') return matches.filter(m => m.status === 'live')
    return matches.filter(m => m.status === 'finished')
  }, [matches, filter])

  const modMatchId = modData?.event?.match?.id ?? null

  const canVote = IS_PRODUCTION_MODE
    && currentUser?.status === 'active'
    && modData?.isVotingOpen === true

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: 'Wszystkie' },
    { key: 'upcoming', label: 'Nadchodzące' },
    { key: 'live', label: 'Na żywo' },
    { key: 'finished', label: 'Zakończone' },
  ]

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-white">Mecze</h1>
          <a href="/super-social" className="text-lg text-emerald-500 hover:text-emerald-400 font-bold">
            Super Social →
          </a>
        </div>
        <PushNotificationButton />
      </div>

      {modData && (canVote || modData.event.status === 'settled' || !modData.isVotingOpen) && (
        <MatchOfDayBanner
          data={modData}
          onVote={canVote ? handleVote : async () => {}}
          voting={voting}
        />
      )}

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
              <MatchCard
                key={match.id}
                match={match}
                prediction={pred}
                currentUser={currentUser}
                isMatchOfDay={match.id === modMatchId}
              />
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
