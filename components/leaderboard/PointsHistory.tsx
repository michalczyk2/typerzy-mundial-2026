'use client'
import { useEffect, useMemo, useState } from 'react'
import type { User } from '@/types'
import { buildPointsHistory } from '@/lib/points-history'
import type { PointsHistoryData, PointsHistoryEntry, MatchGroupEntry, PlayerMatchLine, BonusHistoryEntry } from '@/lib/points-history'
import { TeamBadge } from '@/components/ui/TeamBadge'
import { formatMatchDate, getPhaseLabel } from '@/lib/utils'

interface Props {
  users: User[]
  outcomePoints: number
  exactScorePoints: number
}

type ViewMode = 'all' | string // 'all' or a user id
type FilterType = 'all' | 'matches' | 'bonuses' | 'mod'

const FILTERS: { value: FilterType; label: string }[] = [
  { value: 'all', label: 'Wszystko' },
  { value: 'matches', label: 'Mecze' },
  { value: 'bonuses', label: 'Bonusy' },
  { value: 'mod', label: 'Mecz Dnia' },
]

export function PointsHistory({ users, outcomePoints, exactScorePoints }: Props) {
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [data, setData] = useState<PointsHistoryData | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('all')
  const [filter, setFilter] = useState<FilterType>('all')
  const loading = open && !loaded

  useEffect(() => {
    if (!open || loaded) return
    fetch('/api/data/points-history')
      .then(r => r.json())
      .then((json: PointsHistoryData) => setData(json))
      .catch(() => setData({ matches: [], predictions: [], bonuses: [], modEvents: [] }))
      .finally(() => setLoaded(true))
  }, [open, loaded])

  const usersById = useMemo(() => new Map(users.map(u => [u.id, u.nick])), [users])

  const allEntries = useMemo(() => {
    if (!data) return []
    return buildPointsHistory(data, outcomePoints, exactScorePoints)
  }, [data, outcomePoints, exactScorePoints])

  const filteredEntries = useMemo(() => {
    let result: PointsHistoryEntry[] = allEntries

    if (viewMode !== 'all') {
      result = result
        .map(e => e.kind === 'match' ? { ...e, players: e.players.filter(p => p.userId === viewMode) } : e)
        .filter(e => e.kind === 'match' ? e.players.length > 0 : e.userId === viewMode)
    }

    if (filter === 'matches') result = result.filter(e => e.kind === 'match')
    else if (filter === 'bonuses') result = result.filter(e => e.kind === 'bonus')
    else if (filter === 'mod') result = result.filter(e => e.kind === 'match' && e.hasModBonus)

    return result
  }, [allEntries, viewMode, filter])

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mt-6">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <h2 className="text-base font-bold text-white">Historia Punktów</h2>
        <span className="text-gray-500 text-sm shrink-0">{open ? '▲ Zwiń' : '▼ Rozwiń'}</span>
      </button>

      {open && (
        <div className="border-t border-gray-800 px-4 py-4">
          <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between">
            <select
              value={viewMode}
              onChange={e => setViewMode(e.target.value)}
              className="h-9 rounded-lg border border-gray-700 bg-gray-950 px-3 text-sm text-white outline-none focus:border-emerald-500"
            >
              <option value="all">Wszyscy</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.nick}</option>
              ))}
            </select>

            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map(f => (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    filter === f.value ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {loading && <p className="text-gray-500 text-sm text-center py-6">Ładowanie…</p>}

          {!loading && loaded && filteredEntries.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-6">Brak wpisów do pokazania.</p>
          )}

          {!loading && filteredEntries.length > 0 && (
            <div className="space-y-3">
              {filteredEntries.map(entry =>
                entry.kind === 'match'
                  ? <MatchGroupCard key={entry.key} entry={entry} usersById={usersById} />
                  : <BonusEntryCard key={entry.key} entry={entry} nick={usersById.get(entry.userId) ?? '—'} />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function MatchGroupCard({ entry, usersById }: { entry: MatchGroupEntry; usersById: Map<string, string> }) {
  return (
    <div className="bg-gray-950/50 border border-gray-800/70 rounded-lg overflow-hidden">
      <div className="px-3 py-3 border-b border-gray-800/70">
        <p className="text-center text-xs text-gray-500 mb-2">
          {entry.groupName ? `Grupa ${entry.groupName} · Kolejka ${entry.round}` : getPhaseLabel(entry.phase)}
          {' · '}{formatMatchDate(entry.matchDate)}
        </p>
        <div className="flex items-center justify-between gap-2">
          <TeamBadge code={entry.teamACode} name={entry.teamA} size="sm" direction="row" className="flex-1 min-w-0" />
          <div className="text-lg font-black text-white tabular-nums shrink-0">
            {entry.scoreA}<span className="text-gray-600 mx-1">:</span>{entry.scoreB}
          </div>
          <TeamBadge code={entry.teamBCode} name={entry.teamB} size="sm" direction="row" reverse className="flex-1 min-w-0 justify-end" />
        </div>
      </div>

      <div className="divide-y divide-gray-800/70">
        {entry.players.map(p => (
          <PlayerLine key={p.userId} player={p} nick={usersById.get(p.userId) ?? '—'} />
        ))}
      </div>
    </div>
  )
}

function PlayerLine({ player, nick }: { player: PlayerMatchLine; nick: string }) {
  return (
    <div className="px-3 py-2.5">
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="text-gray-200 text-sm font-medium truncate">{nick}</p>
        <p className="text-gray-400 text-xs shrink-0">Typ: <span className="text-gray-200 font-medium">{player.predictedA}:{player.predictedB}</span></p>
      </div>

      {player.components.length === 0 ? (
        <p className="text-gray-500 text-sm font-semibold">0 pkt</p>
      ) : (
        <div className="space-y-0.5">
          {player.components.map((c, i) => (
            <p key={i} className="text-emerald-400 text-sm font-medium">+{c.points} {c.label}</p>
          ))}
          <p className="text-white text-sm font-bold mt-1 pt-1 border-t border-gray-800/70">
            Razem: {player.total} pkt
          </p>
        </div>
      )}
    </div>
  )
}

function BonusEntryCard({ entry, nick }: { entry: BonusHistoryEntry; nick: string }) {
  return (
    <div className="bg-gray-950/50 border border-gray-800/70 rounded-lg px-3 py-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-white font-semibold text-sm truncate">
          {entry.round != null ? `Kolejka ${entry.round} — ${entry.label}` : entry.label}
        </p>
        <p className="text-gray-400 text-xs mt-0.5">Gracz: <span className="text-gray-200 font-medium">{nick}</span></p>
      </div>
      <span className="text-emerald-400 font-black text-sm shrink-0">+{entry.points} pkt</span>
    </div>
  )
}
