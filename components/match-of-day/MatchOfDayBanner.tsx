'use client'
import { TeamBadge } from '@/components/ui/TeamBadge'
import { formatMatchDate, formatMatchTime, cn } from '@/lib/utils'

interface EventMatch {
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

interface MatchOfDayData {
  event: {
    id: string
    official_match_day: string
    vote_deadline: string
    selected_bonus_points: number | null
    status: 'voting' | 'locked' | 'settled'
    match: EventMatch
  }
  isVotingOpen: boolean
  myVote: number | null
  voteCounts: Record<number, number> | null
  totalVotes: number
}

interface Props {
  data: MatchOfDayData
  onVote: (eventId: string, bonusPoints: number) => Promise<void>
  voting?: boolean
}

const BONUS_OPTIONS = [4, 3, 2, 1] as const

export function MatchOfDayBanner({ data, onVote, voting = false }: Props) {
  const { event, isVotingOpen, myVote, voteCounts, totalVotes } = data
  const { match } = event

  const deadlineStr = `${formatMatchDate(event.vote_deadline)}, ${formatMatchTime(event.vote_deadline)}`

  return (
    <div className="relative rounded-xl overflow-hidden border border-amber-500/40 bg-gray-900 shadow-[0_0_30px_-6px_rgba(251,191,36,0.2)] mb-6">
      {/* Fire gradient top bar */}
      <div className="h-1 w-full bg-gradient-to-r from-orange-600 via-amber-400 to-orange-600"
        style={{ animation: 'streak-flicker 2.2s ease-in-out infinite' }} />

      {/* Side fire effects */}
      <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-amber-500/15 to-transparent pointer-events-none"
        style={{ animation: 'streak-flicker 2.2s ease-in-out infinite' }} />
      <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-orange-500/10 to-transparent pointer-events-none"
        style={{ animation: 'streak-flicker 2.2s ease-in-out infinite 1.1s' }} />

      <div className="px-4 pt-3 pb-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">🔥</span>
          <span className="text-sm font-bold text-amber-400 tracking-wide">MECZ DNIA</span>
          <span className="text-xs text-amber-700 ml-auto">{formatMatchDate(match.match_date)}</span>
        </div>

        {/* Match */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <TeamBadge
            code={match.team_a_code}
            name={match.team_a || '?'}
            size="md"
            direction="col"
            className="flex-1"
          />
          <div className="flex flex-col items-center min-w-[72px]">
            {match.status === 'finished' || match.status === 'live' ? (
              <span className="text-2xl font-black text-white tabular-nums">
                {match.score_a}<span className="text-gray-600 mx-0.5">:</span>{match.score_b}
              </span>
            ) : (
              <>
                <span className="text-lg font-bold text-gray-200">{formatMatchTime(match.match_date)}</span>
                <span className="text-xs text-gray-500">start</span>
              </>
            )}
          </div>
          <TeamBadge
            code={match.team_b_code}
            name={match.team_b || '?'}
            size="md"
            direction="col"
            className="flex-1"
          />
        </div>

        {/* Voting section */}
        {event.status === 'settled' ? (
          <SettledView selectedBonus={event.selected_bonus_points} voteCounts={voteCounts} totalVotes={totalVotes} />
        ) : isVotingOpen ? (
          <VotingView
            eventId={event.id}
            myVote={myVote}
            totalVotes={totalVotes}
            deadlineStr={deadlineStr}
            onVote={onVote}
            voting={voting}
          />
        ) : (
          <LockedView totalVotes={totalVotes} />
        )}
      </div>
    </div>
  )
}

function VotingView({ eventId, myVote, totalVotes, deadlineStr, onVote, voting }: {
  eventId: string
  myVote: number | null
  totalVotes: number
  deadlineStr: string
  onVote: (eventId: string, bonus: number) => Promise<void>
  voting: boolean
}) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-2 font-medium">Wybierz bonus za poprawny typ:</p>
      <div className="grid grid-cols-4 gap-2">
        {BONUS_OPTIONS.map(bonus => (
          <button
            key={bonus}
            disabled={voting}
            onClick={() => onVote(eventId, bonus)}
            className={cn(
              'py-2 rounded-lg text-sm font-bold transition-all border',
              myVote === bonus
                ? 'bg-amber-500 border-amber-400 text-gray-900 shadow-[0_0_12px_rgba(251,191,36,0.4)]'
                : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-amber-600/50 hover:text-amber-300 active:scale-95',
              voting && 'opacity-60 cursor-not-allowed'
            )}
          >
            +{bonus} pkt
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-600 mt-2">
        {myVote ? `Twój głos: +${myVote} pkt · ` : ''}
        Głosuj do {deadlineStr}
        {totalVotes > 0 && ` · ${totalVotes} ${totalVotes === 1 ? 'głos' : totalVotes < 5 ? 'głosy' : 'głosów'}`}
      </p>
    </div>
  )
}

function LockedView({ totalVotes }: { totalVotes: number }) {
  return (
    <div className="text-center py-1">
      <p className="text-sm text-gray-500">🔒 Głosowanie zamknięte</p>
      {totalVotes > 0 && (
        <p className="text-xs text-gray-600 mt-1">Oddano {totalVotes} {totalVotes === 1 ? 'głos' : totalVotes < 5 ? 'głosy' : 'głosów'} — finalizacja wkrótce</p>
      )}
    </div>
  )
}

function SettledView({ selectedBonus, voteCounts, totalVotes }: {
  selectedBonus: number | null
  voteCounts: Record<number, number> | null
  totalVotes: number
}) {
  return (
    <div>
      <div className="flex items-center justify-center gap-2 py-1">
        <span className="text-amber-400 font-bold text-base">
          🏆 Bonus meczu dnia: +{selectedBonus ?? 2} pkt
        </span>
      </div>
      {voteCounts && totalVotes > 0 && (
        <div className="mt-2 grid grid-cols-4 gap-1.5">
          {BONUS_OPTIONS.map(bonus => {
            const count = voteCounts[bonus] ?? 0
            const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0
            return (
              <div key={bonus} className={cn(
                'rounded-lg p-1.5 text-center border',
                selectedBonus === bonus
                  ? 'border-amber-500/60 bg-amber-950/40'
                  : 'border-gray-800 bg-gray-800/40'
              )}>
                <div className={cn(
                  'text-xs font-bold',
                  selectedBonus === bonus ? 'text-amber-400' : 'text-gray-500'
                )}>+{bonus} pkt</div>
                <div className="text-xs text-gray-600">{pct}%</div>
              </div>
            )
          })}
        </div>
      )}
      {totalVotes === 0 && (
        <p className="text-xs text-center text-gray-600 mt-1">Brak głosów — przyznano domyślny bonus</p>
      )}
    </div>
  )
}
