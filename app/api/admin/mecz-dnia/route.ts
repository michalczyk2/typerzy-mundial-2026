import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const SETTING_KEY = 'mecz_dnia_enabled'

async function requireAdmin(req: NextRequest) {
  const sessionId = req.cookies.get('typerzy_session')?.value
  if (!sessionId) return false
  const db = createAdminClient()
  const { data } = await db.from('profiles').select('role').eq('id', sessionId).single()
  return data?.role === 'admin'
}

export async function GET(req: NextRequest) {
  if (!await requireAdmin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const db = createAdminClient()
  const { data } = await db
    .from('app_settings')
    .select('value')
    .eq('key', SETTING_KEY)
    .maybeSingle()

  if (!data) {
    // Key missing on first deploy → insert false to immediately hide the placeholder
    await db.from('app_settings').insert({
      key: SETTING_KEY,
      value: 'false',
      updated_at: new Date().toISOString(),
    })
    return NextResponse.json({ enabled: false })
  }

  return NextResponse.json({ enabled: data.value === 'true' })
}

export async function PATCH(req: NextRequest) {
  if (!await requireAdmin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const { enabled } = await req.json()
    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'enabled must be boolean' }, { status: 400 })
    }

    const db = createAdminClient()
    const { error } = await db.from('app_settings').upsert(
      { key: SETTING_KEY, value: enabled ? 'true' : 'false', updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ enabled })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
