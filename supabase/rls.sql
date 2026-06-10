-- Row Level Security for typerzy-mundial-2026
-- Auth strategy: custom (nick + code), no Supabase Auth
-- All writes go through service role (bypasses RLS) via API routes
-- Public reads use anon key + these policies

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_winner_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bonus_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE standings ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;

-- profiles: public can read active profiles only
-- No public writes — all profile changes via service role
CREATE POLICY "profiles_public_select" ON profiles
  FOR SELECT USING (status = 'active');

-- matches: public read, no public writes
CREATE POLICY "matches_public_select" ON matches
  FOR SELECT USING (true);

-- predictions: no public read (prevents cheating before match start)
-- Reads go through /api/data/predictions (validates session cookie)

-- standings: public read
CREATE POLICY "standings_public_select" ON standings
  FOR SELECT USING (true);

-- bonus_points: public read
CREATE POLICY "bonus_points_public_select" ON bonus_points
  FOR SELECT USING (true);

-- tournament_winner_predictions: public read (after lock)
CREATE POLICY "tournament_winner_public_select" ON tournament_winner_predictions
  FOR SELECT USING (true);

-- scoring_settings: public read (point values shown on bonusy page), service role writes only
ALTER TABLE scoring_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scoring_settings_public_select" ON scoring_settings
  FOR SELECT USING (true);

-- access_codes, sync_logs: no public access
-- (service role only)
