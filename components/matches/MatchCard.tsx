'use client'
import Link from 'next/link'
import type { Match, Prediction, User } from '@/types'
import { Badge } from '@/components/ui/Badge'
import { TeamBadge } from '@/components/ui/TeamBadge'
import { formatMatchDate, formatMatchTime, isMatchLocked, getCountdown, getPhaseLabel } from '@/lib/utils'

interface Props { match: Match; prediction?: Prediction; currentUser?: User | null }

export function MatchCard({ match, prediction, currentUser }: Props) {
  const locked = isMatchLocked(match.match_date)
  const isFinished = match.status === 'finished'
  const isLive = match.status === 'live'

  const teamA = match.team_a || match.home_placeholder || '?'
  const teamB = match.team_b || match.away_placeholder || '?'

  const predBadge = () => {
    if (!currentUser || currentUser.status !== 'active') return null
    if (locked && !prediction) return (
      <span className="text-xs text-gray-500 font-medium">Zablokowane</span>
    )
    if (prediction) return (
      <span className="text-xs text-emerald-400 font-medium">✓ Typ: {prediction.predicted_a}:{prediction.predicted_b}</span>
    )
    return <span className="text-xs text-amber-400 font-medium">Brak typu</span>
  }

  return (
    <Link href={`/mecze/${match.id}`} className="block">
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-gray-700 transition-colors cursor-pointer">
        <div className="flex items-center justify-between px-4 py-2 bg-gray-950 border-b border-gray-800 text-xs text-gray-500">
          <span>{match.group_name ? `Grupa ${match.group_name} · Kolejka ${match.round}` : getPhaseLabel(match.phase)}</span>
          <div className="flex items-center gap-2">
            {isLive && <Badge variant="live">NA ŻYWO</Badge>}
            {isFinished && <Badge variant="finished">Zakończony</Badge>}
            {!locked && !isLive && <span className="text-blue-400 font-medium">{getCountdown(match.match_date)}</span>}
            {match.data_source === 'mock' && <span className="text-gray-700 text-xs">mock</span>}
          </div>
        </div>

        <div className="px-4 py-5">
          <div className="flex items-center justify-between gap-2">
            <TeamBadge code={match.team_a_code} name={teamA} size="lg" direction="col" className="flex-1" />
            <div className="flex flex-col items-center min-w-[90px]">
              {isFinished || isLive ? (
                <>
                  <div className="text-3xl font-black text-white tabular-nums">
                    {match.score_a}<span className="text-gray-600 mx-1">:</span>{match.score_b}
                  </div>
                  {isLive && <span className="text-red-400 text-xs font-bold mt-1 animate-pulse">LIVE</span>}
                  {match.halftime_a !== null && isFinished && (
                    <span className="text-gray-600 text-xs mt-1">({match.halftime_a}:{match.halftime_b})</span>
                  )}
                </>
              ) : (
                <>
                  <div className="text-xl font-bold text-gray-200">{formatMatchTime(match.match_date)}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{formatMatchDate(match.match_date)}</div>
                </>
              )}
              {match.city && <span className="text-xs text-gray-600 mt-2">{match.city}</span>}
            </div>
            <TeamBadge code={match.team_b_code} name={teamB} size="lg" direction="col" className="flex-1" />
          </div>
        </div>

        {currentUser && currentUser.status === 'active' && (
          <div className="border-t border-gray-800 px-4 py-2 flex items-center justify-between">
            {predBadge()}
            <span className="text-xs text-gray-600">Kliknij aby typować →</span>
          </div>
        )}
      </div>
    </Link>
  )
}
