# PROJECT MEMORY — Typerzy Mundial 2026

Plik dla Claude Code z kluczowym kontekstem projektu. Załaduj przy każdej sesji.

*Ostatnia aktualizacja: 2026-06-10*

## Status

- **Faza**: Produkcja gotowa — cały kod napisany, build zielony
- **Następny krok**: Deploy na Vercel + konfiguracja Supabase (README krok 1–9)

---

## Architektura — dual-mode

```
IS_PRODUCTION_MODE = Boolean(NEXT_PUBLIC_SUPABASE_URL?.match(/^https:\/\/[a-z0-9]+\.supabase\.co$/))
```

| Tryb | Store init | Auth | Writes |
|------|-----------|------|--------|
| Mock (`false`) | MOCK_* data | sync `login()` w store | tylko lokalny state |
| Produkcja (`true`) | puste tablice → hydratacja z API | async `loginAsync()` → POST /api/auth/login | fire-and-forget do API |

---

## Kluczowe decyzje architektoniczne

### Custom auth (nie Supabase Auth)
Nick + kod dostępu + akceptacja admina. Brak email/hasła, brak JWT Supabase.
Cookie: `typerzy_session` = profile UUID (httpOnly, path=/).
Konsekwencja: RLS nie może używać `auth.uid()` — public read, service role dla wszystkich zapisów.

### Login — naprawione błędy (2026-06-10)

- `.trim().toUpperCase()` na `code`, `.trim()` na `nick` — usuwa spacje wklejone omyłkowo przez użytkownika
- Cookie `typerzy_session` ustawiana również dla `status=pending` — ekran oczekiwania nie ginie po odświeżeniu strony
- seed.sql używa `ON CONFLICT (nick) DO UPDATE` — działa poprawnie nawet jeśli Michał istniał wcześniej jako `pending`
- Dodano `console.error('[auth/login] code lookup failed')` — umożliwia diagnozę gdy `SUPABASE_SERVICE_ROLE_KEY` brakuje

### Trzy klienty Supabase
- `lib/supabase/client.ts` — browser, anon key, SSR-safe
- `lib/supabase/server.ts` — SSR, czyta cookie
- `lib/supabase/admin.ts` — `createAdminClient()`, service role key, **tylko serwer**

### Dual-auth dla cron endpoints
Każdy z 4 endpointów (`sync-matches`, `sync-results`, `recalculate-points`, `sync-standings`) akceptuje:
1. `Authorization: Bearer CRON_SECRET` — wywołania z Vercel Cron
2. Cookie `typerzy_session` z `role=admin` — wywołania z AdminPanel

### DB column mapping
DB: `bonus_points_total` → TypeScript `User.bonus_points`
Mapowane w `mapRow()` / `mapDbToUser()` w każdym API route czytającym `profiles`.

### Fire-and-forget pattern (lib/store.ts)
Przy `addPrediction`, `updatePrediction`, `updateUserStatus`, `updateMatchScore`:
1. Optimistic update lokalnego state
2. `if (IS_PRODUCTION_MODE)` → fetch do API w tle (bez await)

---

## Supabase schema (kluczowe tabele)

```
profiles          id(uuid), nick, role(admin|player), status(pending|active|banned),
                  match_points, bonus_points_total, total_points, predictions_count,
                  correct_outcomes, correct_scores
access_codes      code, is_active, max_uses, used_count
matches           id, home_team, away_team, match_date, status, score_a, score_b, group_name
predictions       id, user_id, match_id, predicted_a, predicted_b,
                  points_earned, is_correct_outcome, is_correct_score, is_locked
sync_logs         sync_type, status, records_updated, message, created_at
```

RLS: anon może SELECT (bez auth.uid()), service role dla INSERT/UPDATE/DELETE.

---

## Security constraints (NIEZMIENNE)

- `SUPABASE_SERVICE_ROLE_KEY` — nigdy `NEXT_PUBLIC_`, nigdy do frontendu
- `FOOTBALL_API_KEY` — nigdy `NEXT_PUBLIC_`, nigdy do frontendu
- `CRON_SECRET` — nigdy `NEXT_PUBLIC_`, nigdy do frontendu
- Wszystkie zapisy do Supabase przez `createAdminClient()` w API routes

---

## Punktacja (lib/scoring.ts)

- Trafna końcówka (W/R/P): **3 pkt**
- Dokładny wynik: **5 pkt** (łącznie max 8 pkt za mecz)
- Bonusy: round_king (+3), streak_3 (+2), streak_5 (+5), risky_pick (+2), tournament_winner (+20)

---

## Znane ograniczenia / TODO

- `sync-matches/results/standings` są stubami — logują do sync_logs, nie fetchują z zewnętrznego API. Do uzupełnienia z `FOOTBALL_API_KEY`.
- `recalculate-points` nie jest incremental — przelicza wszystkie skończone mecze przy każdym wywołaniu. OK dla ~48+16+8+4+2+1 meczów.
- Bonusy (round_king, streak) nie są jeszcze obliczane automatycznie — tylko ręcznie przez admina w bonus_points tabeli.
