'use client'

import { useState, useMemo } from 'react'
import type { Bet, BetStatus } from '@/types'

interface BetListProps {
  bets: Bet[]
  onEdit: (bet: Bet) => void
  onDeleted: (id: string) => void
}

const STATUS_LABEL: Record<BetStatus, string> = {
  pending: 'Oczekuje',
  won: 'Wygrana',
  lost: 'Przegrana',
  cashout: 'Cash out',
  void: 'Zwrot',
}

const STATUS_CLS: Record<BetStatus, string> = {
  pending: 'bg-blue-900/40 text-blue-300 border-blue-800',
  won: 'bg-emerald-900/40 text-emerald-300 border-emerald-800',
  lost: 'bg-red-900/40 text-red-300 border-red-800',
  cashout: 'bg-amber-900/40 text-amber-300 border-amber-800',
  void: 'bg-gray-800 text-gray-400 border-gray-700',
}

function fmt(n: number) { return n.toFixed(2).replace('.', ',') }

function ProfitCell({ value }: { value: number }) {
  if (value > 0) return <span className="text-emerald-400 font-medium">+{fmt(value)}</span>
  if (value < 0) return <span className="text-red-400 font-medium">{fmt(value)}</span>
  return <span className="text-gray-500">{fmt(value)}</span>
}

function exportCSV(bets: Bet[]) {
  const headers = ['Data', 'Sport', 'Liga', 'Zdarzenie', 'Typ', 'Bukmacher', 'Stawka', 'Kurs', 'Status', 'Cash out', 'Wypłata', 'Wynik', 'Notatka']
  const rows = bets.map(b => [
    b.date, b.sport, b.league, b.event_name, b.bet_type, b.bookmaker,
    fmt(b.stake), fmt(b.odds), STATUS_LABEL[b.status],
    b.cash_out_amount != null ? fmt(b.cash_out_amount) : '',
    fmt(b.payout), fmt(b.profit), b.note ?? '',
  ])
  const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `zakłady-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function BetList({ bets, onEdit, onDeleted }: BetListProps) {
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<BetStatus | ''>('')
  const [filterSport, setFilterSport] = useState('')
  const [filterBookmaker, setFilterBookmaker] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const sports = useMemo(() => [...new Set(bets.map(b => b.sport).filter(Boolean))].sort(), [bets])
  const bookmakers = useMemo(() => [...new Set(bets.map(b => b.bookmaker).filter(Boolean))].sort(), [bets])

  const filtered = useMemo(() => {
    let result = bets
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(b =>
        b.event_name.toLowerCase().includes(q) ||
        b.sport.toLowerCase().includes(q) ||
        b.league.toLowerCase().includes(q) ||
        b.bet_type.toLowerCase().includes(q) ||
        b.bookmaker.toLowerCase().includes(q) ||
        (b.note ?? '').toLowerCase().includes(q),
      )
    }
    if (filterStatus) result = result.filter(b => b.status === filterStatus)
    if (filterSport) result = result.filter(b => b.sport === filterSport)
    if (filterBookmaker) result = result.filter(b => b.bookmaker === filterBookmaker)
    if (dateFrom) result = result.filter(b => b.date >= dateFrom)
    if (dateTo) result = result.filter(b => b.date <= dateTo)
    return [...result].sort((a, b) => sortDir === 'desc'
      ? b.date.localeCompare(a.date)
      : a.date.localeCompare(b.date))
  }, [bets, search, filterStatus, filterSport, filterBookmaker, dateFrom, dateTo, sortDir])

  async function handleDelete(id: string) {
    setDeleting(true)
    try {
      const res = await fetch(`/api/finanse/bets?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        onDeleted(id)
        setConfirmDeleteId(null)
      }
    } finally {
      setDeleting(false)
    }
  }

  const inputCls = 'bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-emerald-500'

  return (
    <div className="space-y-3">
      {/* Filtry */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 space-y-2">
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Szukaj..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={`${inputCls} min-w-[160px] flex-1`}
          />
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as BetStatus | '')} className={inputCls}>
            <option value="">Wszystkie statusy</option>
            {(Object.keys(STATUS_LABEL) as BetStatus[]).map(s => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
          {sports.length > 0 && (
            <select value={filterSport} onChange={e => setFilterSport(e.target.value)} className={inputCls}>
              <option value="">Wszystkie sporty</option>
              {sports.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          {bookmakers.length > 0 && (
            <select value={filterBookmaker} onChange={e => setFilterBookmaker(e.target.value)} className={inputCls}>
              <option value="">Wszyscy bukmacherzy</option>
              {bookmakers.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          )}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={inputCls} />
          <span className="text-gray-600 text-xs">—</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={inputCls} />
          <button
            onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
            className="text-gray-400 text-xs hover:text-white px-2 py-1.5 bg-gray-800 border border-gray-700 rounded-lg transition-colors"
          >
            Data {sortDir === 'desc' ? '↓' : '↑'}
          </button>
          <span className="text-gray-600 text-xs ml-auto">{filtered.length} zakładów</span>
          <button
            onClick={() => exportCSV(filtered)}
            className="text-gray-400 text-xs hover:text-emerald-400 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded-lg transition-colors"
          >
            Eksport CSV
          </button>
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-gray-600">
          <p className="text-2xl mb-2">📋</p>
          <p className="text-sm">{bets.length === 0 ? 'Nie dodano jeszcze żadnego zakładu' : 'Brak wyników dla podanych filtrów'}</p>
        </div>
      )}

      {/* Desktop — tabela */}
      {filtered.length > 0 && (
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500">
                <th className="text-left py-2 pr-3 font-medium">Data</th>
                <th className="text-left py-2 pr-3 font-medium">Zdarzenie</th>
                <th className="text-left py-2 pr-3 font-medium">Typ</th>
                <th className="text-left py-2 pr-3 font-medium">Bukm.</th>
                <th className="text-right py-2 pr-3 font-medium">Stawka</th>
                <th className="text-right py-2 pr-3 font-medium">Kurs</th>
                <th className="text-center py-2 pr-3 font-medium">Status</th>
                <th className="text-right py-2 pr-3 font-medium">Wynik</th>
                <th className="text-right py-2 font-medium">Akcje</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(bet => (
                <tr key={bet.id} className="border-b border-gray-900 hover:bg-gray-900/50 transition-colors">
                  <td className="py-2 pr-3 text-gray-400">{bet.date}</td>
                  <td className="py-2 pr-3">
                    <p className="text-white">{bet.event_name || '—'}</p>
                    {bet.league && <p className="text-gray-600">{bet.sport} · {bet.league}</p>}
                  </td>
                  <td className="py-2 pr-3 text-gray-300">{bet.bet_type || '—'}</td>
                  <td className="py-2 pr-3 text-gray-400">{bet.bookmaker || '—'}</td>
                  <td className="py-2 pr-3 text-right text-gray-300">{fmt(bet.stake)} zł</td>
                  <td className="py-2 pr-3 text-right text-gray-300">{fmt(bet.odds)}</td>
                  <td className="py-2 pr-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded border text-xs ${STATUS_CLS[bet.status]}`}>
                      {STATUS_LABEL[bet.status]}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-right">
                    <ProfitCell value={bet.profit} />
                    {bet.note && <p className="text-gray-600 truncate max-w-[120px]">{bet.note}</p>}
                  </td>
                  <td className="py-2 text-right whitespace-nowrap">
                    <button
                      onClick={() => onEdit(bet)}
                      className="text-gray-500 hover:text-white text-xs px-2 py-1 transition-colors"
                    >
                      Edytuj
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(bet.id)}
                      className="text-gray-600 hover:text-red-400 text-xs px-2 py-1 transition-colors"
                    >
                      Usuń
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Mobile — karty */}
      {filtered.length > 0 && (
        <div className="md:hidden space-y-2">
          {filtered.map(bet => (
            <div key={bet.id} className="bg-gray-900 border border-gray-800 rounded-xl p-3">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{bet.event_name || '—'}</p>
                  <p className="text-gray-500 text-xs">{bet.date}{bet.sport ? ` · ${bet.sport}` : ''}{bet.league ? ` · ${bet.league}` : ''}</p>
                </div>
                <span className={`inline-block px-2 py-0.5 rounded border text-xs shrink-0 ${STATUS_CLS[bet.status]}`}>
                  {STATUS_LABEL[bet.status]}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs mb-2">
                <span className="text-gray-400">Stawka: <span className="text-white">{fmt(bet.stake)} zł</span></span>
                <span className="text-gray-400">Kurs: <span className="text-white">{fmt(bet.odds)}</span></span>
                <span className="text-gray-400">Wynik: <ProfitCell value={bet.profit} /></span>
              </div>
              {(bet.bet_type || bet.bookmaker) && (
                <p className="text-gray-600 text-xs mb-2">
                  {[bet.bet_type, bet.bookmaker].filter(Boolean).join(' · ')}
                </p>
              )}
              {bet.note && <p className="text-gray-600 text-xs italic mb-2">"{bet.note}"</p>}
              <div className="flex gap-3 border-t border-gray-800 pt-2">
                <button
                  onClick={() => onEdit(bet)}
                  className="text-gray-400 hover:text-white text-xs transition-colors"
                >
                  Edytuj
                </button>
                <button
                  onClick={() => setConfirmDeleteId(bet.id)}
                  className="text-gray-600 hover:text-red-400 text-xs transition-colors"
                >
                  Usuń
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Potwierdzenie usunięcia */}
      {confirmDeleteId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 max-w-sm w-full">
            <p className="text-white font-medium mb-1">Usuń zakład?</p>
            <p className="text-gray-400 text-sm mb-4">Tej operacji nie można cofnąć.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDeleteId(null)}
                disabled={deleting}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Anuluj
              </button>
              <button
                onClick={() => handleDelete(confirmDeleteId)}
                disabled={deleting}
                className="px-4 py-2 text-sm bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white rounded-lg transition-colors"
              >
                {deleting ? 'Usuwam...' : 'Usuń'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
