'use client'
import { useState, useMemo, useEffect, useCallback } from 'react'
import { useAppStore } from '@/lib/store'
import { MatchCard } from '@/components/matches/MatchCard'
import { MatchOfDayBanner } from '@/components/match-of-day/MatchOfDayBanner'
import { cn } from '@/lib/utils'
import { IS_PRODUCTION_MODE } from '@/lib/tournament-config'

type Filter = 'all' | 'upcoming' | 'live' | 'finished'

interface MatchOfDayData {
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
  const [filter, setFilter] = useState<Filter>('all')
  const [modData, setModData] = useState<MatchOfDayData | null>(null)
  const [voting, setVoting] = useState(false)

  useEffect(() => {
    if (!IS_PRODUCTION_MODE) return
    fetch('/api/match-of-day/current')
      .then(r => r.ok ? r.json() : null)
      .then(json => { if (json?.event) setModData(json) })
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
        // Refresh banner data after successful vote
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
    if (filter === 'upcoming') return matches.filter(m => m.status === 'scheduled')
    if (filter === 'live') return matches.filter(m => m.status === 'live')
    return matches.filter(m => m.status === 'finished')
  }, [matches, filter])

  const modMatchId = modData?.event?.match?.id ?? null

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: 'Wszystkie' },
    { key: 'upcoming', label: 'Nadchodzące' },
    { key: 'live', label: 'Na żywo' },
    { key: 'finished', label: 'Zakończone' },
  ]

  const canVote = IS_PRODUCTION_MODE
    && currentUser?.status === 'active'
    && modData?.isVotingOpen === true

  return (
    <div>
      <h1 className="text-2xl font-black text-white mb-6">Mecze</h1>

      {/* Match of Day banner — only shown when event exists and user is active */}
      {modData && (canVote || modData.event.status === 'settled' || !modData.isVotingOpen) && (
        <MatchOfDayBanner
          data={modData}
          onVote={canVote ? handleVote : async () => {}}
          voting={voting}
        />
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
    </div>
  )
}
