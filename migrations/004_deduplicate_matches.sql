-- Migration 004: Deduplicate matches + add is_archived flag
-- ⚠️ URUCHOM RĘCZNIE w Supabase SQL Editor.
-- ⚠️ Najpierw uruchom TYLKO Krok 2 (audyt) i sprawdź wyniki — potem dopiero Krok 3+.
-- ⚠️ Backup (Krok 0) tworzy kopię na wypadek pomyłki.

-- ─── Krok 0: Backup ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS matches_dedup_backup AS SELECT * FROM matches;

-- ─── Krok 1: Dodaj kolumnę is_archived ────────────────────────────────────────
ALTER TABLE matches ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;

-- Index for filtering
CREATE INDEX IF NOT EXISTS idx_matches_is_archived ON matches(is_archived);

-- ─── Krok 2: AUDYT — uruchom OSOBNO i sprawdź wyniki ──────────────────────────
-- Pokazuje pary: stary rekord (legacy) + nowy z API worldcup26.ir (canonical).
-- PRZED Krokiem 3 upewnij się, że pary są poprawne.
WITH legacy AS (
  SELECT
    id, external_id, team_a, team_b,
    COALESCE(official_match_day, match_date::date) AS match_day,
    round, group_name, data_source
  FROM matches
  WHERE (external_id IS NULL OR external_id LIKE 'ofb_%')
    AND is_archived = FALSE
),
canonical AS (
  SELECT
    id, external_id, team_a, team_b,
    COALESCE(official_match_day, match_date::date) AS match_day
  FROM matches
  WHERE external_id LIKE 'wc26_%'
    AND is_archived = FALSE
)
SELECT
  l.id          AS legacy_id,
  l.external_id AS legacy_ext,
  concat(l.team_a, ' vs ', l.team_b) AS match_name,
  l.match_day   AS legacy_day,
  l.round       AS legacy_round,
  l.group_name  AS legacy_group,
  l.data_source AS legacy_source,
  c.id          AS canonical_id,
  c.external_id AS canonical_ext,
  c.match_day   AS canonical_day,
  (SELECT COUNT(*) FROM predictions WHERE match_id = l.id) AS legacy_predictions,
  (SELECT COUNT(*) FROM predictions WHERE match_id = c.id) AS canonical_predictions
FROM legacy l
JOIN canonical c ON (
  lower(l.team_a) = lower(c.team_a)
  AND lower(l.team_b) = lower(c.team_b)
  AND abs(
    COALESCE(l.official_match_day, l.match_date::date)
    - COALESCE(c.official_match_day, c.match_date::date)
  ) <= 1
)
ORDER BY l.team_a;


-- ─── Krok 3: Migracja + archiwizacja (uruchom po sprawdzeniu Kroku 2) ─────────
-- Idempotentne — bezpieczne do ponownego uruchomienia.
-- Przenosi typowania i dane do canonical, archiwizuje legacy (NIE usuwa).
DO $$
DECLARE
  pair RECORD;
  canonical_pred_count INT;
BEGIN
  FOR pair IN
    WITH legacy AS (
      SELECT id, team_a, team_b,
             COALESCE(official_match_day, match_date::date) AS match_day
      FROM matches
      WHERE (external_id IS NULL OR external_id LIKE 'ofb_%') AND is_archived = FALSE
    ),
    canonical AS (
      SELECT id, team_a, team_b,
             COALESCE(official_match_day, match_date::date) AS match_day
      FROM matches
      WHERE external_id LIKE 'wc26_%' AND is_archived = FALSE
    )
    SELECT l.id AS legacy_id, c.id AS canonical_id,
           concat(l.team_a, ' vs ', l.team_b) AS match_name
    FROM legacy l
    JOIN canonical c ON (
      lower(l.team_a) = lower(c.team_a)
      AND lower(l.team_b) = lower(c.team_b)
      AND abs(l.match_day - c.match_day) <= 1
    )
  LOOP
    RAISE NOTICE 'Przetwarzam: % | legacy=% → canonical=%',
      pair.match_name, pair.legacy_id, pair.canonical_id;

    -- Check if canonical already has predictions (rare conflict)
    SELECT COUNT(*) INTO canonical_pred_count
    FROM predictions WHERE match_id = pair.canonical_id;

    IF canonical_pred_count = 0 THEN
      -- No conflict: move all legacy predictions to canonical
      UPDATE predictions SET match_id = pair.canonical_id WHERE match_id = pair.legacy_id;
      RAISE NOTICE '  predictions przeniesione';
    ELSE
      -- Canonical already has predictions — delete legacy to avoid duplicates
      -- (this means users typed for BOTH records, keep canonical ones)
      DELETE FROM predictions WHERE match_id = pair.legacy_id;
      RAISE NOTICE '  KONFLIKT: canonical ma % typowań, usuwam legacy typowania', canonical_pred_count;
    END IF;

    -- Move bonus_points references
    UPDATE bonus_points SET match_id = pair.canonical_id WHERE match_id = pair.legacy_id;

    -- Move match_of_day_events references
    UPDATE match_of_day_events SET match_id = pair.canonical_id WHERE match_id = pair.legacy_id;

    -- Archive the legacy match (does NOT delete — backup stays in matches_dedup_backup)
    UPDATE matches SET is_archived = TRUE WHERE id = pair.legacy_id;

    RAISE NOTICE '  zarchiwizowano %', pair.legacy_id;
  END LOOP;

  RAISE NOTICE 'Deduplikacja zakończona.';
END $$;


-- ─── Krok 4: Unique index na external_id (zabezpiecza przed przyszłymi duplikatami) ─
CREATE UNIQUE INDEX IF NOT EXISTS idx_matches_external_id_unique
  ON matches(external_id)
  WHERE external_id IS NOT NULL;


-- ─── Weryfikacja: uruchom po Kroku 3 ─────────────────────────────────────────
SELECT
  is_archived,
  COUNT(*)                                                    AS total,
  COUNT(CASE WHEN external_id IS NULL THEN 1 END)             AS null_ext,
  COUNT(CASE WHEN external_id LIKE 'ofb_%' THEN 1 END)       AS ofb_count,
  COUNT(CASE WHEN external_id LIKE 'wc26_%' THEN 1 END)      AS wc26_count
FROM matches
GROUP BY is_archived
ORDER BY is_archived;
