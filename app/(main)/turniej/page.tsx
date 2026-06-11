'use client'
import { useMemo } from 'react'
import Link from 'next/link'
import { useAppStore } from '@/lib/store'
import { TeamBadge } from '@/components/ui/TeamBadge'
import { formatMatchDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { Match } from '@/types'

const BRACKET_PHASES = ['round_of_32','round_of_16','quarterfinal','semifinal','final'] as const

const BRACKET_PHASE_LABEL: Record<string, string> = {
  round_of_32: '1/32 finału',
  round_of_16: '1/16 finału',
  quarterfinal: 'Ćwierćfinał',
  semifinal: 'Półfinał',
  third_place: 'Mecz o 3. miejsce',
  final: 'Finał',
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
      'rounded-xl min-w-[160px] max-w-[190px] overflow-hidden border-2 transition-colors',
      match
        ? 'border-gray-700 hover:border-emerald-600 bg-gray-900 cursor-pointer'
        : 'border-gray-800 bg-gray-950 opacity-40 cursor-default'
    )}>
      <div className={cn('flex items-center justify-between gap-2 px-3 py-2.5 border-b border-gray-800',
        aWon && 'bg-emerald-950/30')}>
        <TeamBadge
          code={match?.team_a_code ?? ''}
          name={teamA}
          size="sm"
          nameClassName={cn('text-xs font-semibold truncate', aWon ? 'text-white' : 'text-gray-400')}
          className="flex-1 min-w-0"
        />
        {(isFinished || isLive) && scoreA != null && (
          <span className={cn('font-black text-sm tabular-nums shrink-0', isLive ? 'text-red-400' : aWon ? 'text-emerald-400' : 'text-white')}>
            {scoreA}
          </span>
        )}
      </div>
      <div className={cn('flex items-center justify-between gap-2 px-3 py-2.5',
        bWon && 'bg-emerald-950/30')}>
        <TeamBadge
          code={match?.team_b_code ?? ''}
          name={teamB}
          size="sm"
          nameClassName={cn('text-xs font-semibold truncate', bWon ? 'text-white' : 'text-gray-400')}
          className="flex-1 min-w-0"
        />
        {(isFinished || isLive) && scoreB != null && (
          <span className={cn('font-black text-sm tabular-nums shrink-0', isLive ? 'text-red-400' : bWon ? 'text-emerald-400' : 'text-white')}>
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
  const { matches } = useAppStore()

  const knockoutMatches = useMemo(() => matches.filter(m => m.phase !== 'group'), [matches])

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
      <h1 className="text-2xl font-black text-white mb-6">Drabinka</h1>

      {!hasKnockout ? (
        <div className="text-center py-16 space-y-3">
          <div className="text-5xl">🏆</div>
          <p className="text-gray-300 font-semibold text-lg">Faza pucharowa jeszcze się nie rozpoczęła</p>
          <p className="text-gray-600 text-sm">Drabinka zostanie uzupełniona po zakończeniu fazy grupowej.</p>
          <div className="pt-4">
            <Link href="/grupy" className="text-emerald-400 text-sm hover:underline">
              → Zobacz fazę grupową
            </Link>
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
  )
}
