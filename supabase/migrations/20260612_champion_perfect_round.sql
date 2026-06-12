-- 2026-06-12: champion predictions + perfect_round bonus type
-- Idempotent — bezpieczne do wielokrotnego uruchomienia

-- 0. Upewnij się, że funkcja update_updated_at() istnieje
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- 1. Utwórz tabelę scoring_settings jeśli nie istnieje
CREATE TABLE IF NOT EXISTS scoring_settings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT NOT NULL UNIQUE,
  label       TEXT NOT NULL,
  value       INT NOT NULL DEFAULT 0,
  description TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Włącz RLS na scoring_settings
ALTER TABLE scoring_settings ENABLE ROW LEVEL SECURITY;

-- Dodaj policy publicznego odczytu (jeśli jeszcze nie istnieje)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'scoring_settings'
      AND policyname = 'scoring_settings_public_select'
  ) THEN
    CREATE POLICY "scoring_settings_public_select" ON scoring_settings
      FOR SELECT USING (true);
  END IF;
END $$;

-- Trigger updated_at dla scoring_settings
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'scoring_settings_updated_at') THEN
    CREATE TRIGGER scoring_settings_updated_at
      BEFORE UPDATE ON scoring_settings
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

-- 2. Rozszerz bonus_points.bonus_type o perfect_round
ALTER TABLE bonus_points DROP CONSTRAINT IF EXISTS bonus_points_bonus_type_check;
ALTER TABLE bonus_points ADD CONSTRAINT bonus_points_bonus_type_check
  CHECK (bonus_type IN ('round_king','streak_3','streak_5','risky_pick','tournament_winner','perfect_round'));

-- 3. Dodaj kolumnę updated_at do tournament_winner_predictions
ALTER TABLE tournament_winner_predictions
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 4. Trigger updated_at dla tournament_winner_predictions
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tournament_winner_predictions_updated_at') THEN
    CREATE TRIGGER tournament_winner_predictions_updated_at
      BEFORE UPDATE ON tournament_winner_predictions
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

-- 5. Seed scoring_settings (nie nadpisuje istniejących wartości)
INSERT INTO scoring_settings (key, label, value, description) VALUES
  ('outcome_points',              'Trafiona końcówka',              3,  'Punkty za trafiony wynik meczu (W/R/P)'),
  ('exact_score_points',          'Dokładny wynik',                  5,  'Punkty za dokładny wynik meczu (łącznie max 8 pkt)'),
  ('perfect_round_bonus',         'Perfekcyjna kolejka',             5,  'Bonus za trafienie wszystkich meczów w kolejce grupowej'),
  ('streak_3_bonus',              'Passa x3',                        2,  'Bonus za 3 trafne typy z rzędu'),
  ('streak_5_bonus',              'Passa x5',                        5,  'Bonus za 5 trafnych typów z rzędu'),
  ('risky_pick_bonus',            'Ryzykowny typ',                   2,  'Bonus dla jedynego gracza, który trafił wynik meczu'),
  ('tournament_winner_bonus',     'Zwycięzca turnieju',              20, 'Bonus za trafienie mistrza turnieju przed startem'),
  ('champion_prediction_enabled', 'Typowanie mistrza — odblokowane', 1,  'Odblokowanie typowania mistrza turnieju (1=tak, 0=zablokowane)')
ON CONFLICT (key) DO NOTHING;
