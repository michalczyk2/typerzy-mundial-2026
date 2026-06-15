'use client'
import { useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { IS_PRODUCTION_MODE } from '@/lib/tournament-config'
import { createBrowserClient } from '@supabase/ssr'
import type { User } from '@/types'

export function Providers({ children }: { children: React.ReactNode }) {
  const { setCurrentUser, setUsers, setMatches, setPredictions, setStandings, setBonusPoints, setLastPredictions, users } = useAppStore()

  useEffect(() => {
    if (!IS_PRODUCTION_MODE) {
      // Mock mode: restore session from localStorage
      const savedId = localStorage.getItem('typerzy_uid')
      const user = savedId ? users.find(u => u.id === savedId) : null
      if (user && user.status !== 'blocked') {
        setCurrentUser(user)
      } else {
        setCurrentUser(null)
      }
      return
    }

    // Production mode: restore session + load all data from Supabase
    const init = async () => {
      // 1. Restore session via httpOnly cookie
      let user: User | null = null
      const meRes = await fetch('/api/auth/me')
      if (meRes.ok) {
        const data = await meRes.json()
        user = data.user
        setCurrentUser(user)

        // 2. If admin, load all users (including pending/blocked)
        if (user?.role === 'admin') {
          const usersRes = await fetch('/api/admin/users')
          if (usersRes.ok) {
            const { users: allUsers } = await usersRes.json()
            setUsers(allUsers)
          }
        }

        // 3. Load user's predictions
        const predsRes = await fetch('/api/data/predictions')
        if (predsRes.ok) {
          const { predictions } = await predsRes.json()
          setPredictions(predictions)
        }
      } else {
        setCurrentUser(null)
      }

      // 4. Load public data from Supabase anon client
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      const db = createBrowserClient(supabaseUrl, supabaseAnonKey)

      const [matchesRes, standingsRes, profilesRes, bonusRes, lastPredsRes] = await Promise.all([
        db.from('matches').select('*').order('match_date', { ascending: true }),
        db.from('standings').select('*').order('position', { ascending: true }),
        db.from('profiles').select('id, nick, role, status, total_points, match_points, bonus_points_total, predictions_count, correct_outcomes, correct_scores, current_streak, best_streak, tournament_winner_pick, form_effect_override, custom_form_title, created_at').eq('status', 'active').neq('role', 'admin'),
        db.from('bonus_points').select('*'),
        fetch('/api/data/last-predictions'),
      ])

      // Filter archived matches for regular users — is_archived may be undefined before migration 004 runs
      if (matchesRes.data) setMatches(matchesRes.data.filter(m => m.is_archived !== true))
      // DB column is team_name, TypeScript Standing type uses team — map here
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (standingsRes.data) setStandings(standingsRes.data.map((row: any) => ({ ...row, team: row.team_name ?? '' })))
      // Admin already has full user list (including pending) from /api/admin/users above.
      // Overwriting with public anon data (status='active' only) would hide pending users.
      if (profilesRes.data && user?.role !== 'admin') {
        setUsers(profilesRes.data.map(row => ({
          id: row.id,
          nick: row.nick,
          role: row.role,
          status: row.status,
          total_points: row.total_points ?? 0,
          match_points: row.match_points ?? 0,
          bonus_points: row.bonus_points_total ?? 0,
          predictions_count: row.predictions_count ?? 0,
          correct_outcomes: row.correct_outcomes ?? 0,
          correct_scores: row.correct_scores ?? 0,
          current_streak: row.current_streak ?? 0,
          best_streak: row.best_streak ?? 0,
          tournament_winner_pick: row.tournament_winner_pick ?? null,
          form_effect_override: row.form_effect_override ?? 'auto',
          custom_form_title: row.custom_form_title ?? null,
          created_at: row.created_at,
        })))
      }
      if (bonusRes.data) setBonusPoints(bonusRes.data)
      if (lastPredsRes.ok) {
        const lpJson = await lastPredsRes.json()
        if (lpJson.last_predictions) setLastPredictions(lpJson.last_predictions)
      }
    }

    init().catch(err => {
      console.error('[Providers init]', err)
      // If init threw before resolving auth (e.g. network error on /api/auth/me),
      // currentUser is still undefined — set to null so layout redirects to login.
      if (useAppStore.getState().currentUser === undefined) setCurrentUser(null)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <>{children}</>
}
