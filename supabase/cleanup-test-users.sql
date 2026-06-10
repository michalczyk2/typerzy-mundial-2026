-- CLEANUP: usuń testowych użytkowników
-- Zachowuje: admin + wszyscy active gracze bez wyjątku
-- Usuwa: pending (niezaakceptowani) + konkretne złe nicki testowe
-- Bezpieczne do uruchomienia w produkcji.

-- 1. Usuń predykcje dla usuniętych użytkowników (kasujemy najpierw, foreign key)
DELETE FROM predictions
WHERE user_id IN (
  SELECT id FROM profiles
  WHERE status = 'pending'
     OR nick ILIKE 'Mlichał'
     OR nick ILIKE 'test%'
     OR nick ILIKE '%test%'
);

-- 2. Usuń bonus_points dla usuniętych użytkowników
DELETE FROM bonus_points
WHERE user_id IN (
  SELECT id FROM profiles
  WHERE status = 'pending'
     OR nick ILIKE 'Mlichał'
     OR nick ILIKE 'test%'
     OR nick ILIKE '%test%'
);

-- 3. Usuń profile (admin jest active — nie zostanie dotknięty)
DELETE FROM profiles
WHERE status = 'pending'
   OR nick ILIKE 'Mlichał'
   OR nick ILIKE 'test%'
   OR nick ILIKE '%test%';

-- Weryfikacja po wykonaniu:
-- SELECT nick, status, role FROM profiles ORDER BY created_at;
