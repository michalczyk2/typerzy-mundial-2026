'use client'
import { useEffect, useMemo, useState } from 'react'
import type { User } from '@/types'
import { buildPointsHistory } from '@/lib/points-history'
import type { PointsHistoryData, MatchHistoryEntry, BonusHistoryEntry } from '@/lib/points-history'

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
    let result = allEntries
    if (viewMode !== 'all') result = result.filter(e => e.userId === viewMode)
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
                  ? <MatchEntryCard key={entry.key} entry={entry} nick={usersById.get(entry.userId) ?? '—'} />
                  : <BonusEntryCard key={entry.key} entry={entry} nick={usersById.get(entry.userId) ?? '—'} />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function MatchEntryCard({ entry, nick }: { entry: MatchHistoryEntry; nick: string }) {
  return (
    <div className="bg-gray-950/50 border border-gray-800/70 rounded-lg px-3 py-3">
      <p className="text-white font-bold text-sm mb-1.5">
        {entry.teamA} {entry.scoreA}:{entry.scoreB} {entry.teamB}
      </p>
      <p className="text-gray-400 text-xs mb-0.5">Gracz: <span className="text-gray-200 font-medium">{nick}</span></p>
      <p className="text-gray-400 text-xs mb-2">Typ: <span className="text-gray-200 font-medium">{entry.predictedA}:{entry.predictedB}</span></p>

      {entry.components.length === 0 ? (
        <p className="text-gray-500 text-sm font-semibold">0 pkt</p>
      ) : (
        <div className="space-y-0.5">
          {entry.components.map((c, i) => (
            <p key={i} className="text-emerald-400 text-sm font-medium">+{c.points} {c.label}</p>
          ))}
          <p className="text-white text-sm font-bold mt-1.5 pt-1.5 border-t border-gray-800/70">
            Razem: {entry.total} pkt
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
