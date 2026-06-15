-- ============================================================
-- MIGRATION: Naprawa duplikatów meczów
-- Data: 2026-06-14
-- URUCHAMIAJ FAZAMI — sprawdź SELECT-y przed każdym DELETE/UPDATE
-- ============================================================

-- ============================================================
-- FAZA 0: DIAGNOSTYKA (tylko SELECT — bezpieczna)
-- ============================================================

-- 1. Łączna liczba meczów
SELECT COUNT(*) AS total_matches FROM matches;

-- 2. Liczba wc26_*
SELECT COUNT(*) AS wc26_count FROM matches WHERE external_id LIKE 'wc26_%';

-- 3. Liczba ofb_*
SELECT COUNT(*) AS ofb_count FROM matches WHERE external_id LIKE 'ofb_%';

-- 4. Liczba NULL external_id
SELECT COUNT(*) AS null_external_id FROM matches WHERE external_id IS NULL;

-- 5. Duplikaty po team_a, team_b, dacie
SELECT team_a, team_b, DATE(match_date) AS match_day, COUNT(*) AS cnt
FROM matches
GROUP BY team_a, team_b, DATE(match_date)
HAVING COUNT(*) > 1
ORDER BY cnt DESC;

-- 6. Duplikaty po team_a, team_b, dacie, kolejce
SELECT team_a, team_b, DATE(match_date) AS match_day, round, COUNT(*) AS cnt
FROM matches
GROUP BY team_a, team_b, DATE(match_date), round
HAVING COUNT(*) > 1
ORDER BY cnt DESC;

-- 7. Te same drużyny w różnych wierszach (duplikaty cross-source lub legit różne mecze)
SELECT
  team_a, team_b,
  COUNT(*) AS total_rows,
  COUNT(DISTINCT round) AS distinct_rounds,
  array_agg(DISTINCT round ORDER BY round) AS rounds,
  array_agg(DISTINCT external_id ORDER BY external_id) AS ext_ids
FROM matches
WHERE phase = 'group'
GROUP BY team_a, team_b
HAVING COUNT(*) > 1
ORDER BY team_a, team_b;

-- 7b. Konkretne pary WC26 ↔ OFB (ten sam mecz, różne external_id)
SELECT
  w.id          AS wc26_id,
  w.external_id AS wc26_ext,
  o.id          AS ofb_id,
  o.external_id AS ofb_ext,
  w.team_a,
  w.team_b,
  DATE(w.match_date) AS match_day,
  (SELECT COUNT(*) FROM predictions WHERE match_id = o.id) AS ofb_predictions
FROM matches w
JOIN matches o ON (
  LOWER(w.team_a) = LOWER(o.team_a)
  AND LOWER(w.team_b) = LOWER(o.team_b)
  AND DATE(w.match_date) = DATE(o.match_date)
)
WHERE w.external_id LIKE 'wc26_%'
  AND (o.external_id LIKE 'ofb_%' OR o.external_id IS NULL)
ORDER BY match_day;

-- ============================================================
-- FAZA 1: BACKUP (uruchom przed DELETE/UPDATE)
-- ============================================================

CREATE TABLE IF NOT EXISTS matches_backup_20260614 AS
SELECT * FROM matches;

CREATE TABLE IF NOT EXISTS predictions_backup_20260614 AS
SELECT * FROM predictions;

-- Sprawdź backup:
-- SELECT COUNT(*) FROM matches_backup_20260614;
-- SELECT COUNT(*) FROM predictions_backup_20260614;

-- ============================================================
-- FAZA 2: PRZEPNIJ TYPY z meczów OFB/null na WC26
-- (wykonaj gdy diagnostyka 7b pokazała ofb_predictions > 0)
-- ============================================================

UPDATE predictions
SET match_id = wc26.id
FROM matches wc26
JOIN matches ofb ON (
  LOWER(wc26.team_a) = LOWER(ofb.team_a)
  AND LOWER(wc26.team_b) = LOWER(ofb.team_b)
  AND DATE(wc26.match_date) = DATE(ofb.match_date)
)
WHERE wc26.external_id LIKE 'wc26_%'
  AND (ofb.external_id LIKE 'ofb_%' OR ofb.external_id IS NULL)
  AND predictions.match_id = ofb.id;

-- Weryfikacja: po Fazie 2 ten SELECT powinien zwrócić 0
SELECT COUNT(*) AS predictions_still_on_ofb
FROM predictions p
JOIN matches m ON m.id = p.match_id
WHERE m.external_id LIKE 'ofb_%' OR m.external_id IS NULL;

-- ============================================================
-- FAZA 3: USUŃ DUPLIKATY OFB/NULL które mają WC26-odpowiednik
-- (uruchom po Fazie 2)
-- ============================================================

DELETE FROM matches
WHERE id IN (
  SELECT o.id
  FROM matches w
  JOIN matches o ON (
    LOWER(w.team_a) = LOWER(o.team_a)
    AND LOWER(w.team_b) = LOWER(o.team_b)
    AND DATE(w.match_date) = DATE(o.match_date)
  )
  WHERE w.external_id LIKE 'wc26_%'
    AND (o.external_id LIKE 'ofb_%' OR o.external_id IS NULL)
);

-- Sprawdź czy coś OFB zostało (bez pary WC26):
SELECT id, external_id, team_a, team_b FROM matches
WHERE external_id LIKE 'ofb_%' OR external_id IS NULL;
-- Jeśli pusto — dobrze. Jeśli coś zostało — to mecze bez WC26-pary, sprawdź ręcznie.

-- ============================================================
-- FAZA 4: UNIQUE CONSTRAINT — ochrona na przyszłość
-- (uruchom po Fazie 3, gdy duplikaty są usunięte)
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS matches_teams_date_uniq
ON matches (LOWER(team_a), LOWER(team_b), (match_date::date));

-- Weryfikacja:
-- SELECT indexname FROM pg_indexes WHERE tablename = 'matches' AND indexname = 'matches_teams_date_uniq';
