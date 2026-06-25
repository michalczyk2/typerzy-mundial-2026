'use client'

import { useEffect, useState } from 'react'
import { formatMatchDate, formatMatchTime } from '@/lib/utils'
import type { CorrectionHistoryEntry } from '@/app/api/admin/predictions/history/route'

export function AdminCorrectionHistory() {
  const [entries, setEntries] = useState<CorrectionHistoryEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    if (loaded) return
    setLoading(true)
    setError(null)
    fetch('/api/admin/predictions/history')
      .then(r => r.json())
      .then(({ entries: data, error: err }: { entries?: CorrectionHistoryEntry[]; error?: string }) => {
        if (err) { setError(err); return }
        setEntries(Array.isArray(data) ? data : [])
        setLoaded(true)
      })
      .catch(() => setError('Błąd sieci'))
      .finally(() => setLoading(false))
  }

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next) load()
  }

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-bold text-white">Historia korekt adminów</span>
        <span className="text-xs text-gray-500">{open ? '▲ Ukryj' : '▼ Pokaż'}</span>
      </button>

      {open && (
        <div className="border-t border-gray-800 px-4 pb-4 pt-3">
          {loading && (
            <p className="text-xs text-gray-500">Ładowanie...</p>
          )}
          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}
          {!loading && !error && entries.length === 0 && (
            <p className="text-xs text-gray-500">Brak historii korekt.</p>
          )}
          {!loading && entries.length > 0 && (
            <div className="space-y-2">
              {entries.map(entry => (
                <div key={entry.id} className="rounded-lg border border-gray-800 bg-gray-950/60 p-3 text-xs">
                  <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-0.5">
                    <span className="font-bold text-white">{entry.nick}</span>
                    <span className="text-gray-600">
                      {entry.admin_override_at
                        ? new Date(entry.admin_override_at).toLocaleString('pl-PL', {
                            day: '2-digit', month: '2-digit', year: '2-digit',
                            hour: '2-digit', minute: '2-digit',
                            timeZone: 'Europe/Warsaw',
                          })
                        : '—'}
                      {entry.override_by_nick && ` · przez ${entry.override_by_nick}`}
                    </span>
                  </div>
                  <div className="mt-1 text-gray-400">
                    {entry.team_a} vs {entry.team_b}
                    {' · '}
                    {formatMatchDate(entry.match_date)} {formatMatchTime(entry.match_date)}
                    {entry.score_a !== null && entry.score_b !== null && (
                      <span className="ml-1 text-gray-600">(wynik: {entry.score_a}:{entry.score_b})</span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-emerald-400 font-bold">
                      Typ: {entry.predicted_a}:{entry.predicted_b}
                    </span>
                  </div>
                  {entry.admin_override_reason && (
                    <p className="mt-1 text-gray-500 italic">{entry.admin_override_reason}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
