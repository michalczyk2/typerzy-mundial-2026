import { create } from 'zustand'
import { toast } from 'sonner'
import type { User, Match, Prediction, Standing, BonusPoint, LastPrediction, PredictionResult } from '@/types'
import { MOCK_USERS, MOCK_MATCHES, MOCK_PREDICTIONS, MOCK_STANDINGS, MOCK_BONUS_POINTS } from '@/lib/mock-data'
import { IS_PRODUCTION_MODE } from '@/lib/tournament-config'

type LoginResult = 'ok' | 'pending' | 'blocked' | 'wrong_code' | 'not_found'

function computeMockLastPredictions(preds: Prediction[]): Record<string, LastPrediction[]> {
  const byUser: Record<string, LastPrediction[]> = {}
  for (const p of preds.filter(p => p.is_locked)) {
    if (!byUser[p.user_id]) byUser[p.user_id] = []
    byUser[p.user_id].push({ is_correct_score: p.is_correct_score, is_correct_outcome: p.is_correct_outcome, points_earned: p.points_earned })
  }
  for (const uid in byUser) byUser[uid] = byUser[uid].slice(-5)
  return byUser
}

interface AppState {
  currentUser: User | null | undefined
  users: User[]
  matches: Match[]
  predictions: Prediction[]
  standings: Standing[]
  bonusPoints: BonusPoint[]
  lastPredictions: Record<string, LastPrediction[]>
  setCurrentUser: (user: User | null) => void
  setUsers: (users: User[]) => void
  setMatches: (matches: Match[]) => void
  setPredictions: (predictions: Prediction[]) => void
  setStandings: (standings: Standing[]) => void
  setBonusPoints: (bonusPoints: BonusPoint[]) => void
  setLastPredictions: (data: Record<string, LastPrediction[]>) => void
  // Sync login for mock mode
  login: (nick: string, code: string) => LoginResult
  // Async login for production mode (calls /api/auth/login)
  loginAsync: (nick: string, code: string) => Promise<LoginResult>
  logout: () => void
  addPrediction: (matchId: string, predictedA: number, predictedB: number, predictedResult?: PredictionResult, predictedWinner?: string | null) => void
  updatePrediction: (id: string, a: number, b: number, predictedResult?: PredictionResult, predictedWinner?: string | null) => void
  updateUserStatus: (id: string, status: User['status']) => void
  updateMatchScore: (id: string, scoreA: number, scoreB: number) => void
  updateMatchFull: (id: string, data: Partial<Match>) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  currentUser: undefined,
  users: IS_PRODUCTION_MODE ? [] : MOCK_USERS,
  matches: IS_PRODUCTION_MODE ? [] : MOCK_MATCHES,
  predictions: IS_PRODUCTION_MODE ? [] : MOCK_PREDICTIONS,
  standings: IS_PRODUCTION_MODE ? [] : MOCK_STANDINGS,
  bonusPoints: IS_PRODUCTION_MODE ? [] : MOCK_BONUS_POINTS,
  lastPredictions: IS_PRODUCTION_MODE ? {} : computeMockLastPredictions(MOCK_PREDICTIONS),

  setCurrentUser: (user) => set({ currentUser: user }),
  setUsers: (users) => set({ users }),
  setMatches: (matches) => set({ matches }),
  setPredictions: (predictions) => set({ predictions }),
  setStandings: (standings) => set({ standings }),
  setBonusPoints: (bonusPoints) => set({ bonusPoints }),
  setLastPredictions: (lastPredictions) => set({ lastPredictions }),

  login: (nick, code) => {
    if (code !== 'TYPERZY2026') return 'wrong_code'
    const user = get().users.find(u => u.nick.toLowerCase() === nick.toLowerCase())
    if (!user) return 'not_found'
    if (user.status === 'blocked') return 'blocked'
    if (user.status === 'pending') return 'pending'
    set({ currentUser: user })
    if (typeof window !== 'undefined') localStorage.setItem('typerzy_uid', user.id)
    return 'ok'
  },

  loginAsync: async (nick, code) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nick, code }),
      })
      const json = await res.json()
      const result: LoginResult = json.result
      if ((result === 'ok' || result === 'pending') && json.user) {
        set({ currentUser: json.user })
      }
      return result
    } catch {
      return 'wrong_code'
    }
  },

  logout: async () => {
    set({ currentUser: null })
    if (typeof window !== 'undefined') localStorage.removeItem('typerzy_uid')
    if (IS_PRODUCTION_MODE) {
      await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    }
  },

  addPrediction: (matchId, predictedA, predictedB, predictedResult, predictedWinner) => {
    const user = get().currentUser
    if (!user) return
    const predicted_result: PredictionResult = predictedResult ?? (predictedA > predictedB ? 'home' : predictedA < predictedB ? 'away' : 'draw')
    const pred: Prediction = {
      id: `p_${Date.now()}`,
      user_id: user.id,
      match_id: matchId,
      predicted_a: predictedA,
      predicted_b: predictedB,
      predicted_result,
      points_earned: 0,
      is_correct_outcome: false,
      is_correct_score: false,
      is_locked: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    set(s => ({ predictions: [...s.predictions, pred] }))
    if (IS_PRODUCTION_MODE) {
      const payload = { match_id: matchId, predicted_a: predictedA, predicted_b: predictedB, predicted_result, predicted_winner: predictedWinner ?? null }
      console.log('MATCH OF DAY ID', matchId)
      console.log('PAYLOAD', payload)
      console.log('USER', user.id)
      fetch('/api/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(res => {
        if (!res.ok) {
          res.json().then(body => console.error('addPrediction API error', res.status, body)).catch(() => {})
          toast.error('Nie udało się zapisać typu. Spróbuj ponownie.')
        }
      }).catch(() => toast.error('Błąd sieci — typ może nie być zapisany.'))
    }
  },

  updatePrediction: (id, a, b, predictedResult, predictedWinner) => {
    const pred = get().predictions.find(p => p.id === id)
    const predicted_result: PredictionResult = predictedResult ?? (a > b ? 'home' : a < b ? 'away' : 'draw')
    console.log('MATCH OF DAY ID', pred?.match_id)
    console.log('PAYLOAD', { match_id: pred?.match_id, a, b, predictedResult })
    console.log('USER', get().currentUser?.id)
    set(s => ({
      predictions: s.predictions.map(p => p.id === id ? {
        ...p, predicted_a: a, predicted_b: b, predicted_result,
        updated_at: new Date().toISOString()
      } : p)
    }))
    if (IS_PRODUCTION_MODE && pred) {
      fetch('/api/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ match_id: pred.match_id, predicted_a: a, predicted_b: b, predicted_result, predicted_winner: predictedWinner ?? null }),
      }).then(res => {
        if (!res.ok) {
          res.json().then(body => console.error('updatePrediction API error', res.status, body)).catch(() => {})
          toast.error('Nie udało się zaktualizować typu. Spróbuj ponownie.')
        }
      }).catch(() => toast.error('Błąd sieci — typ może nie być zapisany.'))
    }
  },

  updateUserStatus: (id, status) => {
    set(s => ({ users: s.users.map(u => u.id === id ? { ...u, status } : u) }))
    if (IS_PRODUCTION_MODE) {
      fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      }).then(res => {
        if (!res.ok) toast.error('Nie udało się zmienić statusu gracza.')
      }).catch(() => toast.error('Błąd sieci — zmiana statusu może nie być zapisana.'))
    }
  },

  updateMatchScore: (id, scoreA, scoreB) => {
    set(s => ({
      matches: s.matches.map(m => m.id === id
        ? { ...m, score_a: scoreA, score_b: scoreB, status: 'finished', data_source: 'manual' as const }
        : m)
    }))
    if (IS_PRODUCTION_MODE) {
      fetch('/api/admin/matches', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, score_a: scoreA, score_b: scoreB, status: 'finished' }),
      }).then(res => {
        if (!res.ok) toast.error('Nie udało się zapisać wyniku meczu.')
      }).catch(() => toast.error('Błąd sieci — wynik może nie być zapisany.'))
    }
  },

  updateMatchFull: (id, data) => {
    set(s => ({ matches: s.matches.map(m => m.id === id ? { ...m, ...data } : m) }))
    if (IS_PRODUCTION_MODE) {
      fetch('/api/admin/matches', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...data }),
      }).then(res => {
        if (!res.ok) toast.error('Nie udało się zaktualizować meczu.')
      }).catch(() => toast.error('Błąd sieci — zmiany meczu mogą nie być zapisane.'))
    }
  },
}))
