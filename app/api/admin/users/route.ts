import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { User } from '@/types'

async function requireAdmin(req: NextRequest) {
  const sessionId = req.cookies.get('typerzy_session')?.value
  if (!sessionId) return null
  const db = createAdminClient()
  const { data } = await db.from('profiles').select('id, role').eq('id', sessionId).single()
  return data?.role === 'admin' ? sessionId : null
}

function mapRow(row: Record<string, unknown>): User {
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

// GET — all profiles including pending/blocked (admin only)
export async function GET(req: NextRequest) {
  if (!await requireAdmin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const db = createAdminClient()
  const { data, error } = await db.from('profiles').select('*').order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ users: (data ?? []).map(mapRow) })
}

// DELETE — remove user and their predictions (admin only)
export async function DELETE(req: NextRequest) {
  const adminId = await requireAdmin(req)
  if (!adminId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  try {
    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    if (id === adminId) return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 })

    const db = createAdminClient()
    // Delete predictions explicitly (cascade would handle it, but being explicit)
    const { error: predError } = await db.from('predictions').delete().eq('user_id', id)
    if (predError) return NextResponse.json({ error: predError.message }, { status: 500 })
    const { error: profileError } = await db.from('profiles').delete().eq('id', id)
    if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[admin/users DELETE]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// PATCH — update user status or role (admin only)
export async function PATCH(req: NextRequest) {
  if (!await requireAdmin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  try {
    const { id, status, role, nick } = await req.json()
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const update: Record<string, unknown> = {}
    if (status) update.status = status
    if (role) update.role = role
    if (nick) update.nick = nick.trim()

    const db = createAdminClient()
    const { error } = await db.from('profiles').update(update).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[admin/users PATCH]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
