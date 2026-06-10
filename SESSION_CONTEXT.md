# SESSION_CONTEXT — Typerzy Mundial 2026

Załaduj ten plik na początku każdej sesji. Max 2K znaków.

*Ostatnia aktualizacja: 2026-06-10 (naprawa logowania)*

---

## Status projektu

| Komponent | Status |
|-----------|--------|
| Build (`npm run build`) | ✅ 0 błędów TypeScript, 22 routes |
| Tryb mock (lokalne) | ✅ działa bez konfiguracji |
| Auth API (login/me/logout) | ✅ gotowe — naprawiono 2026-06-10 |
| Predictions API | ✅ gotowe |
| Admin API (users/matches) | ✅ gotowe |
| Cron endpointy (4x) | ✅ gotowe (dual auth: Bearer + session cookie) |
| recalculate-points | ✅ pełna implementacja |
| Supabase schema/rls/seed | ✅ gotowe |
| README (16-step deploy) | ✅ gotowe |
| Deploy na Vercel | ⏳ **NASTĘPNY KROK** |

---

## Architektura (dual-mode)

```
IS_PRODUCTION_MODE = Boolean(NEXT_PUBLIC_SUPABASE_URL?.match(/^https:\/\/[a-z0-9]+\.supabase\.co$/))
```

- `false` → mock data z `lib/mock-data.ts`, store lokalny, zero API calls
- `true`  → Supabase PostgreSQL, cookie `typerzy_session` = profile UUID

## Kluczowe pliki zmodyfikowane w tym projekcie

```
lib/tournament-config.ts    IS_PRODUCTION_MODE + stałe
lib/store.ts                loginAsync, bulk setters, fire-and-forget writes
lib/supabase/admin.ts       createAdminClient() — service role, server only
components/providers.tsx    init() — hydratacja stanu z Supabase przy starcie
app/page.tsx                async login z loading state
app/api/auth/               login / me / logout
app/api/predictions/        upsert typowań
app/api/data/predictions/   GET typowań zalogowanego gracza
app/api/admin/users/        GET/PATCH graczy (admin)
app/api/admin/matches/      PATCH wyników meczów (admin)
app/api/sync-matches/       cron + admin button
app/api/sync-results/       cron + admin button
app/api/recalculate-points/ pełna logika punktacji
app/api/sync-standings/     cron + admin button
supabase/schema.sql         tabele bez auth.uid()
supabase/rls.sql            public read, service role write
supabase/seed.sql           Michał admin + TYPERZY2026
```

## Security constraints (NIEZMIENNE)

- `SUPABASE_SERVICE_ROLE_KEY` — serwer only, nigdy `NEXT_PUBLIC_`
- `FOOTBALL_API_KEY` — serwer only, nigdy `NEXT_PUBLIC_`
- `CRON_SECRET` — serwer only, nigdy `NEXT_PUBLIC_`
- Auth: nick + kod dostępu + akceptacja admina (bez email/hasło)
- Cookie: `typerzy_session` = profile UUID (httpOnly)

## Następne kroki

1. **Deploy na Vercel** — README krok 1–9
2. Utwórz projekt Supabase → uruchom schema.sql, rls.sql, seed.sql
   > **Uwaga**: jeśli Michał próbował się logować przed seed.sql (status `pending`), uruchom seed.sql ponownie — jest idempotentny i zaktualizuje status na `admin/active`
3. Ustaw env vars na Vercel (6 zmiennych — patrz README krok 6)
4. Zweryfikuj cron jobs w Vercel dashboard
5. Zaproś graczy (kod: TYPERZY2026), akceptuj z panelu admina

## Znane ograniczenia

- `recalculate-points` aktualizuje punkty dla **wszystkich** skończonych meczów przy każdym wywołaniu (nie incremental) — wystarczy dla ~48 meczów grupowych + fazy pucharowe
- `sync-matches/results/standings` są stubami (logują do sync_logs, nie fetchują z zewnętrznego API) — do uzupełnienia gdy będzie `FOOTBALL_API_KEY`
- RLS: brak `auth.uid()` — własna autentykacja przez service role
