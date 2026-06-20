-- Admin override metadata for predictions (manual correction after lock time).
-- Does NOT change predicted_result CHECK constraint or any existing scoring logic.
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS is_admin_override BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS admin_override_reason TEXT NULL;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS admin_override_by UUID NULL REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS admin_override_at TIMESTAMPTZ NULL;
