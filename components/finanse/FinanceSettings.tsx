'use client'

import { useState } from 'react'
import type { BettingSettings, BettingTransaction, TransactionType } from '@/types'

interface FinanceSettingsProps {
  settings: BettingSettings | null
  transactions: BettingTransaction[]
  onSettingsSaved: (s: BettingSettings) => void
  onTransactionAdded: (tx: BettingTransaction) => void
  onTransactionDeleted: (id: string) => void
}

function fmt(n: number) { return n.toFixed(2).replace('.', ',') }

function inputCls(extra = '') {
  return `w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500 ${extra}`
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-gray-500 text-xs block mb-1">{children}</label>
}

export function FinanceSettings({
  settings,
  transactions,
  onSettingsSaved,
  onTransactionAdded,
  onTransactionDeleted,
}: FinanceSettingsProps) {
  const [startingBalance, setStartingBalance] = useState(settings?.starting_balance != null ? String(settings.starting_balance) : '')
  const [monthlyLossLimit, setMonthlyLossLimit] = useState(settings?.monthly_loss_limit != null ? String(settings.monthly_loss_limit) : '')
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null)

  const [txType, setTxType] = useState<TransactionType>('deposit')
  const [txAmount, setTxAmount] = useState('')
  const [txDate, setTxDate] = useState(new Date().toISOString().slice(0, 10))
  const [txNote, setTxNote] = useState('')
  const [addingTx, setAddingTx] = useState(false)
  const [txError, setTxError] = useState<string | null>(null)

  const [confirmDeleteTxId, setConfirmDeleteTxId] = useState<string | null>(null)
  const [deletingTx, setDeletingTx] = useState(false)

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault()
    const balance = parseFloat(startingBalance.replace(',', '.'))
    if (isNaN(balance) || balance < 0) {
      setSettingsMsg('Podaj poprawne saldo startowe (≥ 0)')
      return
    }
    const limit = monthlyLossLimit ? parseFloat(monthlyLossLimit.replace(',', '.')) : null
    if (limit !== null && (isNaN(limit) || limit < 0)) {
      setSettingsMsg('Limit straty musi być ≥ 0')
      return
    }
    setSavingSettings(true)
    setSettingsMsg(null)
    try {
      const res = await fetch('/api/finanse/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ starting_balance: balance, monthly_loss_limit: limit }),
      })
      if (res.ok) {
        onSettingsSaved({ starting_balance: balance, monthly_loss_limit: limit })
        setSettingsMsg('Zapisano')
        setTimeout(() => setSettingsMsg(null), 2000)
      } else {
        const j = await res.json().catch(() => ({}))
        setSettingsMsg(j.error ?? 'Błąd zapisu')
      }
    } catch {
      setSettingsMsg('Błąd połączenia')
    } finally {
      setSavingSettings(false)
    }
  }

  async function addTransaction(e: React.FormEvent) {
    e.preventDefault()
    setTxError(null)
    const amount = parseFloat(txAmount.replace(',', '.'))
    if (isNaN(amount) || amount <= 0) { setTxError('Podaj kwotę > 0'); return }
    if (!txDate) { setTxError('Podaj datę'); return }
    setAddingTx(true)
    try {
      const res = await fetch('/api/finanse/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction: { type: txType, amount, date: txDate, note: txNote || null },
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setTxError(j.error ?? 'Błąd zapisu'); return }
      onTransactionAdded({
        id: j.id ?? crypto.randomUUID(),
        user_id: '',
        type: txType,
        amount,
        date: txDate,
        note: txNote || null,
        created_at: new Date().toISOString(),
      })
      setTxAmount('')
      setTxNote('')
    } catch {
      setTxError('Błąd połączenia')
    } finally {
      setAddingTx(false)
    }
  }

  async function deleteTx(id: string) {
    setDeletingTx(true)
    try {
      const res = await fetch(`/api/finanse/settings?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        onTransactionDeleted(id)
        setConfirmDeleteTxId(null)
      }
    } finally {
      setDeletingTx(false)
    }
  }

  const totalDeposits = transactions.filter(t => t.type === 'deposit').reduce((s, t) => s + t.amount, 0)
  const totalWithdrawals = transactions.filter(t => t.type === 'withdrawal').reduce((s, t) => s + t.amount, 0)

  return (
    <div className="space-y-4">
      {/* Bankroll */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <h3 className="text-white font-semibold text-sm mb-3">Ustawienia bankrolla</h3>
        <form onSubmit={saveSettings} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Saldo startowe (zł) *</Label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="1000,00"
                className={inputCls()}
                value={startingBalance}
                onChange={e => setStartingBalance(e.target.value)}
              />
            </div>
            <div>
              <Label>Miesięczny limit straty (zł)</Label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="200,00"
                className={inputCls()}
                value={monthlyLossLimit}
                onChange={e => setMonthlyLossLimit(e.target.value)}
              />
            </div>
          </div>
          {settingsMsg && (
            <p className={`text-xs px-3 py-2 rounded-lg border ${settingsMsg === 'Zapisano' ? 'text-emerald-400 bg-emerald-900/20 border-emerald-800' : 'text-red-400 bg-red-900/20 border-red-800'}`}>
              {settingsMsg}
            </p>
          )}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingSettings}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {savingSettings ? 'Zapisuję...' : 'Zapisz ustawienia'}
            </button>
          </div>
        </form>
      </div>

      {/* Podsumowanie transakcji */}
      {transactions.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-gray-500 text-xs mb-1">Suma wpłat</p>
            <p className="text-emerald-400 font-bold text-lg">+{fmt(totalDeposits)} zł</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-gray-500 text-xs mb-1">Suma wypłat</p>
            <p className="text-red-400 font-bold text-lg">-{fmt(totalWithdrawals)} zł</p>
          </div>
        </div>
      )}

      {/* Dodaj transakcję */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <h3 className="text-white font-semibold text-sm mb-3">Dodaj wpłatę / wypłatę</h3>
        <form onSubmit={addTransaction} className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <Label>Typ</Label>
              <select
                className={inputCls()}
                value={txType}
                onChange={e => setTxType(e.target.value as TransactionType)}
              >
                <option value="deposit">Wpłata</option>
                <option value="withdrawal">Wypłata</option>
              </select>
            </div>
            <div>
              <Label>Kwota (zł) *</Label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="200,00"
                className={inputCls()}
                value={txAmount}
                onChange={e => setTxAmount(e.target.value)}
              />
            </div>
            <div>
              <Label>Data *</Label>
              <input
                type="date"
                className={inputCls()}
                value={txDate}
                onChange={e => setTxDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Notatka</Label>
              <input
                type="text"
                placeholder="Opcjonalnie"
                className={inputCls()}
                value={txNote}
                onChange={e => setTxNote(e.target.value)}
              />
            </div>
          </div>
          {txError && (
            <p className="text-red-400 text-xs bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">{txError}</p>
          )}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={addingTx}
              className="px-5 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {addingTx ? 'Dodaję...' : 'Dodaj transakcję'}
            </button>
          </div>
        </form>
      </div>

      {/* Lista transakcji */}
      {transactions.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h3 className="text-white font-semibold text-sm mb-3">Historia transakcji</h3>
          <div className="space-y-1">
            {transactions.map(tx => (
              <div key={tx.id} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded border ${tx.type === 'deposit' ? 'bg-emerald-900/40 text-emerald-300 border-emerald-800' : 'bg-red-900/40 text-red-300 border-red-800'}`}>
                    {tx.type === 'deposit' ? 'Wpłata' : 'Wypłata'}
                  </span>
                  <span className={`text-sm font-medium ${tx.type === 'deposit' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {tx.type === 'deposit' ? '+' : '-'}{fmt(tx.amount)} zł
                  </span>
                  <span className="text-gray-500 text-xs">{tx.date}</span>
                  {tx.note && <span className="text-gray-600 text-xs italic">"{tx.note}"</span>}
                </div>
                <button
                  onClick={() => setConfirmDeleteTxId(tx.id)}
                  className="text-gray-700 hover:text-red-400 text-xs transition-colors px-2 shrink-0"
                >
                  Usuń
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Privacy notice */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-3">
        <p className="text-gray-600 text-xs">
          Dane finansowe są prywatne — widoczne wyłącznie dla Ciebie. Nie są uwzględniane w żadnych rankingach ani statystykach grupy.
        </p>
      </div>

      {/* Potwierdzenie usunięcia transakcji */}
      {confirmDeleteTxId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 max-w-sm w-full">
            <p className="text-white font-medium mb-1">Usuń transakcję?</p>
            <p className="text-gray-400 text-sm mb-4">Tej operacji nie można cofnąć.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDeleteTxId(null)}
                disabled={deletingTx}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Anuluj
              </button>
              <button
                onClick={() => deleteTx(confirmDeleteTxId)}
                disabled={deletingTx}
                className="px-4 py-2 text-sm bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white rounded-lg transition-colors"
              >
                {deletingTx ? 'Usuwam...' : 'Usuń'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
