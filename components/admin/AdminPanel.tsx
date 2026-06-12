'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { Match, MatchPhase } from '@/types'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { useAppStore } from '@/lib/store'
import { IS_PRODUCTION_MODE } from '@/lib/tournament-config'

type ScoringSetting = { key: string; label: string; value: number; description: string | null; updated_at: string | null }

type EditMode = 'score' | 'meta' | null

type WC26SyncLog = { created_at: string; status: string; message: string; records_updated: number }

async function callSyncEndpoint(endpoint: string): Promise<string> {
  if (!IS_PRODUCTION_MODE) return `[MOCK] ${endpoint} — brak efektu w trybie lokalnym`
  try {
    const res = await fetch(endpoint, { method: 'POST' })
    const json = await res.json().catch(() => ({}))
    return res.ok ? `OK: ${json.message ?? 'Sukces'}` : `Błąd ${res.status}: ${json.error ?? 'Nieznany błąd'}`
  } catch {
    return `Błąd sieci: ${endpoint}`
  }
}

type PendingUser = { id: string; nick: string; status: string; role: string; total_points: number }

export function AdminPanel() {
  const { users, matches, currentUser, setUsers, updateUserStatus, updateMatchScore, updateMatchFull } = useAppStore()
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([])
  const [editingNickId, setEditingNickId] = useState<string|null>(null)
  const [editNickValue, setEditNickValue] = useState('')
  const [editing, setEditing] = useState<string|null>(null)
  const [editMode, setEditMode] = useState<EditMode>(null)
  const [scoreA, setScoreA] = useState('')
  const [scoreB, setScoreB] = useState('')
  const [editPhase, setEditPhase] = useState<MatchPhase>('group')
  const [editGroup, setEditGroup] = useState('')
  const [editRound, setEditRound] = useState('')
  const [syncStatus, setSyncStatus] = useState<Record<string, string>>({})
  const [settings, setSettings] = useState<ScoringSetting[]>([])
  const [settingValues, setSettingValues] = useState<Record<string, number>>({})
  const [saveStatus, setSaveStatus] = useState<Record<string, string>>({})
  const [wc26LastSync, setWc26LastSync] = useState<WC26SyncLog | null>(null)
  const [wc26Loading, setWc26Loading] = useState(false)
  const [wc26Msg, setWc26Msg] = useState('')

  const loadPendingUsers = () => {
    fetch('/api/admin/users')
      .then(r => r.json())
      .then((data: { users?: PendingUser[] }) => {
        const all = Array.isArray(data?.users) ? data.users : []
        const pending = all.filter(u => u.status === 'pending' && u.id !== currentUser?.id)
        setPendingUsers(pending)
      })
      .catch(err => console.error('[AdminPanel] loadPendingUsers:', err))
  }

  const loadWC26Sync = () => {
    if (!IS_PRODUCTION_MODE) return
    fetch('/api/sync-wc26')
      .then(r => r.json())
      .then(({ last_sync }: { last_sync: WC26SyncLog | null }) => setWc26LastSync(last_sync ?? null))
      .catch(() => {})
  }

  useEffect(() => {
    loadPendingUsers()
    loadWC26Sync()
    fetch('/api/admin/scoring-settings')
      .then(r => r.json())
      .then(({ settings: rows }: { settings: ScoringSetting[] }) => {
        setSettings(rows)
        setSettingValues(Object.fromEntries(rows.map(r => [r.key, r.value])))
      })
      .catch(() => {})
  }, [])

  const handleScoreSubmit = (matchId: string) => {
    if (scoreA === '' || scoreB === '') return
    updateMatchScore(matchId, Number(scoreA), Number(scoreB))
    setEditing(null); setEditMode(null); setScoreA(''); setScoreB('')
  }

  const handleMetaSubmit = (matchId: string) => {
    updateMatchFull(matchId, {
      phase: editPhase,
      group_name: editGroup || null,
      round: Number(editRound) || 1,
    })
    setEditing(null); setEditMode(null)
  }

  const startEdit = (match: Match, mode: EditMode) => {
    setEditing(match.id)
    setEditMode(mode)
    if (mode === 'score') {
      setScoreA(match.score_a != null ? String(match.score_a) : '')
      setScoreB(match.score_b != null ? String(match.score_b) : '')
    } else if (mode === 'meta') {
      setEditPhase(match.phase)
      setEditGroup(match.group_name ?? '')
      setEditRound(String(match.round))
    }
  }

  const handleSaveSetting = async (key: string) => {
    const value = settingValues[key]
    if (typeof value !== 'number') return
    setSaveStatus(s => ({ ...s, [key]: 'Zapisywanie...' }))
    try {
      const res = await fetch('/api/admin/scoring-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      })
      setSaveStatus(s => ({ ...s, [key]: res.ok ? 'Zapisano ✓' : 'Błąd zapisu' }))
    } catch {
      setSaveStatus(s => ({ ...s, [key]: 'Błąd sieci' }))
    }
  }

  const handleSync = async (endpoint: string) => {
    setSyncStatus(s => ({ ...s, [endpoint]: 'Ładowanie...' }))
    const msg = await callSyncEndpoint(endpoint)
    setSyncStatus(s => ({ ...s, [endpoint]: msg }))
  }

  const handleWC26Sync = async () => {
    setWc26Loading(true)
    setWc26Msg('Synchronizuję...')
    try {
      const res = await fetch('/api/sync-wc26', { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      setWc26Msg(res.ok ? `OK: ${json.message ?? 'Sukces'}` : `Błąd: ${json.error ?? 'Nieznany błąd'}`)
      if (res.ok) loadWC26Sync()
    } catch {
      setWc26Msg('Błąd sieci')
    } finally {
      setWc26Loading(false)
    }
  }

  const handleDeleteUser = async (userId: string, nick: string) => {
    if (!window.confirm(`Czy na pewno usunąć gracza ${nick}? Usunie to też jego typy.`)) return
    try {
      const res = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        console.error('[AdminPanel] handleDeleteUser error:', json)
        return
      }
      setUsers(users.filter(u => u.id !== userId))
    } catch (err) {
      console.error('[AdminPanel] handleDeleteUser fetch error:', err)
    }
  }

  const handleRenameUser = async (userId: string, nick: string) => {
    const trimmed = nick.trim()
    if (!trimmed) return
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId, nick: trimmed }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        console.error('[AdminPanel] handleRenameUser error:', json)
        return
      }
      setUsers(users.map(u => u.id === userId ? { ...u, nick: trimmed } : u))
      setEditingNickId(null)
    } catch (err) {
      console.error('[AdminPanel] handleRenameUser fetch error:', err)
    }
  }

  const handleUserAction = async (userId: string, status: 'active' | 'blocked') => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId, status }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        console.error('[AdminPanel] handleUserAction error:', json)
        return
      }
      updateUserStatus(userId, status)
      loadPendingUsers()
    } catch (err) {
      console.error('[AdminPanel] handleUserAction fetch error:', err)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-white font-bold text-lg mb-4">Oczekujący gracze</h2>
        {pendingUsers.length === 0 ? (
          <p className="text-gray-500 text-sm">Brak oczekujących graczy.</p>
        ) : (
          <div className="space-y-3">
            {pendingUsers.map(user => (
              <div key={user.id} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                <div>
                  <span className="text-white font-medium">{user.nick}</span>
                  <Badge variant="pending" className="ml-2">Oczekuje</Badge>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleUserAction(user.id, 'active')}>Akceptuj</Button>
                  <Button size="sm" variant="danger" onClick={() => handleUserAction(user.id, 'blocked')}>Zablokuj</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="text-white font-bold text-lg mb-1">Ustawienia punktacji</h2>
        <p className="text-gray-600 text-xs mb-4">Zmiany obowiązują przy następnym przeliczeniu punktów.</p>
        {settings.length === 0 ? (
          <p className="text-gray-600 text-xs">Ładowanie...</p>
        ) : (
          <div className="space-y-4">
            {settings.map(setting => (
              <div key={setting.key} className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium">{setting.label}</p>
                  {setting.description && <p className="text-gray-600 text-xs mt-0.5 truncate">{setting.description}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <input
                    type="number" min="0" max="99"
                    value={settingValues[setting.key] ?? setting.value}
                    onChange={e => {
                      const v = parseInt(e.target.value, 10)
                      if (!isNaN(v)) setSettingValues(prev => ({ ...prev, [setting.key]: v }))
                    }}
                    className="w-16 h-8 text-center bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-emerald-500"
                  />
                  <Button size="sm" onClick={() => handleSaveSetting(setting.key)}
                    disabled={saveStatus[setting.key] === 'Zapisywanie...'}>
                    Zapisz
                  </Button>
                  {saveStatus[setting.key] && (
                    <span className={`text-xs ${saveStatus[setting.key] === 'Zapisano ✓' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {saveStatus[setting.key]}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-5 pt-4 border-t border-gray-800">
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="secondary" onClick={() => handleSync('/api/recalculate-points')}
              disabled={syncStatus['/api/recalculate-points'] === 'Ładowanie...'}>
              Przelicz punkty od nowa
            </Button>
            {syncStatus['/api/recalculate-points'] && (
              <p className="text-xs text-gray-500">{syncStatus['/api/recalculate-points']}</p>
            )}
          </div>
          {!IS_PRODUCTION_MODE && (
            <p className="text-gray-600 text-xs mt-2">Tryb lokalny — zapis ustawień i przeliczanie nie mają efektu.</p>
          )}
        </div>
      </Card>

      <Card>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-white font-bold text-lg">Synchronizacja worldcup26.ir</h2>
            <p className="text-gray-600 text-xs mt-0.5">Mecze, wyniki, tabele grupowe (primary source)</p>
          </div>
          {IS_PRODUCTION_MODE && wc26LastSync && (
            <div className="text-right shrink-0 ml-4">
              <p className="text-gray-600 text-xs">Ostatnia sync</p>
              <p className={`text-xs font-medium ${wc26LastSync.status === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                {new Date(wc26LastSync.created_at).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw' })}
              </p>
              <p className="text-gray-600 text-xs">{wc26LastSync.records_updated} meczów</p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Button onClick={handleWC26Sync} disabled={wc26Loading} className="flex items-center gap-2">
            ⚡ {wc26Loading ? 'Synchronizuję...' : 'Synchronizuj dane'}
          </Button>
          {wc26Msg && (
            <p className={`text-sm ${wc26Msg.startsWith('OK') ? 'text-emerald-400' : 'text-red-400'}`}>{wc26Msg}</p>
          )}
        </div>
        {IS_PRODUCTION_MODE && wc26LastSync?.status === 'error' && !wc26Msg && (
          <div className="mt-3 p-2 bg-red-900/20 border border-red-800 rounded text-xs text-red-400">
            Ostatnia sync nie powiodła się: {wc26LastSync.message}
          </div>
        )}
        {!IS_PRODUCTION_MODE && (
          <p className="text-gray-600 text-xs mt-3">Tryb lokalny — synchronizacja nie ma efektu.</p>
        )}
      </Card>

      <Card>
        <h2 className="text-white font-bold text-lg mb-4">Synchronizacja danych</h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Sync mecze', endpoint: '/api/sync-matches', icon: '⚽' },
            { label: 'Sync wyniki', endpoint: '/api/sync-results', icon: '📊' },
            { label: 'Przelicz punkty', endpoint: '/api/recalculate-points', icon: '🔢' },
            { label: 'Sync grupy', endpoint: '/api/sync-standings', icon: '📋' },
          ].map(({ label, endpoint, icon }) => (
            <div key={endpoint} className="flex flex-col gap-1">
              <Button variant="secondary" className="flex items-center gap-2 justify-center"
                onClick={() => handleSync(endpoint)}
                disabled={syncStatus[endpoint] === 'Ładowanie...'}>
                <span>{icon}</span> {label}
              </Button>
              {syncStatus[endpoint] && (
                <p className="text-xs text-gray-500 text-center truncate" title={syncStatus[endpoint]}>
                  {syncStatus[endpoint]}
                </p>
              )}
            </div>
          ))}
        </div>
        {!IS_PRODUCTION_MODE && (
          <p className="text-gray-600 text-xs mt-3">Tryb lokalny — synchronizacja nie ma efektu.</p>
        )}
      </Card>

      <Card>
        <h2 className="text-white font-bold text-lg mb-1">Wszystkie mecze</h2>
        <p className="text-gray-600 text-xs mb-4">{matches.length} meczów</p>
        <div className="space-y-2">
          {matches.map(match => (
            <div key={match.id} className="border border-gray-800 rounded-lg py-3 px-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <Link href={`/mecze/${match.id}`} className="text-gray-200 text-sm font-medium hover:text-emerald-400 transition-colors">
                    {match.team_a} vs {match.team_b} →
                  </Link>
                  <div className="text-gray-600 text-xs mt-0.5">
                    {match.phase === 'group' ? `Gr. ${match.group_name} · R${match.round}` : match.phase}
                    {' · '}{match.status}
                  </div>
                </div>

                {editing === match.id && editMode === 'score' ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <input type="number" min="0" max="20" value={scoreA} onChange={e => setScoreA(e.target.value)}
                      className="w-10 h-8 text-center bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-emerald-500" />
                    <span className="text-gray-600">:</span>
                    <input type="number" min="0" max="20" value={scoreB} onChange={e => setScoreB(e.target.value)}
                      className="w-10 h-8 text-center bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-emerald-500" />
                    <Button size="sm" onClick={() => handleScoreSubmit(match.id)}>OK</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setEditing(null); setEditMode(null) }}>✕</Button>
                  </div>
                ) : editing === match.id && editMode === 'meta' ? (
                  <div className="flex flex-col gap-2 w-full mt-2">
                    <div className="flex gap-2 flex-wrap items-center">
                      <select value={editPhase} onChange={e => setEditPhase(e.target.value as MatchPhase)}
                        className="bg-gray-800 border border-gray-700 rounded text-white text-xs px-2 h-8 focus:outline-none focus:border-emerald-500">
                        {(['group','round_of_32','round_of_16','quarterfinal','semifinal','third_place','final'] as MatchPhase[]).map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                      <input value={editGroup} onChange={e => setEditGroup(e.target.value)} placeholder="Grupa (A-L)"
                        className="w-20 h-8 text-center bg-gray-800 border border-gray-700 rounded text-white text-xs focus:outline-none focus:border-emerald-500 px-2" />
                      <input type="number" value={editRound} onChange={e => setEditRound(e.target.value)} placeholder="Kolejka"
                        className="w-20 h-8 text-center bg-gray-800 border border-gray-700 rounded text-white text-xs focus:outline-none focus:border-emerald-500" />
                      <Button size="sm" onClick={() => handleMetaSubmit(match.id)}>Zapisz</Button>
                      <Button size="sm" variant="ghost" onClick={() => { setEditing(null); setEditMode(null) }}>✕</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 shrink-0">
                    {match.score_a !== null && match.score_b !== null
                      ? <span className="text-white font-bold tabular-nums text-sm">{match.score_a}:{match.score_b}</span>
                      : <span className="text-gray-700 text-xs">–:–</span>}
                    <Button size="sm" variant="ghost" onClick={() => startEdit(match, 'score')}>⚽</Button>
                    <Button size="sm" variant="ghost" onClick={() => startEdit(match, 'meta')}>✎</Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="text-white font-bold text-lg mb-2">Wszyscy gracze</h2>
        <div className="space-y-2">
          {users.map(user => (
            <div key={user.id} className="flex items-center justify-between py-2 gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {editingNickId === user.id ? (
                  <input
                    type="text"
                    value={editNickValue}
                    onChange={e => setEditNickValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleRenameUser(user.id, editNickValue)
                      if (e.key === 'Escape') setEditingNickId(null)
                    }}
                    autoFocus
                    className="h-8 w-32 bg-gray-800 border border-emerald-600 rounded text-white text-sm px-2 focus:outline-none"
                  />
                ) : (
                  <span className="text-white text-sm">{user.nick}</span>
                )}
                {user.role === 'admin' && <Badge variant="admin">Admin</Badge>}
                {user.status === 'pending' && <Badge variant="pending">Oczekuje</Badge>}
                {user.status === 'blocked' && <Badge variant="default" className="text-red-400">Zablokowany</Badge>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-emerald-400 font-bold text-sm">{user.total_points} pkt</span>
                {editingNickId === user.id ? (
                  <>
                    <Button size="sm" onClick={() => handleRenameUser(user.id, editNickValue)}>Zapisz</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingNickId(null)}>✕</Button>
                  </>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => { setEditingNickId(user.id); setEditNickValue(user.nick) }}>✎</Button>
                )}
                {user.id !== currentUser?.id && editingNickId !== user.id && (
                  <Button size="sm" variant="danger" onClick={() => handleDeleteUser(user.id, user.nick)}>Usuń</Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
