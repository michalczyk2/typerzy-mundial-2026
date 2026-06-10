# Typerzy Mundial 2026

Prywatna liga typowania FIFA World Cup 2026 dla znajomych.

## Stack

- **Next.js 16** + TypeScript (App Router)
- **Tailwind CSS v4**
- **Supabase** (PostgreSQL, bez Supabase Auth — własny system sesji)
- **Zustand v5** (client state)
- **Vercel** (deployment + cron jobs)

## Tryby działania

| Tryb | Kiedy | Dane |
|------|-------|------|
| **Lokalny (mock)** | `NEXT_PUBLIC_SUPABASE_URL` nie ustawiony lub placeholder | MOCK_* z `lib/mock-data.ts` |
| **Produkcja** | `NEXT_PUBLIC_SUPABASE_URL` = `https://<id>.supabase.co` | Supabase PostgreSQL |

Detekcja automatyczna — `IS_PRODUCTION_MODE` w `lib/tournament-config.ts`.

---

## Deploy na Vercel — krok po kroku

### 1. Utwórz projekt Supabase

Wejdź na [supabase.com](https://supabase.com) → New project. Zapamiętaj:
- Project URL: `https://<project-id>.supabase.co`
- Anon key (bezpieczny dla frontendu)
- Service role key (**TYLKO serwer, nigdy frontend**)

### 2. Uruchom schemat bazy danych

W Supabase → SQL Editor, uruchom kolejno (wklej zawartość każdego pliku):

```
supabase/schema.sql   → tabele, indeksy, triggery
supabase/rls.sql      → Row Level Security
supabase/seed.sql     → Michał admin active + kod TYPERZY2026
```

> seed.sql używa `ON CONFLICT DO UPDATE` — bezpieczne do wielokrotnego uruchomienia.
> Jeśli Michał istniał wcześniej jako `pending`, seed zaktualizuje go do `admin/active`.

### 3. Wygeneruj CRON_SECRET

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Zapisz wynik — będzie potrzebny w kroku 6.

### 4. Wrzuć repo na GitHub

```bash
git init
git add .
git commit -m "feat: initial production-ready app"
git remote add origin https://github.com/<user>/typerzy-mundial-2026.git
git push -u origin main
```

### 5. Utwórz projekt na Vercel

Wejdź na [vercel.com](https://vercel.com) → New Project → importuj z GitHub.

Framework: **Next.js** (wykryty automatycznie).

### 6. Ustaw zmienne środowiskowe na Vercel

W Vercel → Settings → Environment Variables dodaj:

| Zmienna | Wartość | Uwaga |
|---------|---------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<id>.supabase.co` | wszystkie env |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key z Supabase | wszystkie env |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key | **serwer only — nigdy NEXT_PUBLIC_** |
| `CRON_SECRET` | wygenerowany w kroku 3 | **serwer only — nigdy NEXT_PUBLIC_** |
| `NEXT_PUBLIC_APP_URL` | `https://<twoja-domena>.vercel.app` | wszystkie env |
| `FOOTBALL_API_PROVIDER` | `mock` | wszystkie env |

### 7. Deploy

Vercel zdeployuje automatycznie po push na `main`. Możesz też kliknąć **Redeploy** ręcznie.

### 8. Sprawdź pierwsze logowanie

Otwórz `https://<twoja-domena>.vercel.app` → zaloguj się:
- Nick: `Michał`
- Kod: `TYPERZY2026`

Konto admina z seed.sql jest już aktywne. Jeśli seed.sql nie był uruchomiony — przejdź do kroku 10.

### 9. Zweryfikuj cron jobs

W Vercel → Settings → Cron Jobs — sprawdź że są aktywne:

| Endpoint | Harmonogram |
|----------|-------------|
| `/api/sync-matches` | `0 6 * * *` (raz dziennie) |
| `/api/sync-results` | `*/15 * * * *` (co 15 min) |
| `/api/recalculate-points` | `*/15 * * * *` (co 15 min) |
| `/api/sync-standings` | `0 */3 * * *` (co 3 godziny) |

Cron jobs wywołują endpointy z nagłówkiem `Authorization: Bearer <CRON_SECRET>`.

### 10. Ręczna aktywacja konta admina (jeśli nie uruchomiono seed.sql)

W Supabase → Table Editor → `profiles` → edytuj swój wiersz:
- `status`: `active`
- `role`: `admin`

### 11. Zaproś graczy

Udostępnij kod dostępu `TYPERZY2026`. Gracze wchodzą na stronę, wpisują swój nick + kod → konto tworzy się jako `pending`.

### 12. Akceptuj graczy

Zaloguj się jako admin → `/admin` → sekcja "Oczekujący gracze" → kliknij **Akceptuj**.

### 13. Test lokalny z produkcyjną bazą

```bash
cp .env.example .env.local
# uzupełnij .env.local prawdziwymi kluczami Supabase
npm run dev
```

Aplikacja automatycznie wykryje produkcyjny URL Supabase i przełączy się w tryb produkcyjny.

### 14. Lokalny test buildu

```bash
npm run build
npm run typecheck
```

Oba muszą przejść bez błędów TypeScript.

### 15. Ręczna synchronizacja przez panel admina

Po zalogowaniu jako admin → `/admin` → sekcja "Synchronizacja danych":
- **Sync mecze** — wyzwala `/api/sync-matches`
- **Sync wyniki** — wyzwala `/api/sync-results`
- **Przelicz punkty** — przelicza punkty dla skończonych meczów
- **Sync grupy** — wyzwala `/api/sync-standings`

Przyciski działają przez session cookie (bez CRON_SECRET po stronie klienta).

### 16. Monitoring

- Vercel → Deployments — logi buildów
- Vercel → Functions — logi API routes i cron jobs
- Supabase → Table Editor → `sync_logs` — historia każdej synchronizacji

---

## Uruchomienie lokalne (tryb mock)

```bash
npm install
npm run dev
```

Otwórz [http://localhost:3000](http://localhost:3000). Zaloguj się: nick `Michał`, kod `TYPERZY2026`.

Bez `.env.local` z prawdziwym URL Supabase aplikacja działa w trybie mock — dane z `lib/mock-data.ts`, zero połączeń z bazą.

---

## Punktacja

| Zdarzenie | Punkty |
|-----------|--------|
| Trafna końcówka (W/R/P) | 3 pkt |
| Dokładny wynik | 5 pkt |
| Król kolejki (maks. punktów w rundzie) | +3 pkt |
| Passa 3 trafień z rzędu | +2 pkt |
| Passa 5 trafień z rzędu | +5 pkt |
| Ryzykowny typ (jedyna trafna prognoza) | +2 pkt |
| Trafny typ na mistrza turnieju | +20 pkt |

---

## Kluczowe pliki

```
lib/
  tournament-config.ts      # IS_PRODUCTION_MODE + stałe turnieju
  store.ts                  # Zustand: loginAsync, settery bulk, fire-and-forget
  supabase/
    client.ts               # Frontend (anon key)
    server.ts               # SSR (cookie-based)
    admin.ts                # Server-only (service role, bypasses RLS)
app/api/
  auth/login/               # POST: nick + kod → cookie typerzy_session
  auth/me/                  # GET: odczyt sesji z cookie
  auth/logout/              # POST: kasuje cookie
  predictions/              # POST: upsert typowania
  data/predictions/         # GET: typowania zalogowanego gracza
  admin/users/              # GET/PATCH: zarządzanie graczami (admin)
  admin/matches/            # PATCH: wyniki meczów (admin)
  sync-matches/             # POST/GET: sync mecze (cron lub admin)
  sync-results/             # POST/GET: sync wyniki (cron lub admin)
  recalculate-points/       # POST/GET: przelicz punkty
  sync-standings/           # POST/GET: sync tabela grup
supabase/
  schema.sql                # Tabele + indeksy + triggery
  rls.sql                   # RLS bez auth.uid() — własna autentykacja
  seed.sql                  # Michał admin + kod TYPERZY2026
```

## Zmienne środowiskowe

```bash
# .env.example — skopiuj do .env.local i uzupełnij
NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder
SUPABASE_SERVICE_ROLE_KEY=           # NIGDY NEXT_PUBLIC_
CRON_SECRET=                         # NIGDY NEXT_PUBLIC_
NEXT_PUBLIC_APP_URL=http://localhost:3000
FOOTBALL_API_PROVIDER=mock
```
