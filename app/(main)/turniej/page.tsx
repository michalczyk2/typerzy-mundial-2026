'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useAppStore } from '@/lib/store'
import { GroupTable } from '@/components/groups/GroupTable'
import { FlagImg } from '@/components/ui/FlagImg'
import { formatMatchDate, formatMatchTime } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { Match } from '@/types'

type Tab = 'groups' | 'bracket'

const GROUP_PHASE_ORDER = ['A','B','C','D','E','F','G','H','I','J','K','L']

const BRACKET_PHASES = ['round_of_32','round_of_16','quarterfinal','semifinal','final'] as const

const BRACKET_PHASE_LABEL: Record<string, string> = {
  round_of_32: '1/32 finału',
  round_of_16: '1/16 finału',
  quarterfinal: 'Ćwierćfinał',
  semifinal: 'Półfinał',
  third_place: 'Mecz o 3. miejsce',
  final: 'Finał',
}

function MiniMatchCard({ match }: { match: Match }) {
  const isFinished = match.status === 'finished'
  const isLive = match.status === 'live'
  const teamA = match.team_a || match.home_placeholder || '?'
  const teamB = match.team_b || match.away_placeholder || '?'

  return (
    <Link href={`/mecze/${match.id}`} className="block">
      <div className="bg-gray-800 border border-gray-700 hover:border-gray-600 rounded-lg px-3 py-2.5 transition-colors cursor-pointer">
        <div className="flex items-center gap-2 justify-between">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            {match.team_a_code && <FlagImg code={match.team_a_code} name={teamA} size="sm" />}
            <span className="text-white text-xs font-medium truncate">{teamA}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {isFinished || isLive ? (
              <span className={`font-black text-sm tabular-nums ${isLive ? 'text-red-400' : 'text-white'}`}>
                {match.score_a}:{match.score_b}
              </span>
            ) : (
              <span className="text-gray-500 text-xs">{formatMatchTime(match.match_date)}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
            <span className="text-white text-xs font-medium truncate text-right">{teamB}</span>
            {match.team_b_code && <FlagImg code={match.team_b_code} name={teamB} size="sm" />}
          </div>
        </div>
        {match.city && (
          <div className="text-gray-700 text-xs mt-1">{match.city} · {formatMatchDate(match.match_date)}</div>
        )}
      </div>
    </Link>
  )
}

function BracketMatchSlot({ match }: { match?: Match }) {
  const teamA = match ? (match.team_a || match.home_placeholder || 'TBD') : 'TBD'
  const teamB = match ? (match.team_b || match.away_placeholder || 'TBD') : 'TBD'
  const isFinished = match?.status === 'finished'
  const isLive = match?.status === 'live'
  const scoreA = match?.score_a
  const scoreB = match?.score_b
  const aWon = scoreA != null && scoreB != null && scoreA > scoreB
  const bWon = scoreA != null && scoreB != null && scoreB > scoreA

  const inner = (
    <div className={cn(
      'rounded-xl min-w-[150px] max-w-[180px] overflow-hidden border-2 transition-colors',
      match
        ? 'border-gray-700 hover:border-emerald-600 bg-gray-900 cursor-pointer'
        : 'border-gray-800 bg-gray-950 opacity-40 cursor-default'
    )}>
      <div className={cn('flex items-center justify-between gap-2 px-3 py-2.5 border-b border-gray-800',
        aWon && 'bg-emerald-950/30')}>
        <span className={cn('text-xs font-semibold truncate flex-1', aWon ? 'text-white' : 'text-gray-400')}>{teamA}</span>
        {(isFinished || isLive) && scoreA != null && (
          <span className={cn('font-black text-sm tabular-nums', isLive ? 'text-red-400' : aWon ? 'text-emerald-400' : 'text-white')}>
            {scoreA}
          </span>
        )}
      </div>
      <div className={cn('flex items-center justify-between gap-2 px-3 py-2.5',
        bWon && 'bg-emerald-950/30')}>
        <span className={cn('text-xs font-semibold truncate flex-1', bWon ? 'text-white' : 'text-gray-400')}>{teamB}</span>
        {(isFinished || isLive) && scoreB != null && (
          <span className={cn('font-black text-sm tabular-nums', isLive ? 'text-red-400' : bWon ? 'text-emerald-400' : 'text-white')}>
            {scoreB}
          </span>
        )}
      </div>
      {match && !isFinished && !isLive && (
        <div className="px-3 pb-2 text-gray-600 text-xs">{formatMatchDate(match.match_date)}</div>
      )}
    </div>
  )

  if (!match) return inner
  return <Link href={`/mecze/${match.id}`}>{inner}</Link>
}

export default function TurniejPage() {
  const { matches, standings } = useAppStore()
  const [tab, setTab] = useState<Tab>('groups')

  const groupMatches = useMemo(() => matches.filter(m => m.phase === 'group'), [matches])
  const knockoutMatches = useMemo(() => matches.filter(m => m.phase !== 'group'), [matches])

  const groups = useMemo(() => {
    const names = Array.from(new Set(groupMatches.map(m => m.group_name).filter(Boolean) as string[]))
      .sort((a, b) => GROUP_PHASE_ORDER.indexOf(a) - GROUP_PHASE_ORDER.indexOf(b))
    return names.map(name => ({
      name,
      standings: standings.filter(s => s.group_name === name),
      matches: groupMatches.filter(m => m.group_name === name).sort((a, b) => a.round - b.round),
    }))
  }, [groupMatches, standings])

  const bracketByPhase = useMemo(() => {
    const result: Partial<Record<string, Match[]>> = {}
    for (const phase of BRACKET_PHASES) {
      result[phase] = knockoutMatches.filter(m => m.phase === phase)
    }
    return result
  }, [knockoutMatches])

  const hasKnockout = knockoutMatches.length > 0

  const activeBracketPhases = BRACKET_PHASES.filter(p => (bracketByPhase[p]?.length ?? 0) > 0)
  const pendingBracketPhases = BRACKET_PHASES.filter(p => (bracketByPhase[p]?.length ?? 0) === 0)

  return (
    <div>
      <h1 className="text-2xl font-black text-white mb-6">Turniej</h1>

      <div className="flex gap-2 mb-6">
        {([['groups', 'Faza grupowa'], ['bracket', 'Drabinka']] as [Tab, string][]).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={cn('px-5 py-2 rounded-full text-sm font-medium transition-all',
              tab === key ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
            )}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'groups' && (
        <div className="space-y-8">
          {groups.length === 0 && (
            <div className="text-center py-12 text-gray-500">Brak danych grup.</div>
          )}
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
                    <MiniMatchCard key={match.id} match={match} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'bracket' && (
        <div>
          {!hasKnockout ? (
            <div className="text-center py-16 space-y-3">
              <div className="text-5xl">🏆</div>
              <p className="text-gray-300 font-semibold text-lg">Faza pucharowa jeszcze się nie rozpoczęła</p>
              <p className="text-gray-600 text-sm">Drabinka zostanie uzupełniona po zakończeniu fazy grupowej.</p>
              <div className="pt-4">
                <button onClick={() => setTab('groups')}
                  className="text-emerald-400 text-sm hover:underline">
                  → Zobacz fazę grupową
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto pb-6 -mx-4 px-4">
              <div className="flex gap-8 min-w-max items-start">
                {activeBracketPhases.map(phase => (
                  <div key={phase} className="flex flex-col gap-2">
                    <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider text-center mb-2">
                      {BRACKET_PHASE_LABEL[phase]}
                    </h3>
                    <div className="flex flex-col gap-4">
                      {bracketByPhase[phase]!.map(match => (
                        <BracketMatchSlot key={match.id} match={match} />
                      ))}
                    </div>
                  </div>
                ))}
                {pendingBracketPhases.slice(0, Math.max(0, 4 - activeBracketPhases.length)).map((phase, col) => {
                  const refCount = bracketByPhase[activeBracketPhases[activeBracketPhases.length - 1]]?.length ?? 2
                  const slotCount = Math.max(1, Math.ceil(refCount / Math.pow(2, col + 1)))
                  return (
                    <div key={phase} className="flex flex-col gap-2">
                      <h3 className="text-gray-600 text-xs font-bold uppercase tracking-wider text-center mb-2">
                        {BRACKET_PHASE_LABEL[phase]}
                      </h3>
                      <div className="flex flex-col gap-4">
                        {Array.from({ length: slotCount }).map((_, i) => (
                          <BracketMatchSlot key={i} />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
