-- Migration 003: Match of Day feature
-- Run this SQL in the Supabase SQL Editor (project dashboard → SQL Editor)
-- After applying, run /api/sync-matches from Admin Panel to populate official_match_day accurately.

-- ─── 1. Add official_match_day to matches ───────────────────────────────────
ALTER TABLE matches ADD COLUMN IF NOT EXISTS official_match_day DATE;

-- Pre-populate from existing UTC match_date.
-- For accuracy (US/Canada/Mexico timezone matches), re-run sync-matches after migration.
UPDATE matches
SET official_match_day = (match_date AT TIME ZONE 'UTC')::date
WHERE official_match_day IS NULL;

CREATE INDEX IF NOT EXISTS idx_matches_official_match_day ON matches(official_match_day);

-- ─── 2. match_of_day_events ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS match_of_day_events (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  official_match_day    DATE        NOT NULL,
  match_id              UUID        NOT NULL REFERENCES matches(id),
  vote_deadline         TIMESTAMPTZ NOT NULL,
  selected_bonus_points INTEGER     CHECK (selected_bonus_points IN (1, 2, 3, 4)),
  status                TEXT        NOT NULL DEFAULT 'voting'
                                    CHECK (status IN ('voting', 'locked', 'settled')),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT match_of_day_events_day_unique UNIQUE (official_match_day)
);

ALTER TABLE match_of_day_events ENABLE ROW LEVEL SECURITY;
-- Anon client can read events (to display current match of day in UI)
CREATE POLICY "Public read match_of_day_events"
  ON match_of_day_events FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS idx_mod_events_day ON match_of_day_events(official_match_day);

-- ─── 3. match_of_day_votes ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS match_of_day_votes (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID        NOT NULL REFERENCES match_of_day_events(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  bonus_points  INTEGER     NOT NULL CHECK (bonus_points IN (1, 2, 3, 4)),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT match_of_day_votes_user_unique UNIQUE (event_id, user_id)
);

-- All vote access goes through API routes that use the service-role admin client.
-- No anon/user policies = no direct Supabase client access.
ALTER TABLE match_of_day_votes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_mod_votes_event ON match_of_day_votes(event_id);
CREATE INDEX IF NOT EXISTS idx_mod_votes_user  ON match_of_day_votes(user_id);
