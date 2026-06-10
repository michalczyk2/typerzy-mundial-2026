-- typerzy-mundial-2026 Database Schema
-- Run this in Supabase SQL editor (before rls.sql and seed.sql)

-- Profiles (users in the game)
CREATE TABLE IF NOT EXISTS profiles (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nick                  TEXT NOT NULL UNIQUE,
  role                  TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin','user')),
  status                TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','blocked')),
  total_points          INT NOT NULL DEFAULT 0,
  match_points          INT NOT NULL DEFAULT 0,
  bonus_points_total    INT NOT NULL DEFAULT 0,
  predictions_count     INT NOT NULL DEFAULT 0,
  correct_outcomes      INT NOT NULL DEFAULT 0,
  correct_scores        INT NOT NULL DEFAULT 0,
  current_streak        INT NOT NULL DEFAULT 0,
  best_streak           INT NOT NULL DEFAULT 0,
  tournament_winner_pick TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at         TIMESTAMPTZ
);

-- Access codes (group entry codes)
CREATE TABLE IF NOT EXISTS access_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT NOT NULL UNIQUE,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Matches
CREATE TABLE IF NOT EXISTS matches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id     TEXT UNIQUE,
  team_a          TEXT NOT NULL,
  team_b          TEXT NOT NULL,
  team_a_code     TEXT NOT NULL,
  team_b_code     TEXT NOT NULL,
  match_date      TIMESTAMPTZ NOT NULL,
  status          TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','live','finished','postponed','cancelled')),
  score_a         INT,
  score_b         INT,
  halftime_a      INT,
  halftime_b      INT,
  phase           TEXT NOT NULL DEFAULT 'group' CHECK (phase IN ('group','round_of_32','round_of_16','quarterfinal','semifinal','third_place','final')),
  group_name      TEXT,
  round           INT NOT NULL DEFAULT 1,
  stadium         TEXT,
  city            TEXT,
  data_source     TEXT NOT NULL DEFAULT 'mock' CHECK (data_source IN ('api','manual','mock')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Predictions (one per user per match)
CREATE TABLE IF NOT EXISTS predictions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  match_id            UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  predicted_a         INT NOT NULL,
  predicted_b         INT NOT NULL,
  predicted_result    TEXT NOT NULL CHECK (predicted_result IN ('home','draw','away')),
  points_earned       INT NOT NULL DEFAULT 0,
  is_correct_outcome  BOOLEAN NOT NULL DEFAULT FALSE,
  is_correct_score    BOOLEAN NOT NULL DEFAULT FALSE,
  is_locked           BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, match_id)
);

-- Tournament winner predictions
CREATE TABLE IF NOT EXISTS tournament_winner_predictions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  team_code   TEXT NOT NULL,
  team_name   TEXT NOT NULL,
  points      INT,
  locked_at   TIMESTAMPTZ,
  is_correct  BOOLEAN,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bonus points (king, streaks, risky picks)
CREATE TABLE IF NOT EXISTS bonus_points (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  bonus_type  TEXT NOT NULL CHECK (bonus_type IN ('round_king','streak_3','streak_5','risky_pick','tournament_winner')),
  points      INT NOT NULL,
  match_id    UUID REFERENCES matches(id),
  round       INT,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Group standings (synced from external API)
CREATE TABLE IF NOT EXISTS standings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_name      TEXT NOT NULL,
  team_code       TEXT NOT NULL,
  team_name       TEXT NOT NULL,
  played          INT NOT NULL DEFAULT 0,
  won             INT NOT NULL DEFAULT 0,
  drawn           INT NOT NULL DEFAULT 0,
  lost            INT NOT NULL DEFAULT 0,
  goals_for       INT NOT NULL DEFAULT 0,
  goals_against   INT NOT NULL DEFAULT 0,
  goal_difference INT GENERATED ALWAYS AS (goals_for - goals_against) STORED,
  points          INT NOT NULL DEFAULT 0,
  position        INT NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(group_name, team_code)
);

-- Scoring settings (configurable point values — editable in admin panel)
CREATE TABLE IF NOT EXISTS scoring_settings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT NOT NULL UNIQUE,
  label       TEXT NOT NULL,
  value       INT NOT NULL DEFAULT 0,
  description TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sync logs
CREATE TABLE IF NOT EXISTS sync_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type       TEXT NOT NULL CHECK (sync_type IN ('matches','results','standings','points')),
  status          TEXT NOT NULL CHECK (status IN ('success','error','partial')),
  records_updated INT NOT NULL DEFAULT 0,
  message         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables with updated_at
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'profiles_updated_at') THEN
    CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'matches_updated_at') THEN
    CREATE TRIGGER matches_updated_at BEFORE UPDATE ON matches FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'predictions_updated_at') THEN
    CREATE TRIGGER predictions_updated_at BEFORE UPDATE ON predictions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'scoring_settings_updated_at') THEN
    CREATE TRIGGER scoring_settings_updated_at BEFORE UPDATE ON scoring_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;
