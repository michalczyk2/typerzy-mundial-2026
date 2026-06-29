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
        .map(e => {
          if (e.kind !== 'match') return e
          const players = e.players.filter(p => p.userId === viewMode)
          return { ...e, players, hasModBonus: players.some(p => p.hasModBonus) }
        })
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
            <div className="space-y-2">
              {filteredEntries.map(entry =>
                entry.kind === 'match'
                  ? <MatchGroupCard key={entry.key} entry={entry} usersById={usersById} totalUsers={users.length} />
                  : <BonusEntryCard key={entry.key} entry={entry} nick={usersById.get(entry.userId) ?? '—'} />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function MatchGroupCard({ entry, usersById, totalUsers }: { entry: MatchGroupEntry; usersById: Map<string, string>; totalUsers: number }) {
  const [open, setOpen] = useState(false)
  const playerCount = entry.players.length
  const totalAwarded = entry.players.reduce((s, p) => s + p.total, 0)
  const roundLabel = entry.groupName ? `Grupa ${entry.groupName} · Kolejka ${entry.round}` : getPhaseLabel(entry.phase)

  return (
    <div className="bg-gray-950/50 border border-gray-800/70 rounded-lg overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full px-3 py-3 text-left">
        <div className="flex items-center justify-between gap-2">
          <TeamBadge code={entry.teamACode} name={entry.teamA} size="sm" direction="row" className="flex-1 min-w-0" />
          <div className="text-lg font-black text-white tabular-nums shrink-0">
            {entry.scoreA}<span className="text-gray-600 mx-1">:</span>{entry.scoreB}
          </div>
          <TeamBadge code={entry.teamBCode} name={entry.teamB} size="sm" direction="row" reverse className="flex-1 min-w-0 justify-end" />
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 mt-2 text-xs">
          <span className="text-gray-500">Zakończony</span>
          <span className="text-gray-600">•</span>
          <span className="text-gray-500">{roundLabel}</span>
          <span className="text-gray-600">•</span>
          <span className="text-gray-500">{formatMatchDate(entry.matchDate)}</span>
          {entry.hasModBonus && (
            <>
              <span className="text-gray-600">•</span>
              <span className="text-amber-400 font-semibold">🔥 Mecz Dnia</span>
            </>
          )}
        </div>

        <p className="text-center text-gray-600 text-xs mt-2">{open ? '▲ Zwiń' : `▼ Rozwiń (${playerCount})`}</p>
      </button>

      {open && (
        <div className="border-t border-gray-800/70">
          <div className="divide-y divide-gray-800/70">
            {entry.players.map(p => (
              <PlayerLine key={p.userId} player={p} nick={usersById.get(p.userId) ?? '—'} />
            ))}
          </div>
          <div className="px-3 py-2 bg-gray-900/60 flex items-center justify-between text-xs text-gray-400">
            <span>Typujących: <span className="text-gray-200 font-medium">{playerCount}/{totalUsers}</span></span>
            <span>Rozdano: <span className="text-emerald-400 font-semibold">{totalAwarded} pkt</span></span>
          </div>
        </div>
      )}
    </div>
  )
}

function PlayerLine({ player, nick }: { player: PlayerMatchLine; nick: string }) {
  return (
    <div className="px-3 py-2.5">
      <div className="flex items-center gap-1.5 flex-wrap">
        <p className="text-gray-200 text-sm font-semibold truncate">{nick}</p>
        {player.isAdminOverride && (
          <span
            className="rounded border border-amber-700/60 bg-amber-900/40 px-1.5 py-0.5 text-[10px] font-medium text-amber-400"
            title={player.adminOverrideReason ?? 'Korekta admina'}
          >
            ✏️ korekta
          </span>
        )}
      </div>
      <p className="text-gray-400 text-xs mt-0.5">
        Typ: <span className="text-gray-200 font-medium">{player.predictedA}:{player.predictedB}</span>
        {player.predictedWinner && (
          <span className="ml-2 text-amber-400/80">Awans: {player.predictedWinner}</span>
        )}
      </p>
      <p className={`text-sm font-bold mt-1 ${player.total > 0 ? 'text-emerald-400' : 'text-gray-500'}`}>
        {player.total > 0 ? `+${player.total} pkt` : '0 pkt'}
      </p>
      <div className="mt-0.5 space-y-0.5">
        {player.components.length === 0 ? (
          <p className="text-gray-600 text-xs">Brak punktów</p>
        ) : (
          player.components.map((c, i) => (
            <p key={i} className="text-gray-500 text-xs">+{c.points} {c.label}</p>
          ))
        )}
      </div>
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
