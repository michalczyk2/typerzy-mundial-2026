import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { DEFAULT_FORM_VISUAL_SETTINGS, normalizeFormVisualSettings } from '@/lib/form-visual-settings'

export async function GET() {
  try {
    const db = createAdminClient()
    const { data, error } = await db
      .from('app_settings')
      .select('key, value')
      .in('key', ['form_display_mode', 'form_style_variant'])

    if (error) {
      return NextResponse.json({ settings: DEFAULT_FORM_VISUAL_SETTINGS })
    }

    return NextResponse.json({ settings: normalizeFormVisualSettings(data) })
  } catch {
    return NextResponse.json({ settings: DEFAULT_FORM_VISUAL_SETTINGS })
  }
}
