import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { IS_PRODUCTION_MODE } from '@/lib/tournament-config'
import { SCORING_DEFAULTS } from '@/lib/scoring'

async function requireAdmin(req: NextRequest) {
  const sessionId = req.cookies.get('typerzy_session')?.value
  if (!sessionId) return null
  const db = createAdminClient()
  const { data } = await db.from('profiles').select('id, role').eq('id', sessionId).single()
  return data?.role === 'admin' ? sessionId : null
}

const DEFAULT_ROWS = Object.entries(SCORING_DEFAULTS).map(([key, val]) => ({
  key,
  label: val.label,
  value: val.value,
  description: val.description,
  updated_at: null as string | null,
}))

// GET — returns all scoring settings; falls back to defaults in mock mode or on error
export async function GET() {
  if (!IS_PRODUCTION_MODE) {
    return NextResponse.json({ settings: DEFAULT_ROWS })
  }
  try {
    const db = createAdminClient()
    const { data, error } = await db
      .from('scoring_settings')
      .select('key, label, value, description, updated_at')
      .order('key', { ascending: true })
    if (error) throw error
    return NextResponse.json({ settings: data ?? DEFAULT_ROWS })
  } catch (err) {
    console.error('[scoring-settings GET]', err)
    return NextResponse.json({ settings: DEFAULT_ROWS })
  }
}

// PATCH — admin only, updates a single setting's value
export async function PATCH(req: NextRequest) {
  if (!await requireAdmin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  try {
    const { key, value } = await req.json()
    if (!key || typeof value !== 'number' || value < 0) {
      return NextResponse.json({ error: 'Invalid key or value' }, { status: 400 })
    }

    if (!IS_PRODUCTION_MODE) {
      return NextResponse.json({ ok: true })
    }

    const db = createAdminClient()
    const { error } = await db
      .from('scoring_settings')
      .update({ value, updated_at: new Date().toISOString() })
      .eq('key', key)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[scoring-settings PATCH]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
