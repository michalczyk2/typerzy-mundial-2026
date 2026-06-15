import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  isFormDisplayMode,
  isFormStyleVariant,
  normalizeFormVisualSettings,
} from '@/lib/form-visual-settings'

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
  const { data, error } = await db
    .from('app_settings')
    .select('key, value')
    .in('key', ['form_display_mode', 'form_style_variant'])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ settings: normalizeFormVisualSettings(data) })
}

export async function PATCH(req: NextRequest) {
  if (!await requireAdmin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const body = await req.json()
    const displayMode = body.display_mode
    const styleVariant = body.style_variant

    if (!isFormDisplayMode(displayMode)) {
      return NextResponse.json({ error: 'Invalid display_mode' }, { status: 400 })
    }
    if (!isFormStyleVariant(styleVariant)) {
      return NextResponse.json({ error: 'Invalid style_variant' }, { status: 400 })
    }

    const db = createAdminClient()
    const { error } = await db.from('app_settings').upsert([
      { key: 'form_display_mode', value: displayMode, updated_at: new Date().toISOString() },
      { key: 'form_style_variant', value: styleVariant, updated_at: new Date().toISOString() },
    ], { onConflict: 'key' })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ settings: { display_mode: displayMode, style_variant: styleVariant } })
  } catch (err) {
    console.error('[admin/form-visual-settings PATCH]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
