'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/lib/store'
import { FlagImg } from '@/components/ui/FlagImg'
import { cn, formatMatchDate, formatMatchTime } from '@/lib/utils'
import type { SuperSocialMatch, SuperSocialResponse } from '@/types'

type Filter = 'upcoming' | 'live' | 'finished' | 'all'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'upcoming', label: 'Nadchodzące' },
  { key: 'live', label: 'Na żywo' },
  { key: 'finished', label: 'Zakończone' },
  { key: 'all', label: 'Wszystkie' },
]

export default function SuperSocialPage() {
  const { currentUser } = useAppStore()
  const router = useRouter()
  const [data, setData] = useState<SuperSocialResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('upcoming')

  useEffect(() => {
    if (!currentUser) {
      router.replace('/')
      return
    }
    fetch('/api/data/super-social')
      .then(r => r.json())
      .then((json: SuperSocialResponse) => setData(json))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [currentUser, router])

  const filtered = useMemo(() => {
    if (!data) return []
    const { matches } = data
    if (filter === 'all') return matches
    if (filter === 'live') return matches.filter(m => m.status === 'live')
    if (filter === 'finished') return matches.filter(m => m.status === 'finished')
    return matches.filter(m => m.status === 'scheduled')
  }, [data, filter])

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-black text-white">Super Social</h1>
        <p className="text-gray-500 text-sm mt-1">Typy wszystkich graczy na każdy mecz</p>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              'px-4 py-2 rounded-full text-sm font-medium transition-all',
              filter === f.key
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Ładowanie...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500">Brak meczów w tej kategorii.</div>
      ) : (
        <div className="space-y-4">
          {filtered.map(match => (
            <MatchCard key={match.id} match={match} />
          ))}
        </div>
      )}
    </div>
  )
}

function MatchCard({ match }: { match: SuperSocialMatch }) {
  const isFinished = match.status === 'finished'
  const isLive = match.status === 'live'

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 p-3 border-b border-gray-800">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <FlagImg code={match.team_a_code} name={match.team_a} size="sm" />
          <span className="text-white font-semibold text-sm truncate">{match.team_a}</span>
        </div>

        <div className="shrink-0 text-center min-w-[56px]">
          {isFinished || isLive ? (
            <span className={cn('text-base font-black tabular-nums', isLive ? 'text-emerald-400' : 'text-white')}>
              {match.score_a ?? 0}:{match.score_b ?? 0}
            </span>
          ) : (
            <span className="text-gray-500 text-sm font-medium">{formatMatchTime(match.match_date)}</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
          <span className="text-white font-semibold text-sm truncate text-right">{match.team_b}</span>
          <FlagImg code={match.team_b_code} name={match.team_b} size="sm" />
        </div>
      </div>

      <div className="px-3 py-1.5 flex items-center justify-between border-b border-gray-800/40">
        <span className="text-gray-600 text-xs">{formatMatchDate(match.match_date)}</span>
        <span
          className={cn(
            'text-xs font-medium px-2 py-0.5 rounded-full',
            isLive
              ? 'bg-emerald-900/50 text-emerald-400'
              : isFinished
                ? 'bg-gray-800 text-gray-500'
                : 'bg-gray-800 text-gray-600',
          )}
        >
          {isLive ? 'Na żywo' : isFinished ? 'Zakończony' : 'Zaplanowany'}
        </span>
      </div>

      <div className="divide-y divide-gray-800/40">
        {match.predictions.map(pred => {
          const hasPred = pred.predicted_a !== null
          const isExact = pred.is_correct_score === true
          const isOutcome = !isExact && pred.is_correct_outcome === true

          return (
            <div key={pred.user_id} className="flex items-center gap-2 px-3 py-2">
              <span className="text-gray-400 text-sm w-24 shrink-0 truncate">{pred.nick}</span>

              <div className="flex-1 flex items-center gap-1.5">
                {hasPred ? (
                  <>
                    <span
                      className={cn(
                        'text-sm font-mono font-semibold tabular-nums',
                        isExact
                          ? 'text-emerald-400'
                          : isOutcome
                            ? 'text-orange-400'
                            : isFinished
                              ? 'text-red-400'
                              : 'text-white',
                      )}
                    >
                      {pred.predicted_a}:{pred.predicted_b}
                    </span>
                    {isExact && <span className="text-emerald-500 text-xs">✓✓</span>}
                    {isOutcome && <span className="text-orange-400 text-xs">✓</span>}
                  </>
                ) : (
                  <span className="text-gray-600 text-sm">⚠️ brak</span>
                )}
              </div>

              {isFinished && hasPred && (
                <span
                  className={cn(
                    'text-xs font-semibold tabular-nums shrink-0',
                    isExact
                      ? 'text-emerald-400'
                      : isOutcome
                        ? 'text-orange-400'
                        : 'text-gray-600',
                  )}
                >
                  {pred.points_earned ?? 0} pkt
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
