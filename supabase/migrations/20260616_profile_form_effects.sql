-- Manual player form titles/effects for leaderboard UI.
-- Run in Supabase before deploying UI that reads these columns.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS form_effect_override TEXT NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS custom_form_title TEXT,
  ADD COLUMN IF NOT EXISTS admin_note TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_form_effect_override_check'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_form_effect_override_check
      CHECK (form_effect_override IN ('auto','none','hot','sniper','cold','storm','curse','wooden','var'));
  END IF;
END $$;
