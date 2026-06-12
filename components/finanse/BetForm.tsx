'use client'

import { useState, useEffect } from 'react'
import type { Bet, BetStatus } from '@/types'

interface BetFormProps {
  editBet?: Bet | null
  onSaved: (bet: Bet) => void
  onCancel?: () => void
}

const STATUSES: { value: BetStatus; label: string }[] = [
  { value: 'pending', label: 'Oczekuje' },
  { value: 'won', label: 'Wygrana' },
  { value: 'lost', label: 'Przegrana' },
  { value: 'cashout', label: 'Cash out' },
  { value: 'void', label: 'Zwrot' },
]

const today = () => new Date().toISOString().slice(0, 10)

const emptyForm = () => ({
  date: today(),
  sport: '',
  league: '',
  event_name: '',
  bet_type: '',
  bookmaker: '',
  stake: '',
  odds: '',
  status: 'pending' as BetStatus,
  cash_out_amount: '',
  note: '',
})

function inputCls(extra = '') {
  return `w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500 ${extra}`
}

export function BetForm({ editBet, onSaved, onCancel }: BetFormProps) {
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (editBet) {
      setForm({
        date: editBet.date,
        sport: editBet.sport,
        league: editBet.league,
        event_name: editBet.event_name,
        bet_type: editBet.bet_type,
        bookmaker: editBet.bookmaker,
        stake: String(editBet.stake),
        odds: String(editBet.odds),
        status: editBet.status,
        cash_out_amount: editBet.cash_out_amount != null ? String(editBet.cash_out_amount) : '',
        note: editBet.note ?? '',
      })
    } else {
      setForm(emptyForm())
    }
    setError(null)
  }, [editBet])

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const stakeNum = parseFloat(form.stake.replace(',', '.'))
    const oddsNum = parseFloat(form.odds.replace(',', '.'))
    if (!form.date) { setError('Podaj datę zakładu'); return }
    if (isNaN(stakeNum) || stakeNum <= 0) { setError('Podaj poprawną stawkę'); return }
    if (isNaN(oddsNum) || oddsNum < 1) { setError('Kurs musi być ≥ 1,00'); return }
    if (form.status === 'cashout') {
      const co = parseFloat(form.cash_out_amount.replace(',', '.'))
      if (isNaN(co) || co < 0) { setError('Podaj kwotę cash out'); return }
    }

    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        date: form.date,
        sport: form.sport,
        league: form.league,
        event_name: form.event_name,
        bet_type: form.bet_type,
        bookmaker: form.bookmaker,
        stake: stakeNum,
        odds: oddsNum,
        status: form.status,
        cash_out_amount: form.status === 'cashout' ? parseFloat(form.cash_out_amount.replace(',', '.')) : null,
        note: form.note || null,
      }
      if (editBet) payload.id = editBet.id

      const res = await fetch('/api/finanse/bets', {
        method: editBet ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Błąd zapisu'); return }

      onSaved(json.bet)
      if (!editBet) setForm(emptyForm())
    } catch {
      setError('Błąd połączenia')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
      <h3 className="text-white font-semibold text-sm">
        {editBet ? 'Edytuj zakład' : 'Dodaj zakład'}
      </h3>

      {error && (
        <p className="text-red-400 text-xs bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="text-gray-500 text-xs block mb-1">Data *</label>
          <input type="date" className={inputCls()} value={form.date} onChange={e => set('date', e.target.value)} />
        </div>
        <div>
          <label className="text-gray-500 text-xs block mb-1">Status *</label>
          <select
            className={inputCls()}
            value={form.status}
            onChange={e => set('status', e.target.value)}
          >
            {STATUSES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-gray-500 text-xs block mb-1">Stawka (zł) *</label>
          <input
            type="text"
            inputMode="decimal"
            placeholder="100,00"
            className={inputCls()}
            value={form.stake}
            onChange={e => set('stake', e.target.value)}
          />
        </div>
        <div>
          <label className="text-gray-500 text-xs block mb-1">Kurs *</label>
          <input
            type="text"
            inputMode="decimal"
            placeholder="1,85"
            className={inputCls()}
            value={form.odds}
            onChange={e => set('odds', e.target.value)}
          />
        </div>
      </div>

      {form.status === 'cashout' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-gray-500 text-xs block mb-1">Kwota cash out (zł) *</label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="80,00"
              className={inputCls('border-amber-700')}
              value={form.cash_out_amount}
              onChange={e => set('cash_out_amount', e.target.value)}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div>
          <label className="text-gray-500 text-xs block mb-1">Sport</label>
          <input
            type="text"
            placeholder="Piłka nożna"
            className={inputCls()}
            value={form.sport}
            onChange={e => set('sport', e.target.value)}
          />
        </div>
        <div>
          <label className="text-gray-500 text-xs block mb-1">Liga</label>
          <input
            type="text"
            placeholder="PKO BP Ekstraklasa"
            className={inputCls()}
            value={form.league}
            onChange={e => set('league', e.target.value)}
          />
        </div>
        <div className="col-span-2 md:col-span-1">
          <label className="text-gray-500 text-xs block mb-1">Bukmacher</label>
          <input
            type="text"
            placeholder="Betclic"
            className={inputCls()}
            value={form.bookmaker}
            onChange={e => set('bookmaker', e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-gray-500 text-xs block mb-1">Zdarzenie / mecz</label>
          <input
            type="text"
            placeholder="Legia Warszawa – Lech Poznań"
            className={inputCls()}
            value={form.event_name}
            onChange={e => set('event_name', e.target.value)}
          />
        </div>
        <div>
          <label className="text-gray-500 text-xs block mb-1">Typ zakładu</label>
          <input
            type="text"
            placeholder="1X2 · Over 2.5 · BTTS"
            className={inputCls()}
            value={form.bet_type}
            onChange={e => set('bet_type', e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="text-gray-500 text-xs block mb-1">Notatka</label>
        <input
          type="text"
          placeholder="Opcjonalna notatka..."
          className={inputCls()}
          value={form.note}
          onChange={e => set('note', e.target.value)}
        />
      </div>

      <div className="flex gap-2 justify-end">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Anuluj
          </button>
        )}
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {saving ? 'Zapisuję...' : editBet ? 'Zapisz zmiany' : 'Dodaj zakład'}
        </button>
      </div>
    </form>
  )
}
