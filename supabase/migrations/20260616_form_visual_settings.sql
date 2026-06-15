-- Global UI settings for leaderboard form/rank presentation.
-- This table stores display mode and visual style variant only.

CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE app_settings
  DROP CONSTRAINT IF EXISTS app_settings_form_visual_keys_check;

ALTER TABLE app_settings
  ADD CONSTRAINT app_settings_form_visual_keys_check
  CHECK (
    key NOT IN ('form_display_mode', 'form_style_variant')
    OR (
      key = 'form_display_mode'
      AND value IN ('off', 'badge_only', 'badge_and_title', 'full_effects')
    )
    OR (
      key = 'form_style_variant'
      AND value IN ('light', 'sport', 'premium', 'game', 'strong')
    )
  );

INSERT INTO app_settings (key, value)
VALUES
  ('form_display_mode', 'full_effects'),
  ('form_style_variant', 'sport')
ON CONFLICT (key) DO NOTHING;
