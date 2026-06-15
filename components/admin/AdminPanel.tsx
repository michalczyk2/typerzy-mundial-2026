'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { DEFAULT_FORM_VISUAL_SETTINGS } from '@/lib/form-visual-settings'
import type { FormDisplayMode, FormEffectOverride, FormStyleVariant, FormVisualSettings, Match, MatchPhase, User } from '@/types'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { useAppStore } from '@/lib/store'
import { IS_PRODUCTION_MODE } from '@/lib/tournament-config'
import { formatMatchDate, formatMatchTime } from '@/lib/utils'

type ScoringSetting = { key: string; label: string; value: number; description: string | null; updated_at: string | null }

type EditMode = 'score' | 'meta' | null

type WC26SyncLog = { created_at: string; status: string; message: string; records_updated: number }

type ChampionPick = { id: string; user_id: string; nick: string; team_code: string; team_name: string; is_correct: boolean | null }

type OrphanedMatch = {
  id: string
  externalId: string | null
  teamA: string
  teamB: string
  matchDate: string
  dataSource: string
  predictionsCount: number
  bonusPointsCount: number
  modEventsCount: number
}

type DuplicatePair = {
  legacyId: string
  legacyExt: string | null
  legacyTeamA: string
  legacyTeamB: string
  legacyDay: string
  legacyRound: number
  legacyGroup: string | null
  legacySource: string
  canonicalId: string
  canonicalExt: string
  canonicalDay: string
}

type ModEvent = {
  id: string
  official_match_day: string
  vote_deadline: string
  selected_bonus_points: number | null
  status: 'voting' | 'locked' | 'settled'
  match: { id: string; team_a: string; team_b: string; match_date: string; status: string } | null
}
type ModStatusData = {
  event: ModEvent | null
  isVotingOpen: boolean
  myVote: number | null
  voteCounts: Record<number, number> | null
  totalVotes: number
} | null

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
type UserEditForm = {
  nick: string
  formEffectOverride: FormEffectOverride
  customFormTitle: string
  adminNote: string
}

const FORM_EFFECT_OPTIONS: { value: FormEffectOverride; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'none', label: 'Brak efektu' },
  { value: 'hot', label: '🔥 Gorąca seria' },
  { value: 'sniper', label: '🎯 Snajper' },
  { value: 'cold', label: '❄️ Zimna seria' },
  { value: 'storm', label: '⛈️ Czarne chmury' },
  { value: 'curse', label: '🔮 Klątwa typera' },
  { value: 'wooden', label: '🪵 Drewniana forma' },
  { value: 'var', label: '👁️ VAR sprawdza typy' },
]

const FORM_DISPLAY_OPTIONS: { value: FormDisplayMode; label: string; desc: string }[] = [
  { value: 'off', label: 'OFF', desc: 'same dane i kropki' },
  { value: 'badge_only', label: 'BADGE_ONLY', desc: 'tylko główny status' },
  { value: 'badge_and_title', label: 'BADGE_AND_TITLE', desc: 'status i ręczny tytuł' },
  { value: 'full_effects', label: 'FULL_EFFECTS', desc: 'status, tytuł i efekty tła' },
]

const FORM_STYLE_OPTIONS: { value: FormStyleVariant; label: string; desc: string }[] = [
  { value: 'light', label: 'LIGHT', desc: 'czysto, lekko, elegancko' },
  { value: 'sport', label: 'SPORT', desc: 'turniejowo i dynamicznie' },
  { value: 'premium', label: 'PREMIUM', desc: 'ciemniej, głębiej, bardziej luksusowo' },
  { value: 'game', label: 'GAME', desc: 'rangi i osiągnięcia' },
  { value: 'strong', label: 'STRONG', desc: 'najmocniejsze motywy i tekstury' },
]

export function AdminPanel() {
  const { users, matches, currentUser, setUsers, updateUserStatus, updateMatchScore, updateMatchFull } = useAppStore()
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([])
  const [editingNickId, setEditingNickId] = useState<string|null>(null)
  const [editNickValue, setEditNickValue] = useState('')
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [userEditForm, setUserEditForm] = useState<UserEditForm>({
    nick: '',
    formEffectOverride: 'auto',
    customFormTitle: '',
    adminNote: '',
  })
  const [userEditStatus, setUserEditStatus] = useState('')
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
  const [formVisualSettings, setFormVisualSettings] = useState<FormVisualSettings>(DEFAULT_FORM_VISUAL_SETTINGS)
  const [formVisualStatus, setFormVisualStatus] = useState('')
  const [wc26LastSync, setWc26LastSync] = useState<WC26SyncLog | null>(null)
  const [wc26ActiveCount, setWc26ActiveCount] = useState(0)
  const [wc26Loading, setWc26Loading] = useState(false)
  const [wc26Msg, setWc26Msg] = useState('')
  const [championPicks, setChampionPicks] = useState<ChampionPick[]>([])
  const [championEnabled, setChampionEnabled] = useState(false)
  const [setWinnerCode, setSetWinnerCode] = useState('')
  const [championMsg, setChampionMsg] = useState('')
  const [modStatus, setModStatus] = useState<ModStatusData>(null)
  const [modActionStatus, setModActionStatus] = useState<Record<string, string>>({})
  const [duplicates, setDuplicates] = useState<DuplicatePair[] | null>(null)
  const [orphanedLegacy, setOrphanedLegacy] = useState<OrphanedMatch[]>([])
  const [allOrphanedSafe, setAllOrphanedSafe] = useState(false)
  const [dupAuditMsg, setDupAuditMsg] = useState('')
  const [dupAuditLoading, setDupAuditLoading] = useState(false)
  const [archiveMsg, setArchiveMsg] = useState<Record<string, string>>({})
  const [archiveOrphanedLoading, setArchiveOrphanedLoading] = useState(false)
  const [archiveOrphanedMsg, setArchiveOrphanedMsg] = useState('')
  const [showAllMatches, setShowAllMatches] = useState(false)

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

  const loadFormVisualSettings = () => {
    fetch('/api/admin/form-visual-settings')
      .then(r => r.json())
      .then(({ settings }: { settings?: FormVisualSettings }) => {
        if (settings) setFormVisualSettings(settings)
      })
      .catch(() => {})
  }

  const loadChampion = () => {
    if (!IS_PRODUCTION_MODE) return
    fetch('/api/admin/champion')
      .then(r => r.json())
      .then(({ picks, enabled }: { picks: ChampionPick[]; enabled: boolean }) => {
        setChampionPicks(picks ?? [])
        setChampionEnabled(enabled)
      })
      .catch(() => {})
  }

  const handleToggleChampion = async () => {
    if (!IS_PRODUCTION_MODE) return
    try {
      const res = await fetch('/api/admin/champion', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle' }),
      })
      const json = await res.json().catch(() => ({}))
      if (res.ok) setChampionEnabled(json.enabled)
    } catch { /* ignore */ }
  }

  const handleSetWinner = async () => {
    const code = setWinnerCode.trim().toUpperCase()
    if (!code) return
    setChampionMsg('Zapisywanie...')
    try {
      const res = await fetch('/api/admin/champion', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_winner', team_code: code }),
      })
      const json = await res.json().catch(() => ({}))
      if (res.ok) {
        setChampionMsg(`Zapisano. Nagrodzono ${json.winners} graczy.`)
        loadChampion()
      } else {
        setChampionMsg(json.error ?? 'Błąd zapisu')
      }
    } catch {
      setChampionMsg('Błąd sieci')
    }
  }

  const loadWC26Sync = () => {
    if (!IS_PRODUCTION_MODE) return
    fetch('/api/sync-wc26')
      .then(r => r.json())
      .then(({ last_sync, active_wc26_count }: { last_sync: WC26SyncLog | null; active_wc26_count?: number }) => {
        setWc26LastSync(last_sync ?? null)
        if (typeof active_wc26_count === 'number') setWc26ActiveCount(active_wc26_count)
      })
      .catch(() => {})
  }

  const loadModStatus = () => {
    if (!IS_PRODUCTION_MODE) return
    fetch('/api/match-of-day/current')
      .then(r => r.json())
      .then(data => setModStatus(data))
      .catch(() => {})
  }

  const handleAuditDuplicates = async () => {
    if (!IS_PRODUCTION_MODE) {
      setDupAuditMsg('[MOCK] Tryb lokalny — brak audytu')
      return
    }
    setDupAuditLoading(true)
    setDupAuditMsg('Szukam...')
    try {
      const res = await fetch('/api/admin/matches/audit-duplicates')
      const json = await res.json().catch(() => ({}))
      if (res.ok) {
        setDuplicates(json.duplicates ?? [])
        setOrphanedLegacy(json.orphanedLegacy ?? [])
        setAllOrphanedSafe(json.allOrphanedSafe ?? false)
        setDupAuditMsg(json.message ?? '')
      } else {
        setDupAuditMsg(`Błąd: ${json.error ?? 'Nieznany'}`)
      }
    } catch {
      setDupAuditMsg('Błąd sieci')
    } finally {
      setDupAuditLoading(false)
    }
  }

  const handleArchiveAllOrphaned = async () => {
    const safeOnes = orphanedLegacy.filter(
      m => m.predictionsCount === 0 && m.bonusPointsCount === 0 && m.modEventsCount === 0
    )
    if (!window.confirm(`Archiwizować ${safeOnes.length} ofb_* rekordów bez danych? Rekordy NIE zostaną usunięte.`)) return
    setArchiveOrphanedLoading(true)
    setArchiveOrphanedMsg('Archiwizuję...')
    let ok = 0
    for (const m of safeOnes) {
      try {
        const res = await fetch('/api/admin/matches/archive', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ match_id: m.id, archived: true }),
        })
        if (res.ok) ok++
      } catch { /* continue */ }
    }
    setArchiveOrphanedMsg(`Zarchiwizowano ${ok}/${safeOnes.length}.`)
    setArchiveOrphanedLoading(false)
    await handleAuditDuplicates()
  }

  const handleArchiveMatch = async (matchId: string, archived: boolean) => {
    if (!IS_PRODUCTION_MODE) return
    setArchiveMsg(s => ({ ...s, [matchId]: 'Zapisywanie...' }))
    try {
      const res = await fetch('/api/admin/matches/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ match_id: matchId, archived }),
      })
      const json = await res.json().catch(() => ({}))
      if (res.ok) {
        setArchiveMsg(s => ({ ...s, [matchId]: json.message ?? 'OK' }))
        // Re-run audit to refresh the list
        await handleAuditDuplicates()
      } else {
        setArchiveMsg(s => ({ ...s, [matchId]: `Błąd: ${json.error ?? 'Nieznany'}` }))
      }
    } catch {
      setArchiveMsg(s => ({ ...s, [matchId]: 'Błąd sieci' }))
    }
  }

  useEffect(() => {
    loadPendingUsers()
    loadFormVisualSettings()
    loadWC26Sync()
    loadChampion()
    loadModStatus()
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

  const handleModAction = async (endpoint: string) => {
    if (!IS_PRODUCTION_MODE) {
      setModActionStatus(s => ({ ...s, [endpoint]: '[MOCK] Brak efektu w trybie lokalnym' }))
      return
    }
    setModActionStatus(s => ({ ...s, [endpoint]: 'Ładowanie...' }))
    try {
      const res = await fetch(endpoint, { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      const msg = res.ok ? `OK: ${json.message ?? 'Sukces'}` : `Błąd: ${json.error ?? 'Nieznany'}`
      setModActionStatus(s => ({ ...s, [endpoint]: msg }))
      loadModStatus()
    } catch {
      setModActionStatus(s => ({ ...s, [endpoint]: 'Błąd sieci' }))
    }
  }

  const handleModReroll = async () => {
    const deadlinePassed = modStatus?.event ? new Date(modStatus.event.vote_deadline) <= new Date() : false
    const confirmMsg = deadlinePassed
      ? 'UWAGA: Deadline już minął — głosowanie zamknięte.\nWymusić ponowne losowanie? Głosy zostaną usunięte.'
      : 'Na pewno wymusić ponowne losowanie? Głosy zostaną usunięte.'
    if (!window.confirm(confirmMsg)) return
    await handleModAction('/api/match-of-day/reroll')
  }

  const handleModDelete = async () => {
    if (!window.confirm('Na pewno usunąć aktualny mecz dnia i jego głosy?')) return
    await handleModAction('/api/match-of-day/delete-current')
  }

  const handleModDeleteAndReroll = async () => {
    if (!window.confirm('Na pewno usunąć aktualny mecz dnia, wyczyścić głosy i wylosować nowy?')) return
    if (!IS_PRODUCTION_MODE) {
      setModActionStatus(s => ({ ...s, 'delete-and-reroll': '[MOCK] Brak efektu w trybie lokalnym' }))
      return
    }
    setModActionStatus(s => ({ ...s, 'delete-and-reroll': 'Ładowanie...' }))
    try {
      const delRes = await fetch('/api/match-of-day/delete-current', { method: 'POST' })
      const delJson = await delRes.json().catch(() => ({}))
      if (!delRes.ok && delRes.status !== 404) {
        setModActionStatus(s => ({ ...s, 'delete-and-reroll': `Błąd usuwania: ${delJson.error ?? 'Nieznany'}` }))
        return
      }
      const wasSettled = delJson.wasSettled ?? false
      const refreshRes = await fetch('/api/match-of-day/daily-refresh', { method: 'POST' })
      const refreshJson = await refreshRes.json().catch(() => ({}))
      const msg = refreshRes.ok
        ? `OK: ${refreshJson.message ?? 'Sukces'}${wasSettled ? ' ⚠️ Poprzedni był rozliczony — Przelicz punkty!' : ''}`
        : `Usunięto, błąd tworzenia nowego: ${refreshJson.error ?? 'Nieznany'}`
      setModActionStatus(s => ({ ...s, 'delete-and-reroll': msg }))
      loadModStatus()
    } catch {
      setModActionStatus(s => ({ ...s, 'delete-and-reroll': 'Błąd sieci' }))
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

  const handleSaveFormVisualSettings = async () => {
    setFormVisualStatus('Zapisywanie...')
    try {
      const res = await fetch('/api/admin/form-visual-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formVisualSettings),
      })
      const json = await res.json().catch(() => ({}))
      if (res.ok) {
        setFormVisualSettings(json.settings ?? formVisualSettings)
        setFormVisualStatus('Zapisano ✓')
      } else {
        setFormVisualStatus(json.error ?? 'Błąd zapisu')
      }
    } catch {
      setFormVisualStatus('Błąd sieci')
    }
  }

  const openUserEditor = (user: User) => {
    setEditingUser(user)
    setUserEditForm({
      nick: user.nick,
      formEffectOverride: user.form_effect_override ?? 'auto',
      customFormTitle: user.custom_form_title ?? '',
      adminNote: user.admin_note ?? '',
    })
    setUserEditStatus('')
    setEditingNickId(null)
  }

  const closeUserEditor = () => {
    setEditingUser(null)
    setUserEditForm({ nick: '', formEffectOverride: 'auto', customFormTitle: '', adminNote: '' })
    setUserEditStatus('')
  }

  const handleSaveUserProfile = async () => {
    if (!editingUser) return
    const nick = userEditForm.nick.trim()
    if (!nick) {
      setUserEditStatus('Nick nie może być pusty.')
      return
    }

    setUserEditStatus('Zapisywanie...')
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingUser.id,
          nick,
          form_effect_override: userEditForm.formEffectOverride,
          custom_form_title: userEditForm.customFormTitle,
          admin_note: userEditForm.adminNote,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setUserEditStatus(json.error ?? 'Błąd zapisu')
        return
      }
      setUsers(users.map(u => u.id === editingUser.id ? {
        ...u,
        nick,
        form_effect_override: userEditForm.formEffectOverride,
        custom_form_title: userEditForm.customFormTitle.trim() || null,
        admin_note: userEditForm.adminNote.trim() || null,
      } : u))
      closeUserEditor()
    } catch {
      setUserEditStatus('Błąd sieci')
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
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-white font-bold text-lg">Wygląd formy graczy</h2>
            <p className="text-gray-600 text-xs mt-0.5">Globalne ustawienia badge, tytułów i efektów w tabeli typerów.</p>
          </div>
          <Button size="sm" onClick={handleSaveFormVisualSettings} disabled={formVisualStatus === 'Zapisywanie...'}>
            Zapisz
          </Button>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-400">Tryb wyświetlania</span>
            <select
              value={formVisualSettings.display_mode}
              onChange={e => setFormVisualSettings(s => ({ ...s, display_mode: e.target.value as FormDisplayMode }))}
              className="h-9 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 text-sm text-white outline-none focus:border-emerald-500"
            >
              {FORM_DISPLAY_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label} - {option.desc}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-400">Wariant stylu</span>
            <select
              value={formVisualSettings.style_variant}
              onChange={e => setFormVisualSettings(s => ({ ...s, style_variant: e.target.value as FormStyleVariant }))}
              className="h-9 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 text-sm text-white outline-none focus:border-emerald-500"
            >
              {FORM_STYLE_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label} - {option.desc}</option>
              ))}
            </select>
          </label>
        </div>

        <div className={`form-admin-preview form-style-${formVisualSettings.style_variant}`}>
          <div className={`form-admin-preview-row ${formVisualSettings.display_mode === 'full_effects' ? 'form-effect-hot' : ''}`}>
            {formVisualSettings.display_mode !== 'off' && (
              <span className="form-rank form-rank-hot"><span className="form-rank-icon">🔥</span><span className="form-rank-label">Gorąca seria</span></span>
            )}
            {formVisualSettings.display_mode !== 'badge_only' && formVisualSettings.display_mode !== 'off' && (
              <span className="form-custom-title">Profesor Typów</span>
            )}
            {formVisualSettings.display_mode === 'off' && (
              <span className="text-xs font-semibold text-gray-500">Bez odznak, tytułów i efektów</span>
            )}
            <span className="ml-auto text-xs text-gray-400">{formVisualSettings.display_mode}</span>
          </div>
        </div>

        {formVisualStatus && <p className="mt-2 text-xs text-gray-500">{formVisualStatus}</p>}
      </Card>

      <Card>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-white font-bold text-lg">Synchronizacja worldcup26.ir</h2>
            <p className="text-gray-600 text-xs mt-0.5">Mecze, wyniki, tabele grupowe (primary source)</p>
          </div>
          {IS_PRODUCTION_MODE && (
            <div className="text-right shrink-0 ml-4">
              <p className="text-emerald-400 font-bold text-sm">{wc26ActiveCount} meczów</p>
              <p className="text-gray-600 text-xs">aktywnych w bazie</p>
              {wc26LastSync && (
                <p className={`text-xs mt-0.5 ${wc26LastSync.status === 'success' ? 'text-gray-600' : 'text-red-400'}`}>
                  sync {new Date(wc26LastSync.created_at).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw' })}
                  {wc26LastSync.status === 'success' ? ` · ${wc26LastSync.records_updated} zaktualizowanych` : ' ⚠️'}
                </p>
              )}
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
        <h2 className="text-white font-bold text-lg mb-1">🔍 Naprawa danych — duplikaty meczów</h2>
        <p className="text-gray-600 text-xs mb-3">
          Wykrywa mecze z dwoma rekordami: stary (ręczny/ofb_*) + nowy z API worldcup26.ir.
          Przed archiwizacją uruchom migrację SQL 004 w Supabase — przeniesie typowania i usunie stare.
        </p>
        <div className="flex items-center gap-3 flex-wrap mb-3">
          <Button variant="secondary" onClick={handleAuditDuplicates} disabled={dupAuditLoading}>
            {dupAuditLoading ? 'Szukam...' : '🔍 Audyt duplikatów'}
          </Button>
          {dupAuditMsg && (
            <p className={`text-xs ${dupAuditMsg.startsWith('Brak') ? 'text-emerald-400' : dupAuditMsg.startsWith('Znaleziono') ? 'text-amber-400' : 'text-gray-400'}`}>
              {dupAuditMsg}
            </p>
          )}
        </div>
        {duplicates !== null && duplicates.length > 0 && (
          <div className="space-y-3">
            {duplicates.map(dup => (
              <div key={dup.legacyId} className="bg-gray-800/50 rounded-lg p-3 text-xs space-y-1">
                <p className="text-white font-medium">{dup.legacyTeamA} vs {dup.legacyTeamB}</p>
                <p className="text-red-400">Stary: {dup.legacyExt ?? 'brak external_id'} · {dup.legacyDay} · gr.{dup.legacyGroup} kol.{dup.legacyRound}</p>
                <p className="text-emerald-400">Nowy: {dup.canonicalExt} · {dup.canonicalDay}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Button size="sm" variant="danger"
                    onClick={() => handleArchiveMatch(dup.legacyId, true)}
                    disabled={archiveMsg[dup.legacyId] === 'Zapisywanie...'}>
                    🗑️ Archiwizuj stary
                  </Button>
                  {archiveMsg[dup.legacyId] && (
                    <span className="text-gray-400 text-xs">{archiveMsg[dup.legacyId]}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {duplicates !== null && duplicates.length === 0 && orphanedLegacy.length === 0 && (
          <p className="text-emerald-400 text-xs">Brak duplikatów — dane są czyste.</p>
        )}

        {orphanedLegacy.length > 0 && (
          <div className="mt-4 pt-3 border-t border-gray-700">
            <p className="text-amber-400 text-xs font-medium uppercase tracking-wide mb-2">
              Aktywne ofb_* bez pary canonical ({orphanedLegacy.length})
            </p>
            <div className="space-y-2 mb-3">
              {orphanedLegacy.map(m => (
                <div key={m.id} className="bg-gray-800/50 rounded-lg p-2.5 text-xs space-y-0.5">
                  <p className="text-white font-medium">{m.teamA} vs {m.teamB}</p>
                  <p className="text-gray-400">{m.externalId ?? 'brak external_id'} · {new Date(m.matchDate).toLocaleDateString('pl-PL')}</p>
                  <div className="flex gap-3 mt-1">
                    <span className={m.predictionsCount > 0 ? 'text-red-400' : 'text-gray-500'}>typy: {m.predictionsCount}</span>
                    <span className={m.bonusPointsCount > 0 ? 'text-red-400' : 'text-gray-500'}>bonusy: {m.bonusPointsCount}</span>
                    <span className={m.modEventsCount > 0 ? 'text-red-400' : 'text-gray-500'}>MOD: {m.modEventsCount}</span>
                  </div>
                </div>
              ))}
            </div>
            {allOrphanedSafe ? (
              <div>
                <Button variant="danger" className="w-full"
                  onClick={handleArchiveAllOrphaned}
                  disabled={archiveOrphanedLoading}>
                  🗑️ Archiwizuj wszystkie ofb_* bez danych ({orphanedLegacy.length})
                </Button>
                {archiveOrphanedMsg && (
                  <p className="text-xs text-gray-400 mt-1">{archiveOrphanedMsg}</p>
                )}
              </div>
            ) : (
              <p className="text-red-400 text-xs">
                ⚠️ Część rekordów ma powiązane dane (typy/bonusy/MOD) — nie można automatycznie archiwizować. Sprawdź ręcznie.
              </p>
            )}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="text-white font-bold text-lg mb-3">🔥 Mecz dnia</h2>

        {!IS_PRODUCTION_MODE ? (
          <p className="text-gray-600 text-xs mb-3">Tryb lokalny — mecz dnia dostępny tylko w produkcji.</p>
        ) : modStatus?.event ? (
          <div className="bg-gray-800/50 rounded-lg p-3 mb-4 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Dzień:</span>
              <span className="text-white font-medium">{modStatus.event.official_match_day}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-gray-400 shrink-0">Mecz:</span>
              <span className="text-white font-medium text-right">
                {modStatus.event.match ? `${modStatus.event.match.team_a} vs ${modStatus.event.match.team_b}` : '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Deadline:</span>
              <span className="text-white font-medium">
                {formatMatchDate(modStatus.event.vote_deadline)} {formatMatchTime(modStatus.event.vote_deadline)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Status:</span>
              <span className={
                modStatus.event.status === 'settled' ? 'text-emerald-400 font-bold' :
                modStatus.event.status === 'voting' ? 'text-amber-400 font-bold' : 'text-gray-400'
              }>{modStatus.event.status}</span>
            </div>
            {modStatus.event.selected_bonus_points !== null && (
              <div className="flex justify-between">
                <span className="text-gray-400">Wybrany bonus:</span>
                <span className="text-amber-400 font-bold">+{modStatus.event.selected_bonus_points} pkt</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-400">Głosów łącznie:</span>
              <span className="text-white">{modStatus.totalVotes}</span>
            </div>
            <div className="mt-1 space-y-0.5 pl-1">
              {([4, 3, 2, 1] as const).map(pts => (
                <div key={pts} className="flex justify-between text-xs">
                  <span className="text-amber-400">+{pts} pkt</span>
                  <span className="text-gray-300">{modStatus.voteCounts?.[pts] ?? 0} głosów</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-gray-500 text-sm mb-3">Brak aktywnego meczu dnia.</p>
        )}

        <div className="space-y-2">
          <div>
            <Button variant="secondary" className="w-full"
              onClick={() => handleModAction('/api/match-of-day/daily-refresh')}
              disabled={modActionStatus['/api/match-of-day/daily-refresh'] === 'Ładowanie...'}>
              ⚽ Odśwież mecze i wybierz mecz dnia
            </Button>
            {modActionStatus['/api/match-of-day/daily-refresh'] && (
              <p className="text-xs text-gray-500 mt-1 break-words">{modActionStatus['/api/match-of-day/daily-refresh']}</p>
            )}
          </div>

          <div>
            <Button variant="secondary" className="w-full"
              onClick={() => handleModAction('/api/match-of-day/finalize')}
              disabled={modActionStatus['/api/match-of-day/finalize'] === 'Ładowanie...'}>
              🔒 Finalizuj głosowanie meczu dnia
            </Button>
            {modActionStatus['/api/match-of-day/finalize'] && (
              <p className="text-xs text-gray-500 mt-1 break-words">{modActionStatus['/api/match-of-day/finalize']}</p>
            )}
          </div>

          <div>
            <Button variant="danger" className="w-full"
              onClick={handleModReroll}
              disabled={modActionStatus['/api/match-of-day/reroll'] === 'Ładowanie...'}>
              ⚠️ Wymuś ponowne losowanie (usuwa głosy)
            </Button>
            <p className="text-xs text-gray-600 mt-1">Działa też po deadline. Czyści głosy i resetuje bonus.</p>
            {modActionStatus['/api/match-of-day/reroll'] && (
              <p className="text-xs text-gray-500 mt-1 break-words">{modActionStatus['/api/match-of-day/reroll']}</p>
            )}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-gray-700 space-y-2">
          <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">Awaryjne usuwanie</p>

          <div>
            <Button variant="secondary" className="w-full"
              onClick={handleModDeleteAndReroll}
              disabled={modActionStatus['delete-and-reroll'] === 'Ładowanie...'}>
              🔄 Usuń i wylosuj nowy mecz dnia
            </Button>
            {modActionStatus['delete-and-reroll'] && (
              <p className={`text-xs mt-1 break-words ${modActionStatus['delete-and-reroll'].includes('⚠️') ? 'text-amber-400' : 'text-gray-500'}`}>
                {modActionStatus['delete-and-reroll']}
              </p>
            )}
          </div>

          <div>
            <Button variant="danger" className="w-full"
              onClick={handleModDelete}
              disabled={modActionStatus['/api/match-of-day/delete-current'] === 'Ładowanie...'}>
              🗑️ Usuń aktualny mecz dnia
            </Button>
            {modActionStatus['/api/match-of-day/delete-current'] && (
              <p className={`text-xs mt-1 break-words ${modActionStatus['/api/match-of-day/delete-current'].includes('⚠️') ? 'text-amber-400' : 'text-gray-500'}`}>
                {modActionStatus['/api/match-of-day/delete-current']}
              </p>
            )}
          </div>
        </div>
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
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-white font-bold text-lg">Wszystkie mecze</h2>
          <button
            onClick={() => setShowAllMatches(v => !v)}
            className="text-xs text-gray-500 hover:text-gray-300 underline"
          >
            {showAllMatches ? 'Ukryj' : 'Pokaż'}
          </button>
        </div>
        <p className="text-gray-600 text-xs mb-4">{matches.length} aktywnych meczów (zarchiwizowane ukryte — patrz Audyt duplikatów)</p>
        {showAllMatches && (
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
        )}
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-white font-bold text-lg">Typowanie zwycięzcy turnieju</h2>
            <p className="text-gray-600 text-xs mt-0.5">Zarządzanie typowaniem mistrza</p>
          </div>
          <Button
            size="sm"
            variant={championEnabled ? 'danger' : 'secondary'}
            onClick={handleToggleChampion}
          >
            {championEnabled ? 'Zablokuj' : 'Odblokuj'}
          </Button>
        </div>

        {championPicks.length > 0 && (
          <div className="mb-4">
            <p className="text-gray-500 text-xs mb-2">Typy graczy ({championPicks.length})</p>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {championPicks.map(p => (
                <div key={p.id} className="flex items-center justify-between py-1.5 px-2 rounded bg-gray-800/50">
                  <span className="text-white text-sm">{p.nick}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 text-xs font-mono">{p.team_code}</span>
                    <span className="text-gray-500 text-xs truncate max-w-24">{p.team_name}</span>
                    {p.is_correct === true && <span className="text-emerald-400 text-xs">✓</span>}
                    {p.is_correct === false && <span className="text-red-500 text-xs">✗</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="pt-3 border-t border-gray-800">
          <p className="text-gray-500 text-xs mb-2">Ustaw rzeczywistego mistrza (kod FIFA, np. BRA)</p>
          <div className="flex items-center gap-2">
            <input
              value={setWinnerCode}
              onChange={e => setSetWinnerCode(e.target.value.toUpperCase())}
              placeholder="BRA"
              maxLength={3}
              className="w-20 h-8 text-center bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-emerald-500 font-mono uppercase"
            />
            <Button size="sm" onClick={handleSetWinner} disabled={!setWinnerCode.trim()}>
              Zatwierdź i przyznaj punkty
            </Button>
          </div>
          {championMsg && (
            <p className={`text-xs mt-2 ${championMsg.startsWith('Zapisano') ? 'text-emerald-400' : 'text-red-400'}`}>
              {championMsg}
            </p>
          )}
          {!IS_PRODUCTION_MODE && (
            <p className="text-gray-600 text-xs mt-2">Tryb lokalny — brak efektu.</p>
          )}
        </div>
      </Card>

      <Card>
        <h2 className="text-white font-bold text-lg mb-2">Wszyscy gracze</h2>
        <div className="overflow-hidden rounded-lg border border-gray-800">
          {users.map(user => (
            <div key={user.id} className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-gray-800 px-3 py-2.5 last:border-0 sm:grid-cols-[minmax(0,1fr)_auto]">
              <div className="min-w-0">
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
                <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                  <span>{user.form_effect_override === 'auto' ? 'Efekt: auto' : `Efekt: ${user.form_effect_override}`}</span>
                  {user.custom_form_title && <span className="truncate">• {user.custom_form_title}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-emerald-400 font-bold text-sm">{user.total_points} pkt</span>
                <Button size="sm" variant="secondary" onClick={() => openUserEditor(user)}>Edytuj</Button>
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

      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center">
          <div className="w-full max-w-lg rounded-xl border border-gray-800 bg-gray-950 p-4 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-white">Edycja gracza</h3>
                <p className="text-xs text-gray-500">Tylko profil i status formy. Punkty oraz typy nie są edytowane.</p>
              </div>
              <Button size="sm" variant="ghost" onClick={closeUserEditor}>✕</Button>
            </div>

            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-400">Nick</span>
                <input
                  value={userEditForm.nick}
                  onChange={e => setUserEditForm(f => ({ ...f, nick: e.target.value }))}
                  className="h-9 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 text-sm text-white outline-none focus:border-emerald-500"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-400">Ręczny tytuł gracza</span>
                <input
                  value={userEditForm.customFormTitle}
                  onChange={e => setUserEditForm(f => ({ ...f, customFormTitle: e.target.value }))}
                  placeholder="np. Król VAR-u"
                  className="h-9 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 text-sm text-white outline-none focus:border-emerald-500"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-400">Efekt/status formy</span>
                <select
                  value={userEditForm.formEffectOverride}
                  onChange={e => setUserEditForm(f => ({ ...f, formEffectOverride: e.target.value as FormEffectOverride }))}
                  className="h-9 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 text-sm text-white outline-none focus:border-emerald-500"
                >
                  {FORM_EFFECT_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-400">Notatka admina</span>
                <textarea
                  value={userEditForm.adminNote}
                  onChange={e => setUserEditForm(f => ({ ...f, adminNote: e.target.value }))}
                  rows={3}
                  placeholder="Widoczne tylko w panelu admina"
                  className="w-full resize-none rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
                />
              </label>
            </div>

            {userEditStatus && <p className="mt-3 text-xs text-gray-400">{userEditStatus}</p>}

            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={closeUserEditor}>Anuluj</Button>
              <Button onClick={handleSaveUserProfile} disabled={userEditStatus === 'Zapisywanie...'}>Zapisz zmiany</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
