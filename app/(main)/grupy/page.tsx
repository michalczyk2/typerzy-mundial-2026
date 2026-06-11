'use client'
import { useMemo } from 'react'
import Link from 'next/link'
import { useAppStore } from '@/lib/store'
import { GroupTable } from '@/components/groups/GroupTable'
import { TeamBadge } from '@/components/ui/TeamBadge'
import { formatMatchDate, formatMatchTime } from '@/lib/utils'
import type { Match } from '@/types'

const GROUP_PHASE_ORDER = ['A','B','C','D','E','F','G','H','I','J','K','L']

function GroupMatchCard({ match }: { match: Match }) {
  const isFinished = match.status === 'finished'
  const isLive = match.status === 'live'
  const teamA = match.team_a || match.home_placeholder || '?'
  const teamB = match.team_b || match.away_placeholder || '?'

  return (
    <Link href={`/mecze/${match.id}`} className="block">
      <div className="bg-gray-800 border border-gray-700 hover:border-gray-600 rounded-lg px-3 py-2.5 transition-colors cursor-pointer">
        <div className="flex items-center gap-2 justify-between">
          <TeamBadge code={match.team_a_code} name={teamA} size="sm" className="flex-1 min-w-0" />
          <div className="shrink-0 px-1 text-center">
            {isFinished || isLive ? (
              <span className={`font-black text-sm tabular-nums ${isLive ? 'text-red-400' : 'text-white'}`}>
                {match.score_a}:{match.score_b}
              </span>
            ) : (
              <span className="text-gray-500 text-xs font-medium">{formatMatchTime(match.match_date)}</span>
            )}
          </div>
          <TeamBadge code={match.team_b_code} name={teamB} size="sm" reverse nameClassName="text-white text-xs font-medium truncate" className="flex-1 min-w-0 justify-end" />
        </div>
        {!isFinished && !isLive && (
          <div className="text-gray-600 text-xs mt-1 text-center">{formatMatchDate(match.match_date)}</div>
        )}
      </div>
    </Link>
  )
}

export default function GrupyPage() {
  const { standings, matches } = useAppStore()

  const groupMatches = useMemo(() => matches.filter(m => m.phase === 'group'), [matches])

  const groups = useMemo(() => {
    const names = Array.from(new Set(groupMatches.map(m => m.group_name).filter(Boolean) as string[]))
      .sort((a, b) => GROUP_PHASE_ORDER.indexOf(a) - GROUP_PHASE_ORDER.indexOf(b))
    return names.map(name => ({
      name,
      standings: standings.filter(s => s.group_name === name),
      matches: groupMatches.filter(m => m.group_name === name).sort((a, b) => a.round - b.round),
    }))
  }, [groupMatches, standings])

  return (
    <div>
      <h1 className="text-2xl font-black text-white mb-6">Grupy</h1>
      {groups.length === 0 ? (
        <div className="text-center py-12 text-gray-500">Brak danych grupowych — zostaną załadowane po starcie turnieju.</div>
      ) : (
        <div className="space-y-8">
          {groups.map(group => (
            <div key={group.name} className="space-y-3">
              {group.standings.length > 0 ? (
                <GroupTable groupName={group.name} standings={group.standings} />
              ) : (
                <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
                  <h3 className="text-white font-bold">Grupa {group.name}</h3>
                  <p className="text-gray-600 text-xs mt-1">Tabela dostępna po rozegraniu pierwszych meczów.</p>
                </div>
              )}
              {group.matches.length > 0 && (
                <div className="space-y-1.5">
                  {group.matches.map(match => (
                    <GroupMatchCard key={match.id} match={match} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
