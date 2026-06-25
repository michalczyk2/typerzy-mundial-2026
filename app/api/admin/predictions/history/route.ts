import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function requireAdmin(req: NextRequest) {
  const sessionId = req.cookies.get('typerzy_session')?.value
  if (!sessionId) return null
  const db = createAdminClient()
  const { data } = await db.from('profiles').select('id, role').eq('id', sessionId).single()
  return data?.role === 'admin' ? sessionId : null
}

export type CorrectionHistoryEntry = {
  id: string
  match_id: string
  team_a: string
  team_b: string
  match_date: string
  score_a: number | null
  score_b: number | null
  user_id: string
  nick: string
  predicted_a: number
  predicted_b: number
  admin_override_reason: string
  admin_override_at: string
  override_by_nick: string | null
}

export async function GET(req: NextRequest) {
  const adminId = await requireAdmin(req)
  if (!adminId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const db = createAdminClient()

    const { data, error } = await db
      .from('predictions')
      .select(`
        id,
        match_id,
        user_id,
        predicted_a,
        predicted_b,
        admin_override_reason,
        admin_override_at,
        admin_override_by,
        matches!inner ( team_a, team_b, match_date, score_a, score_b ),
        profiles!predictions_user_id_fkey ( nick )
      `)
      .eq('is_admin_override', true)
      .order('admin_override_at', { ascending: false })
      .limit(100)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const overrideByIds = [...new Set((data ?? []).map(r => r.admin_override_by).filter(Boolean))]
    let byNickMap: Record<string, string> = {}
    if (overrideByIds.length > 0) {
      const { data: admins } = await db
        .from('profiles')
        .select('id, nick')
        .in('id', overrideByIds as string[])
      byNickMap = Object.fromEntries((admins ?? []).map(a => [a.id, a.nick]))
    }

    const entries: CorrectionHistoryEntry[] = (data ?? []).map(r => {
      const match = r.matches as unknown as { team_a: string; team_b: string; match_date: string; score_a: number | null; score_b: number | null }
      const profile = r.profiles as unknown as { nick: string } | null
      return {
        id: r.id,
        match_id: r.match_id,
        team_a: match?.team_a ?? '?',
        team_b: match?.team_b ?? '?',
        match_date: match?.match_date ?? '',
        score_a: match?.score_a ?? null,
        score_b: match?.score_b ?? null,
        user_id: r.user_id,
        nick: profile?.nick ?? '?',
        predicted_a: r.predicted_a,
        predicted_b: r.predicted_b,
        admin_override_reason: r.admin_override_reason ?? '',
        admin_override_at: r.admin_override_at ?? '',
        override_by_nick: r.admin_override_by ? (byNickMap[r.admin_override_by] ?? null) : null,
      }
    })

    return NextResponse.json({ entries })
  } catch (err) {
    console.error('[admin/predictions/history GET]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
