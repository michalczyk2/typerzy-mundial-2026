'use client'
import { useState, useMemo } from 'react'
import { useAppStore } from '@/lib/store'
import { FlagImg } from '@/components/ui/FlagImg'

interface Props {
  currentPick: { team_code: string; team_name: string } | null
  onClose: () => void
  onSaved: (teamCode: string, teamName: string) => void
}

export function ChampionPicker({ currentPick, onClose, onSaved }: Props) {
  const { matches } = useAppStore()
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const teams = useMemo(() => {
    const seen = new Map<string, string>()
    for (const m of matches) {
      if (m.phase !== 'group') continue
      if (!seen.has(m.team_a_code)) seen.set(m.team_a_code, m.team_a)
      if (!seen.has(m.team_b_code)) seen.set(m.team_b_code, m.team_b)
    }
    return Array.from(seen.entries())
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [matches])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return teams
    return teams.filter(t => t.name.toLowerCase().includes(q) || t.code.toLowerCase().includes(q))
  }, [teams, search])

  const handlePick = async (teamCode: string, teamName: string) => {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/champion-prediction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_code: teamCode, team_name: teamName }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError((json as { error?: string }).error ?? 'Błąd zapisu')
        return
      }
      onSaved(teamCode, teamName)
    } catch {
      setError('Błąd sieci')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-gray-900 border border-gray-700 rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="text-white font-bold text-base">Wybierz mistrza turnieju</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl w-8 h-8 flex items-center justify-center rounded"
          >
            ✕
          </button>
        </div>
        <div className="p-3 border-b border-gray-800">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Szukaj drużyny..."
            autoFocus
            className="w-full h-9 bg-gray-800 border border-gray-700 rounded-lg px-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-emerald-500"
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.map(t => (
            <button
              key={t.code}
              disabled={saving}
              onClick={() => handlePick(t.code, t.name)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-800 transition-colors border-b border-gray-800/50 last:border-0 disabled:opacity-50 ${currentPick?.team_code === t.code ? 'bg-emerald-950/40' : ''}`}
            >
              <FlagImg code={t.code} name={t.name} size="sm" />
              <span className={`text-sm font-medium ${currentPick?.team_code === t.code ? 'text-emerald-400' : 'text-white'}`}>
                {t.name}
              </span>
              {currentPick?.team_code === t.code && (
                <span className="ml-auto text-emerald-400 text-xs font-bold shrink-0">Aktualny wybór</span>
              )}
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-8 text-gray-600 text-sm">Brak wyników</div>
          )}
        </div>
        {error && (
          <div className="p-3 border-t border-gray-800">
            <p className="text-red-400 text-sm text-center">{error}</p>
          </div>
        )}
      </div>
    </div>
  )
}
