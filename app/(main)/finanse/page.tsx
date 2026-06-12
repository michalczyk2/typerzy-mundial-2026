'use client'

import { useState, useEffect, useMemo } from 'react'
import { BetForm } from '@/components/finanse/BetForm'
import { BetList } from '@/components/finanse/BetList'
import { FinanceStats, type FinanceSummary } from '@/components/finanse/FinanceStats'
import { FinanceSettings } from '@/components/finanse/FinanceSettings'
import type { Bet, BettingSettings, BettingTransaction } from '@/types'

type Tab = 'summary' | 'bets' | 'settings'

function computeSummary(
  bets: Bet[],
  settings: BettingSettings | null,
  transactions: BettingTransaction[],
): FinanceSummary {
  const settled = bets.filter(b => b.status !== 'pending')
  const pending = bets.filter(b => b.status === 'pending')
  const wonBets = settled.filter(b => b.status === 'won')
  const lostBets = settled.filter(b => b.status === 'lost')
  const cashoutBets = settled.filter(b => b.status === 'cashout')
  const voidBets = settled.filter(b => b.status === 'void')

  const totalPnL = settled.reduce((s, b) => s + b.profit, 0)
  const totalStake = settled.reduce((s, b) => s + b.stake, 0)
  const stakeInPlay = pending.reduce((s, b) => s + b.stake, 0)

  const winDenom = wonBets.length + lostBets.length
  const winRate = winDenom > 0 ? (wonBets.length / winDenom) * 100 : 0
  const roi = totalStake > 0 ? (totalPnL / totalStake) * 100 : 0
  const avgOdds = settled.length > 0 ? settled.reduce((s, b) => s + b.odds, 0) / settled.length : 0
  const avgStake = settled.length > 0 ? totalStake / settled.length : 0

  const biggestWin = wonBets.length > 0 ? Math.max(...wonBets.map(b => b.profit)) : 0
  const biggestLoss = lostBets.length > 0 ? Math.min(...lostBets.map(b => b.profit)) : 0

  const now = new Date()
  const ago7 = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10)
  const ago30 = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10)
  const last7Days = settled.filter(b => b.date >= ago7).reduce((s, b) => s + b.profit, 0)
  const last30Days = settled.filter(b => b.date >= ago30).reduce((s, b) => s + b.profit, 0)

  const startingBalance = settings?.starting_balance ?? 0
  const txBalance = transactions.reduce((s, t) => s + (t.type === 'deposit' ? t.amount : -t.amount), 0)
  const currentBalance = startingBalance + txBalance + totalPnL

  return {
    startingBalance,
    currentBalance,
    totalPnL,
    totalStake,
    totalBets: bets.length,
    wonCount: wonBets.length,
    lostCount: lostBets.length,
    cashoutCount: cashoutBets.length,
    voidCount: voidBets.length,
    pendingCount: pending.length,
    stakeInPlay,
    winRate,
    roi,
    avgOdds,
    avgStake,
    biggestWin,
    biggestLoss,
    last7Days,
    last30Days,
  }
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'summary', label: 'Podsumowanie' },
  { id: 'bets', label: 'Zakłady' },
  { id: 'settings', label: 'Ustawienia' },
]

export default function FinansePage() {
  const [bets, setBets] = useState<Bet[]>([])
  const [settings, setSettings] = useState<BettingSettings | null>(null)
  const [transactions, setTransactions] = useState<BettingTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('summary')
  const [editBet, setEditBet] = useState<Bet | null>(null)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    async function fetchAll() {
      setLoading(true)
      const [betsRes, settingsRes] = await Promise.all([
        fetch('/api/finanse/bets'),
        fetch('/api/finanse/settings'),
      ])
      const [betsData, settingsData] = await Promise.all([
        betsRes.json().catch(() => ({ bets: [] })),
        settingsRes.json().catch(() => ({ settings: null, transactions: [] })),
      ])
      setBets(betsData.bets ?? [])
      setSettings(settingsData.settings ?? null)
      setTransactions(settingsData.transactions ?? [])
      setLoading(false)
    }
    void fetchAll()
  }, [])

  const summary = useMemo(() => computeSummary(bets, settings, transactions), [bets, settings, transactions])

  function handleBetSaved(bet: Bet) {
    setBets(prev => {
      const idx = prev.findIndex(b => b.id === bet.id)
      if (idx >= 0) {
        return prev.map(b => b.id === bet.id ? bet : b)
      }
      return [bet, ...prev]
    })
    setEditBet(null)
    setShowForm(false)
  }

  function handleBetDeleted(id: string) {
    setBets(prev => prev.filter(b => b.id !== id))
  }

  function handleEditBet(bet: Bet) {
    setEditBet(bet)
    setShowForm(true)
    setActiveTab('bets')
  }

  function handleCancelEdit() {
    setEditBet(null)
    setShowForm(false)
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-4 pb-24 md:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white font-bold text-xl">Finanse</h1>
          <p className="text-gray-500 text-xs mt-0.5">Prywatny tracker zakładów — tylko Ty widzisz te dane</p>
        </div>
        <button
          onClick={() => { setEditBet(null); setShowForm(s => !s); setActiveTab('bets') }}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {showForm && !editBet ? '✕ Anuluj' : '+ Dodaj zakład'}
        </button>
      </div>

      {loading && (
        <div className="text-center py-16 text-gray-600">
          <p className="text-2xl mb-2">⏳</p>
          <p className="text-sm">Ładowanie danych...</p>
        </div>
      )}

      {!loading && (
        <>
          {/* Formularz — widoczny gdy showForm lub edytujemy */}
          {(showForm || editBet) && (
            <BetForm
              editBet={editBet}
              onSaved={handleBetSaved}
              onCancel={handleCancelEdit}
            />
          )}

          {/* Tabs */}
          <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === tab.id ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}
              >
                {tab.label}
                {tab.id === 'bets' && bets.length > 0 && (
                  <span className="ml-1.5 text-xs text-gray-600">({bets.length})</span>
                )}
              </button>
            ))}
          </div>

          {activeTab === 'summary' && <FinanceStats stats={summary} />}
          {activeTab === 'bets' && (
            <BetList bets={bets} onEdit={handleEditBet} onDeleted={handleBetDeleted} />
          )}
          {activeTab === 'settings' && (
            <FinanceSettings
              settings={settings}
              transactions={transactions}
              onSettingsSaved={s => setSettings(s)}
              onTransactionAdded={tx => setTransactions(prev => [tx, ...prev])}
              onTransactionDeleted={id => setTransactions(prev => prev.filter(t => t.id !== id))}
            />
          )}
        </>
      )}
    </div>
  )
}
