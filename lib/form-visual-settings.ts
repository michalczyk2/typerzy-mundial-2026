import type { FormDisplayMode, FormStyleVariant, FormVisualSettings } from '@/types'

export const DEFAULT_FORM_VISUAL_SETTINGS: FormVisualSettings = {
  display_mode: 'full_effects',
  style_variant: 'sport',
}

export const FORM_DISPLAY_MODES: FormDisplayMode[] = ['off', 'badge_only', 'badge_and_title', 'full_effects']
export const FORM_STYLE_VARIANTS: FormStyleVariant[] = ['light', 'sport', 'premium', 'game', 'strong']

export function isFormDisplayMode(value: unknown): value is FormDisplayMode {
  return typeof value === 'string' && FORM_DISPLAY_MODES.includes(value as FormDisplayMode)
}

export function isFormStyleVariant(value: unknown): value is FormStyleVariant {
  return typeof value === 'string' && FORM_STYLE_VARIANTS.includes(value as FormStyleVariant)
}

export function normalizeFormVisualSettings(rows: { key: string; value: string }[] | null | undefined): FormVisualSettings {
  const settings = { ...DEFAULT_FORM_VISUAL_SETTINGS }
  for (const row of rows ?? []) {
    if (row.key === 'form_display_mode' && isFormDisplayMode(row.value)) settings.display_mode = row.value
    if (row.key === 'form_style_variant' && isFormStyleVariant(row.value)) settings.style_variant = row.value
  }
  return settings
}
