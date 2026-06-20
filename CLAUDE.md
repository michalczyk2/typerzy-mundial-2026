# CLAUDE.md — Typerzy Mundial 2026

## Kontekst projektu

Prywatna liga typowania MŚ 2026 dla znajomych.
Stack: Next.js 16 + TypeScript + Tailwind v4 + Supabase + Zustand v5 + Vercel.

Załaduj na początku sesji: SESSION_CONTEXT.md + PROJECT_MEMORY.md

---

## Zasady bezwzględne

- Nie mieszaj z innymi projektami (CryptoBOT, Rork, licencjat)
- `SUPABASE_SERVICE_ROLE_KEY`, `FOOTBALL_API_KEY`, `CRON_SECRET` — **nigdy NEXT_PUBLIC_, nigdy frontend**
- **Nie usuwaj działającego MVP. Nie zmieniaj wyglądu bez potrzeby.**
- Auth: nick + kod dostępu + akceptacja admina. Bez email/hasła. Bez Supabase Auth/JWT.

---

## KRYTYCZNE ZASADY BEZPIECZEŃSTWA DANYCH

- **Nie wykonuj DELETE na `predictions` bez wyraźnej zgody właściciela.**
- Przed każdą masową zmianą `UPDATE`/`DELETE` w Supabase — zrób backup lub przynajmniej pełny `SELECT`/audyt zmienianych rekordów.
- Duplikaty meczów po integracji WC26 zostały **historycznie naprawione przez archiwizację** osieroconych `ofb_*` (`is_archived = true`), **nie przez DELETE**. Nie powtarzaj pierwotnego planu DELETE.
- Logika aplikacji ma używać aktywnych `wc26_%` i pomijać wiersze z `is_archived = true`.
- **Nigdy nie przywracaj** starego zachowania, które mieszało `wc26_*` i `ofb_*` jako aktywne mecze — to przywróci bug duplikatów.
- Po każdej zmianie dotyczącej meczów/punktów — przetestuj `/mecze`, `/tabela`, `/admin`.
- Jeśli lokalne pliki (ten `CLAUDE.md`, `AGENTS.md`, `PROJECT_MEMORY.md`) są sprzeczne z Vaultem (aktywny VAULT_ROOT od ETAP 20: `M:\Vault\02 Projekty\Typerzy Mundial 2026\`; fallback/backup lokalny: `C:\Users\micha\Vault\02 Projekty\Typerzy Mundial 2026\`) — **zatrzymaj się i zapytaj właściciela**, nie zgaduj które źródło jest aktualne.

---

## Architektura dual-mode

```
IS_PRODUCTION_MODE = Boolean(NEXT_PUBLIC_SUPABASE_URL?.match(/^https:\/\/[a-z0-9]+\.supabase\.co$/))
```

- **Mock** (`false`): MOCK_* z lib/mock-data.ts, zero API calls, localStorage
- **Produkcja** (`true`): Supabase PostgreSQL, cookie `typerzy_session` = profile UUID (httpOnly)

Trzy klienty Supabase:
- `lib/supabase/client.ts` — browser (anon key)
- `lib/supabase/server.ts` — SSR (cookie)
- `lib/supabase/admin.ts` — `createAdminClient()`, service role, **tylko serwer**

---

## Endpointy API

| Route | Metoda | Kto wywołuje |
|-------|--------|-------------|
| /api/auth/login | POST | strona logowania |
| /api/auth/me | GET | providers.tsx przy starcie |
| /api/auth/logout | POST | store.logout() |
| /api/predictions | POST | store.addPrediction/updatePrediction |
| /api/data/predictions | GET | providers.tsx |
| /api/admin/users | GET, PATCH | AdminPanel |
| /api/admin/matches | PATCH | AdminPanel |
| /api/sync-matches | POST/GET | Vercel Cron + AdminPanel |
| /api/sync-results | POST/GET | Vercel Cron + AdminPanel |
| /api/recalculate-points | POST/GET | Vercel Cron + AdminPanel |
| /api/sync-standings | POST/GET | Vercel Cron + AdminPanel |

Cron endpointy: dual auth — `Bearer CRON_SECRET` LUB admin session cookie.

---

## Pliki kluczowe

- `lib/tournament-config.ts` — IS_PRODUCTION_MODE + stałe
- `lib/store.ts` — loginAsync, bulk setters, fire-and-forget writes
- `lib/supabase/admin.ts` — createAdminClient()
- `components/providers.tsx` — hydratacja stanu z Supabase
- `types/index.ts` — wszystkie typy
- `lib/scoring.ts` — calculateMatchPoints()
- `app/(main)/layout.tsx` — auth guard

## DB column mapping (nie pomyl!)

`profiles.bonus_points_total` (DB) → `User.bonus_points` (TypeScript)
Mapowane w `mapRow()` w każdym API route czytającym profiles.

## Status

Build: ✅ `npm run build` — 0 błędów TypeScript, 22 routes
Następny krok: Deploy na Vercel (README krok 1–9)
