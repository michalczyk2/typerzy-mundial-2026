import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { User } from '@/types'

function mapDbToUser(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    nick: row.nick as string,
    role: row.role as User['role'],
    status: row.status as User['status'],
    total_points: (row.total_points as number) ?? 0,
    match_points: (row.match_points as number) ?? 0,
    bonus_points: (row.bonus_points_total as number) ?? 0,
    predictions_count: (row.predictions_count as number) ?? 0,
    correct_outcomes: (row.correct_outcomes as number) ?? 0,
    correct_scores: (row.correct_scores as number) ?? 0,
    current_streak: (row.current_streak as number) ?? 0,
    best_streak: (row.best_streak as number) ?? 0,
    tournament_winner_pick: (row.tournament_winner_pick as string | null) ?? null,
    created_at: row.created_at as string,
  }
}

function setSessionCookie(res: NextResponse, profileId: string) {
  res.cookies.set('typerzy_session', profileId, {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
    secure: process.env.NODE_ENV === 'production',
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const nick = (body.nick ?? '').trim()
    const code = (body.code ?? '').trim().toUpperCase()

    if (!nick || !code) {
      return NextResponse.json({ result: 'wrong_code' }, { status: 400 })
    }

    const db = createAdminClient()

    // Validate access code
    const { data: codeRow, error: codeErr } = await db
      .from('access_codes')
      .select('id')
      .eq('code', code)
      .eq('is_active', true)
      .single()

    if (codeErr || !codeRow) {
      console.error('[auth/login] code lookup failed', { code, error: codeErr?.message })
      return NextResponse.json({ result: 'wrong_code' }, { status: 401 })
    }

    // Find existing profile (case-insensitive nick match)
    const { data: existing } = await db
      .from('profiles')
      .select('*')
      .ilike('nick', nick)
      .single()

    let profile: Record<string, unknown>

    if (existing) {
      if (existing.status === 'blocked') {
        return NextResponse.json({ result: 'blocked' }, { status: 403 })
      }
      await db.from('profiles').update({ last_login_at: new Date().toISOString() }).eq('id', existing.id)
      profile = existing
    } else {
      // Block reserved nicks from registering as regular users
      const RESERVED_NICKS = ['admin', 'administrator', 'root', 'system']
      if (RESERVED_NICKS.includes(nick.toLowerCase())) {
        return NextResponse.json({ result: 'wrong_code' }, { status: 403 })
      }

      // New user — create as pending, admin must approve
      const { data: created, error: createErr } = await db
        .from('profiles')
        .insert({ nick, role: 'user', status: 'pending', last_login_at: new Date().toISOString() })
        .select('*')
        .single()
      if (createErr || !created) {
        console.error('[auth/login] profile create failed', createErr?.message)
        return NextResponse.json({ result: 'wrong_code', error: createErr?.message }, { status: 500 })
      }
      profile = created
    }

    const user = mapDbToUser(profile)

    if (profile.status === 'pending') {
      // Set cookie so pending screen persists on refresh
      const res = NextResponse.json({ result: 'pending', user })
      setSessionCookie(res, profile.id as string)
      return res
    }

    const res = NextResponse.json({ result: 'ok', user })
    setSessionCookie(res, profile.id as string)
    return res
  } catch (err) {
    console.error('[auth/login] unexpected error', err)
    return NextResponse.json({ result: 'wrong_code' }, { status: 500 })
  }
}
