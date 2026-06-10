# Instrukcja publikacji — typerzy-mundial-2026

## 1. Supabase — uruchomienie bazy

W panelu Supabase → SQL Editor, wykonaj kolejno:

```
1. supabase/schema.sql      ← tabele
2. supabase/rls.sql         ← polityki dostępu
3. supabase/seed.sql        ← kody dostępu + admin + scoring_settings
```

**Weryfikacja po wykonaniu:**
```sql
SELECT nick, role, status FROM profiles;
-- Powinno być: admin, admin, active

SELECT code, is_active FROM access_codes;
-- Powinno być: TYPERZY2026 true, ADMIN true

SELECT key, value FROM scoring_settings ORDER BY key;
-- Powinno być: 7 wierszy z domyślnymi wartościami
```

---

## 2. GitHub — wypchnij kod

```bash
git init
git add .
git commit -m "feat: initial deploy"
git remote add origin https://github.com/TWOJ_NICK/typerzy-mundial-2026.git
git push -u origin main
```

---

## 3. Vercel — połącz projekt

1. Wejdź na vercel.com → New Project → Import z GitHub
2. Wybierz repo `typerzy-mundial-2026`
3. Framework preset: **Next.js** (wykryty automatycznie)
4. Kliknij **Deploy** (pierwszy build może się nie powieść bez env vars — to normalne)

---

## 4. Vercel — zmienne środowiskowe

W panelu Vercel → Project → Settings → Environment Variables dodaj:

| Nazwa | Wartość | Widoczność |
|-------|---------|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://XXXX.supabase.co` | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` (anon key) | Public |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` (service_role key) | **Server only** |
| `NEXT_PUBLIC_APP_URL` | `https://twoja-domena.vercel.app` | Public |
| `CRON_SECRET` | dowolny silny token (min. 32 znaki) | **Server only** |
| `FOOTBALL_API_PROVIDER` | `mock` | Public |
| `FOOTBALL_API_KEY` | *(zostaw puste)* | **Server only** |
| `FOOTBALL_API_BASE_URL` | *(zostaw puste)* | **Server only** |

**Klucze Supabase** znajdziesz w: Supabase → Settings → API

⚠ NIGDY nie wpisuj `SUPABASE_SERVICE_ROLE_KEY`, `FOOTBALL_API_KEY`, `CRON_SECRET` jako `NEXT_PUBLIC_*` — tylko backend je może widzieć.

Po dodaniu env vars → kliknij **Redeploy**.

---

## 5. Crons Vercel (vercel.json)

Zdefiniowane automatycznie przez `vercel.json`. Uruchamiają się:
- `sync-matches` — codziennie o 6:00
- `sync-results` — co 15 minut
- `recalculate-points` — co 15 minut
- `sync-standings` — co 3 godziny

Dopóki `FOOTBALL_API_PROVIDER=mock` i `FOOTBALL_API_KEY` jest puste, wszystkie sync-* zwracają `"API meczowe nie skonfigurowane — sync pominięty"` bez błędu. Przeliczanie punktów działa normalnie.

---

## 6. Checklist przed udostępnieniem użytkownikom

### Auth
- [ ] Login z nick=admin, code=ADMIN → wchodzi jako admin (bez pending)
- [ ] Admin nie pojawia się w "Oczekujący gracze" w panelu
- [ ] Login z nowym nickiem, code=TYPERZY2026 → status pending
- [ ] Admin akceptuje usera → user może się zalogować
- [ ] Login z błędnym kodem → komunikat "Nieprawidłowy kod dostępu"
- [ ] Zablokowany user → komunikat "Konto zablokowane"

### Typowanie
- [ ] Aktywny user widzi mecze i może wpisać typ
- [ ] Typ zapisuje się do bazy (tabela predictions)
- [ ] Mecz zablokowany po starcie → "Typowanie zablokowane"
- [ ] Zmiana typu przed startem meczu działa

### Panel admina
- [ ] Admin widzi listę oczekujących
- [ ] Akceptuj/Zablokuj zmienia status w bazie
- [ ] Edycja wyniku meczu zapisuje się (score_a, score_b, status)
- [ ] "Przelicz punkty" nie zwraca błędu
- [ ] Sync buttons pokazują czytelny komunikat

### Tabele i rankingi
- [ ] Tabela (grupy) wyświetla nazwy drużyn (nie puste)
- [ ] Leaderboard wyświetla graczy z punktami
- [ ] Strona bonusy ładuje wartości z scoring_settings

### Bezpieczeństwo
- [ ] /api/admin/* zwraca 401 dla niezalogowanych
- [ ] /api/admin/* zwraca 401 dla zwykłych userów
- [ ] Cookie typerzy_session jest httpOnly (nie widać w JS)
- [ ] SUPABASE_SERVICE_ROLE_KEY nie jest w żadnej odpowiedzi clienta

---

## 7. Czyszczenie testowych danych (opcjonalne)

Przed udostępnieniem realnym użytkownikom uruchom w Supabase SQL Editor:

```
supabase/cleanup-test-users.sql
```

Usuwa pending users i znane testowe nicki. Zachowuje wszystkich active.

W razie potrzeby pełnego resetu: `supabase/full-reset.sql` (⚠ kasuje wszystko).
