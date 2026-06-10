-- FULL RESET: wyczyść wszystko i zacznij od zera
-- ⚠ UWAGA: kasuje WSZYSTKICH użytkowników, predykcje, mecze, tabele, logi!
-- Uruchom TYLKO gdy chcesz zacząć od pustej bazy.
-- Po wykonaniu uruchom ponownie seed.sql.

-- Wyłącz triggery podczas czyszczenia
SET session_replication_role = replica;

TRUNCATE TABLE sync_logs        CASCADE;
TRUNCATE TABLE bonus_points     CASCADE;
TRUNCATE TABLE predictions      CASCADE;
TRUNCATE TABLE standings        CASCADE;
TRUNCATE TABLE matches          CASCADE;
TRUNCATE TABLE scoring_settings CASCADE;
TRUNCATE TABLE profiles         CASCADE;
TRUNCATE TABLE access_codes     CASCADE;

-- Przywróć triggery
SET session_replication_role = DEFAULT;

-- Po wykonaniu uruchom seed.sql żeby przywrócić:
-- - kod dostępu TYPERZY2026 i ADMIN
-- - konto admina (nick=admin, role=admin, status=active)
-- - domyślne ustawienia punktacji
