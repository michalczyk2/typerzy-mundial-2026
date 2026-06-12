'use client'

export interface FinanceSummary {
  startingBalance: number
  currentBalance: number
  totalPnL: number
  totalStake: number
  totalBets: number
  wonCount: number
  lostCount: number
  cashoutCount: number
  voidCount: number
  pendingCount: number
  stakeInPlay: number
  winRate: number
  roi: number
  avgOdds: number
  avgStake: number
  biggestWin: number
  biggestLoss: number
  last7Days: number
  last30Days: number
}

function fmt(n: number, d = 2) {
  return n.toFixed(d).replace('.', ',')
}

function PnL({ value, suffix = ' zł' }: { value: number; suffix?: string }) {
  if (value > 0) return <span className="text-emerald-400">+{fmt(value)}{suffix}</span>
  if (value < 0) return <span className="text-red-400">{fmt(value)}{suffix}</span>
  return <span className="text-gray-400">{fmt(value)}{suffix}</span>
}

function StatCard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <p className="text-gray-500 text-xs mb-1">{label}</p>
      <div className="text-white font-bold text-lg leading-none">{value}</div>
      {sub && <p className="text-gray-600 text-xs mt-1">{sub}</p>}
    </div>
  )
}

export function FinanceStats({ stats }: { stats: FinanceSummary }) {
  const settledCount = stats.wonCount + stats.lostCount + stats.cashoutCount + stats.voidCount

  return (
    <div className="space-y-4">
      {/* Saldo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Saldo startowe"
          value={<span className="text-white">{fmt(stats.startingBalance)} zł</span>}
        />
        <StatCard
          label="Aktualne saldo"
          value={<PnL value={stats.currentBalance} />}
        />
        <StatCard
          label="Wynik całkowity"
          value={<PnL value={stats.totalPnL} />}
          sub={settledCount > 0 ? `${settledCount} rozliczonych` : undefined}
        />
        <StatCard
          label="Stawka w grze"
          value={<span className="text-blue-400">{fmt(stats.stakeInPlay)} zł</span>}
          sub={stats.pendingCount > 0 ? `${stats.pendingCount} oczekujących` : undefined}
        />
      </div>

      {/* Zestawienie */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        <StatCard label="Zakładów" value={stats.totalBets} />
        <StatCard label="Wygranych" value={<span className="text-emerald-400">{stats.wonCount}</span>} />
        <StatCard label="Przegranych" value={<span className="text-red-400">{stats.lostCount}</span>} />
        <StatCard label="Cash out" value={<span className="text-amber-400">{stats.cashoutCount}</span>} />
        <StatCard label="Zwrotów" value={<span className="text-gray-400">{stats.voidCount}</span>} />
        <StatCard label="Suma stawek" value={`${fmt(stats.totalStake)} zł`} />
      </div>

      {/* Wskaźniki */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Skuteczność"
          value={
            <span className={stats.winRate >= 50 ? 'text-emerald-400' : 'text-red-400'}>
              {fmt(stats.winRate, 1)}%
            </span>
          }
          sub={settledCount > 0 ? `z ${settledCount} rozl.` : 'brak danych'}
        />
        <StatCard label="ROI" value={<PnL value={stats.roi} suffix="%" />} />
        <StatCard label="Śr. kurs" value={settledCount > 0 ? fmt(stats.avgOdds) : '—'} />
        <StatCard label="Śr. stawka" value={settledCount > 0 ? `${fmt(stats.avgStake)} zł` : '—'} />
      </div>

      {/* Ekstrema i okresy */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Największa wygrana"
          value={
            stats.wonCount > 0
              ? <span className="text-emerald-400">+{fmt(stats.biggestWin)} zł</span>
              : <span className="text-gray-600">—</span>
          }
        />
        <StatCard
          label="Największa strata"
          value={
            stats.lostCount > 0
              ? <span className="text-red-400">{fmt(stats.biggestLoss)} zł</span>
              : <span className="text-gray-600">—</span>
          }
        />
        <StatCard label="Ostatnie 7 dni" value={<PnL value={stats.last7Days} />} />
        <StatCard label="Ostatnie 30 dni" value={<PnL value={stats.last30Days} />} />
      </div>

      {/* Charts placeholder */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
        <p className="text-gray-500 text-sm mb-1">Wykresy — wkrótce</p>
        <p className="text-gray-700 text-xs">
          Saldo w czasie · Wyniki miesięczne · Skuteczność wg sportu i bukmachera
        </p>
      </div>
    </div>
  )
}
