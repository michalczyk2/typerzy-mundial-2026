-- Seed data for typerzy-mundial-2026
-- Run AFTER schema.sql and rls.sql

-- Access codes
INSERT INTO access_codes (code, is_active)
VALUES ('TYPERZY2026', true)
ON CONFLICT (code) DO UPDATE SET is_active = true;

INSERT INTO access_codes (code, is_active)
VALUES ('ADMIN', true)
ON CONFLICT (code) DO UPDATE SET is_active = true;

-- Admin account (nick = admin, kod dostępu = ADMIN lub TYPERZY2026)
-- ON CONFLICT DO UPDATE ensures correct role/status even if profile already exists as pending
INSERT INTO profiles (nick, role, status)
VALUES ('admin', 'admin', 'active')
ON CONFLICT (nick) DO UPDATE SET role = 'admin', status = 'active', updated_at = NOW();

-- Scoring settings (default values — configurable in admin panel without code changes)
INSERT INTO scoring_settings (key, label, value, description) VALUES
  ('outcome_points',         'Trafiona końcówka',    3,  'Punkty za trafiony wynik meczu (W/R/P)'),
  ('exact_score_points',     'Dokładny wynik',        5,  'Punkty za dokładny wynik meczu (łącznie max 8 pkt)'),
  ('round_winner_bonus',     'Król kolejki',          3,  'Bonus dla gracza z największą liczbą punktów w kolejce'),
  ('streak_3_bonus',         'Passa x3',              2,  'Bonus za 3 trafne typy z rzędu'),
  ('streak_5_bonus',         'Passa x5',              5,  'Bonus za 5 trafnych typów z rzędu'),
  ('risky_pick_bonus',       'Ryzykowny typ',         2,  'Bonus dla jedynego gracza, który trafił wynik meczu'),
  ('tournament_winner_bonus','Zwycięzca turnieju',   20,  'Bonus za trafienie mistrza turnieju przed startem')
ON CONFLICT (key) DO NOTHING;
