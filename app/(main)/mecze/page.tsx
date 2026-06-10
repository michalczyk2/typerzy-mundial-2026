'use client'
import { useState, useMemo } from 'react'
import { useAppStore } from '@/lib/store'
import { MatchCard } from '@/components/matches/MatchCard'
import { cn } from '@/lib/utils'

type Filter = 'all' | 'upcoming' | 'live' | 'finished'

export default function MeczePage() {
  const { currentUser, matches, predictions } = useAppStore()
  const [filter, setFilter] = useState<Filter>('all')

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
      <h1 className="text-2xl font-black text-white mb-6">Mecze</h1>
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
    </div>
  )
}
