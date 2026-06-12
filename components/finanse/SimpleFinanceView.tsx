'use client'

import { useState } from 'react'
import type { Bet, BetStatus, BettingSettings, BettingTransaction } from '@/types'

const STATUSES: { value: BetStatus; label: string }[] = [
  { value: 'pending', label: 'Oczekuje' },
  { value: 'won', label: 'Wygrana' },
  { value: 'lost', label: 'Przegrana' },
  { value: 'cashout', label: 'Cash out' },
  { value: 'void', label: 'Zwrot' },
]

const STATUS_TEXT: Record<BetStatus, string> = {
  pending: 'text-blue-300',
  won: 'text-emerald-400',
  lost: 'text-red-400',
  cashout: 'text-amber-400',
  void: 'text-gray-400',
}

function fmt(n: number) {
  return n.toFixed(2).replace('.', ',')
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

interface SimpleSummary {
  startingBalance: number
  deposited: number
  withdrawn: number
  totalPnL: number
  currentBalance: number
  totalBets: number
  stakeInPlay: number
  settledCount: number
  totalStaked: number
}

function computeSummary(
  bets: Bet[],
  settings: BettingSettings | null,
  transactions: BettingTransaction[],
): SimpleSummary {
  const settled = bets.filter(b => b.status !== 'pending')
  const pending = bets.filter(b => b.status === 'pending')
  const totalPnL = settled.reduce((s, b) => s + b.profit, 0)
  const stakeInPlay = pending.reduce((s, b) => s + b.stake, 0)
  const startingBalance = settings?.starting_balance ?? 0
  const deposited = transactions.filter(t => t.type === 'deposit').reduce((s, t) => s + t.amount, 0)
  const withdrawn = transactions.filter(t => t.type === 'withdrawal').reduce((s, t) => s + t.amount, 0)
  const currentBalance = startingBalance + deposited - withdrawn + totalPnL
  const totalStaked = settled.reduce((s, b) => s + b.stake, 0)

  return {
    startingBalance,
    deposited,
    withdrawn,
    totalPnL,
    currentBalance,
    totalBets: bets.length,
    stakeInPlay,
    settledCount: settled.length,
    totalStaked,
  }
}

interface Props {
  bets: Bet[]
  settings: BettingSettings | null
  transactions: BettingTransaction[]
  onBetSaved: (bet: Bet) => void
  onBetDeleted: (id: string) => void
  onGoToSettings: () => void
}

const inputCls =
  'bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500 w-full'

export function SimpleFinanceView({
  bets,
  settings,
  transactions,
  onBetSaved,
  onBetDeleted,
  onGoToSettings,
}: Props) {
  const [note, setNote] = useState('')
  const [stake, setStake] = useState('')
  const [odds, setOdds] = useState('')
  const [status, setStatus] = useState<BetStatus>('pending')
  const [cashOut, setCashOut] = useState('')
  const [date, setDate] = useState(today())
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [patchingId, setPatchingId] = useState<string | null>(null)
  const [cashoutModal, setCashoutModal] = useState<{ id: string; stake: number } | null>(null)
  const [cashoutAmount, setCashoutAmount] = useState('')

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const summary = computeSummary(bets, settings, transactions)
  const sortedBets = [...bets].sort((a, b) => b.date.localeCompare(a.date))

  async function handleAddBet(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    const stakeNum = parseFloat(stake.replace(',', '.'))
    const oddsNum = parseFloat(odds.replace(',', '.'))
    if (isNaN(stakeNum) || stakeNum <= 0) { setFormError('Podaj poprawną stawkę'); return }
    if (isNaN(oddsNum) || oddsNum < 1) { setFormError('Kurs musi być ≥ 1,00'); return }
    if (status === 'cashout') {
      const co = parseFloat(cashOut.replace(',', '.'))
      if (isNaN(co) || co < 0) { setFormError('Podaj kwotę cash out'); return }
    }
    setSaving(true)
    try {
      const res = await fetch('/api/finanse/bets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          sport: '',
          league: '',
          event_name: note,
          bet_type: '',
          bookmaker: '',
          stake: stakeNum,
          odds: oddsNum,
          status,
          cash_out_amount: status === 'cashout' ? parseFloat(cashOut.replace(',', '.')) : null,
          note: note || null,
        }),
      })
      const json = await res.json() as { bet?: Bet; error?: string }
      if (!res.ok) { setFormError(json.error ?? 'Błąd zapisu'); return }
      onBetSaved(json.bet!)
      setNote('')
      setStake('')
      setOdds('')
      setStatus('pending')
      setCashOut('')
      setDate(today())
    } catch {
      setFormError('Błąd połączenia')
    } finally {
      setSaving(false)
    }
  }

  async function handleStatusChange(bet: Bet, newStatus: BetStatus) {
    if (newStatus === 'cashout') {
      setCashoutModal({ id: bet.id, stake: bet.stake })
      setCashoutAmount(bet.cash_out_amount != null ? String(bet.cash_out_amount) : '')
      return
    }
    setPatchingId(bet.id)
    try {
      const res = await fetch('/api/finanse/bets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: bet.id, status: newStatus, cash_out_amount: null }),
      })
      const json = await res.json() as { bet?: Bet }
      if (res.ok && json.bet) onBetSaved(json.bet)
    } finally {
      setPatchingId(null)
    }
  }

  async function handleCashoutConfirm() {
    if (!cashoutModal) return
    const co = parseFloat(cashoutAmount.replace(',', '.'))
    if (isNaN(co) || co < 0) return
    const modalId = cashoutModal.id
    setCashoutModal(null)
    setPatchingId(modalId)
    try {
      const res = await fetch('/api/finanse/bets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: modalId, status: 'cashout', cash_out_amount: co }),
      })
      const json = await res.json() as { bet?: Bet }
      if (res.ok && json.bet) onBetSaved(json.bet)
    } finally {
      setPatchingId(null)
      setCashoutAmount('')
    }
  }

  async function handleDelete(id: string) {
    setDeleting(true)
    try {
      const res = await fetch(`/api/finanse/bets?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        onBetDeleted(id)
        setConfirmDeleteId(null)
      }
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Sekcja 1: Podsumowanie */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
          <div>
            <p className="text-gray-500 text-xs mb-0.5">Saldo startowe</p>
            <p className="text-white font-semibold text-sm">{fmt(summary.startingBalance)} zł</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-0.5">Wpłacono</p>
            <p className="text-emerald-400 font-semibold text-sm">+{fmt(summary.deposited)} zł</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-0.5">Wypłacono</p>
            <p className="text-red-400 font-semibold text-sm">
              {summary.withdrawn > 0 ? `-${fmt(summary.withdrawn)}` : fmt(summary.withdrawn)} zł
            </p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-0.5">Wynik</p>
            <p
              className={`font-semibold text-sm ${
                summary.totalPnL > 0
                  ? 'text-emerald-400'
                  : summary.totalPnL < 0
                    ? 'text-red-400'
                    : 'text-gray-400'
              }`}
            >
              {summary.totalPnL > 0 ? '+' : ''}{fmt(summary.totalPnL)} zł
            </p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-0.5">Aktualne saldo</p>
            <p
              className={`font-bold text-base ${
                summary.currentBalance > 0
                  ? 'text-emerald-400'
                  : summary.currentBalance < 0
                    ? 'text-red-400'
                    : 'text-white'
              }`}
            >
              {fmt(summary.currentBalance)} zł
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-gray-600 border-t border-gray-800 pt-2">
          <span>{summary.totalBets} {summary.totalBets === 1 ? 'kupon' : 'kuponów'}</span>
          {summary.stakeInPlay > 0 && (
            <span className="text-blue-400">{fmt(summary.stakeInPlay)} zł w grze</span>
          )}
          <span>{summary.settledCount} rozliczonych</span>
        </div>
      </div>

      {/* Sekcja 2: Szybkie dodanie kuponu */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <h3 className="text-white font-medium text-sm mb-3">Dodaj kupon</h3>
        <form onSubmit={e => void handleAddBet(e)} className="space-y-3">
          {formError && (
            <p className="text-red-400 text-xs bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
              {formError}
            </p>
          )}
          <input
            type="text"
            placeholder="np. Legia wygra, kupon sobotni, over 2.5..."
            className={inputCls}
            value={note}
            onChange={e => setNote(e.target.value)}
          />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-gray-500 text-xs block mb-1">Stawka (zł) *</label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="100,00"
                className={inputCls}
                value={stake}
                onChange={e => setStake(e.target.value)}
              />
            </div>
            <div>
              <label className="text-gray-500 text-xs block mb-1">Kurs *</label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="1,85"
                className={inputCls}
                value={odds}
                onChange={e => setOdds(e.target.value)}
              />
            </div>
            <div>
              <label className="text-gray-500 text-xs block mb-1">Rezultat</label>
              <select
                className={inputCls}
                value={status}
                onChange={e => setStatus(e.target.value as BetStatus)}
              >
                {STATUSES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-gray-500 text-xs block mb-1">Data</label>
              <input
                type="date"
                className={inputCls}
                value={date}
                onChange={e => setDate(e.target.value)}
              />
            </div>
          </div>
          {status === 'cashout' && (
            <div className="max-w-xs">
              <label className="text-gray-500 text-xs block mb-1">Kwota cash out (zł) *</label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="80,00"
                className="bg-gray-800 border border-amber-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 w-full"
                value={cashOut}
                onChange={e => setCashOut(e.target.value)}
              />
            </div>
          )}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {saving ? 'Dodawanie...' : 'Dodaj'}
            </button>
          </div>
        </form>
      </div>

      {/* Sekcja 3: Tabela kuponów */}
      {sortedBets.length === 0 ? (
        <div className="text-center py-12 text-gray-600">
          <p className="text-2xl mb-2">📋</p>
          <p className="text-sm">Dodaj swój pierwszy kupon powyżej</p>
        </div>
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden md:block bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500">
                  <th className="text-left py-3 px-4 font-medium">Data</th>
                  <th className="text-left py-3 px-3 font-medium">Opis</th>
                  <th className="text-right py-3 px-3 font-medium">Stawka</th>
                  <th className="text-right py-3 px-3 font-medium">Kurs</th>
                  <th className="text-center py-3 px-3 font-medium">Rezultat</th>
                  <th className="text-right py-3 px-3 font-medium">Wypłata</th>
                  <th className="text-right py-3 px-3 font-medium">Wynik</th>
                  <th className="text-right py-3 px-4 font-medium">Akcje</th>
                </tr>
              </thead>
              <tbody>
                {sortedBets.map(bet => (
                  <tr
                    key={bet.id}
                    className="border-b border-gray-800/40 hover:bg-gray-800/30 transition-colors"
                  >
                    <td className="py-2.5 px-4 text-gray-400 whitespace-nowrap">{bet.date}</td>
                    <td className="py-2.5 px-3 max-w-[220px]">
                      <span className="text-gray-200 truncate block">
                        {bet.event_name || bet.note || '—'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-gray-300 whitespace-nowrap">
                      {fmt(bet.stake)} zł
                    </td>
                    <td className="py-2.5 px-3 text-right text-gray-300">
                      {fmt(bet.odds)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <select
                        className={`bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs focus:outline-none disabled:opacity-50 cursor-pointer ${STATUS_TEXT[bet.status]}`}
                        value={bet.status}
                        disabled={patchingId === bet.id}
                        onChange={e => void handleStatusChange(bet, e.target.value as BetStatus)}
                      >
                        {STATUSES.map(s => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2.5 px-3 text-right text-gray-300 whitespace-nowrap">
                      {bet.payout > 0 ? `${fmt(bet.payout)} zł` : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      {bet.status === 'pending' ? (
                        <span className="text-blue-400">—</span>
                      ) : bet.profit > 0 ? (
                        <span className="text-emerald-400 font-medium">+{fmt(bet.profit)}</span>
                      ) : bet.profit < 0 ? (
                        <span className="text-red-400 font-medium">{fmt(bet.profit)}</span>
                      ) : (
                        <span className="text-gray-500">{fmt(bet.profit)}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        onClick={() => setConfirmDeleteId(bet.id)}
                        className="text-gray-600 hover:text-red-400 text-xs px-1 py-1 transition-colors"
                      >
                        Usuń
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile — karty */}
          <div className="md:hidden space-y-2">
            {sortedBets.map(bet => (
              <div key={bet.id} className="bg-gray-900 border border-gray-800 rounded-xl p-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-200 text-sm truncate">
                      {bet.event_name || bet.note || '—'}
                    </p>
                    <p className="text-gray-500 text-xs">{bet.date}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    {bet.status === 'pending' ? (
                      <span className="text-blue-400 text-xs">oczekuje</span>
                    ) : bet.profit > 0 ? (
                      <span className="text-emerald-400 text-sm font-medium">+{fmt(bet.profit)} zł</span>
                    ) : bet.profit < 0 ? (
                      <span className="text-red-400 text-sm font-medium">{fmt(bet.profit)} zł</span>
                    ) : (
                      <span className="text-gray-500 text-sm">{fmt(bet.profit)} zł</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-gray-400 text-xs">
                    {fmt(bet.stake)} zł @ {fmt(bet.odds)}
                    {bet.payout > 0 && (
                      <span className="text-gray-600"> → {fmt(bet.payout)} zł</span>
                    )}
                  </span>
                  <div className="flex items-center gap-2">
                    <select
                      className={`bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs focus:outline-none disabled:opacity-50 cursor-pointer ${STATUS_TEXT[bet.status]}`}
                      value={bet.status}
                      disabled={patchingId === bet.id}
                      onChange={e => void handleStatusChange(bet, e.target.value as BetStatus)}
                    >
                      {STATUSES.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => setConfirmDeleteId(bet.id)}
                      className="text-gray-600 hover:text-red-400 text-xs transition-colors"
                    >
                      Usuń
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Sekcja 4: Podsumowanie pod tabelą */}
      {sortedBets.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-500 text-xs">Razem postawiono</span>
              <span className="text-gray-200 text-xs font-medium">{fmt(summary.totalStaked)} zł</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500 text-xs">Wpłacono</span>
              <span className="text-emerald-400 text-xs font-medium">+{fmt(summary.deposited)} zł</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500 text-xs">Wypłacono</span>
              <span className="text-red-400 text-xs font-medium">
                {summary.withdrawn > 0 ? `-${fmt(summary.withdrawn)}` : fmt(summary.withdrawn)} zł
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500 text-xs">Wynik końcowy</span>
              <span
                className={`text-xs font-semibold ${
                  summary.totalPnL > 0
                    ? 'text-emerald-400'
                    : summary.totalPnL < 0
                      ? 'text-red-400'
                      : 'text-gray-400'
                }`}
              >
                {summary.totalPnL > 0 ? '+' : ''}{fmt(summary.totalPnL)} zł
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500 text-xs">Aktualne saldo</span>
              <span
                className={`text-xs font-semibold ${
                  summary.currentBalance > 0
                    ? 'text-emerald-400'
                    : summary.currentBalance < 0
                      ? 'text-red-400'
                      : 'text-white'
                }`}
              >
                {fmt(summary.currentBalance)} zł
              </span>
            </div>
            {summary.stakeInPlay > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-gray-500 text-xs">Stawka w grze</span>
                <span className="text-blue-400 text-xs font-medium">{fmt(summary.stakeInPlay)} zł</span>
              </div>
            )}
          </div>
          <div className="mt-3 pt-3 border-t border-gray-800">
            <button
              onClick={onGoToSettings}
              className="text-gray-500 hover:text-gray-300 text-xs transition-colors"
            >
              Ustaw saldo / wpłaty / wypłaty →
            </button>
          </div>
        </div>
      )}

      {/* Modal: cash out */}
      {cashoutModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 max-w-sm w-full">
            <p className="text-white font-medium mb-1">Kwota cash out</p>
            <p className="text-gray-400 text-sm mb-3">Stawka: {fmt(cashoutModal.stake)} zł</p>
            <input
              type="text"
              inputMode="decimal"
              placeholder="80,00"
              className="w-full bg-gray-800 border border-amber-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none mb-4"
              value={cashoutAmount}
              onChange={e => setCashoutAmount(e.target.value)}
              autoFocus
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setCashoutModal(null); setCashoutAmount('') }}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Anuluj
              </button>
              <button
                onClick={() => void handleCashoutConfirm()}
                className="px-4 py-2 text-sm bg-amber-700 hover:bg-amber-600 text-white rounded-lg transition-colors"
              >
                Potwierdź
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: potwierdzenie usunięcia */}
      {confirmDeleteId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 max-w-sm w-full">
            <p className="text-white font-medium mb-1">Usuń kupon?</p>
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
                onClick={() => void handleDelete(confirmDeleteId)}
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
