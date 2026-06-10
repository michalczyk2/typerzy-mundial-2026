# TODO — Typerzy Mundial 2026

## ✅ MVP (ukończone)

- [x] Struktura projektu Next.js 16 + TS + Tailwind v4
- [x] Typy TypeScript (types/index.ts)
- [x] Utilities + scoring (lib/utils.ts, lib/scoring.ts)
- [x] Mock data (lib/mock-data.ts)
- [x] Zustand store z loginiem (lib/store.ts)
- [x] UI komponenty (Badge, Button, Card, FlagImg)
- [x] Layout (Header, Navigation)
- [x] Match komponenty (MatchCard, PredictionForm)
- [x] Leaderboard tabela
- [x] Group standings tabela
- [x] Admin panel
- [x] Strona logowania
- [x] Mecze + typowanie (/mecze)
- [x] Tabela typerów (/tabela)
- [x] Moje typy (/moje-typy)
- [x] Grupy (/grupy)
- [x] Bonusy (/bonusy)
- [x] Admin panel (/admin)
- [x] Supabase schema + RLS + seed SQL (bez auth.uid())
- [x] .env.example
- [x] vercel.json z cron jobs

## ✅ Produkcja (ukończone 2026-06-10)

- [x] IS_PRODUCTION_MODE auto-detekcja (lib/tournament-config.ts)
- [x] createAdminClient() — service role, server only (lib/supabase/admin.ts)
- [x] Auth API: POST /api/auth/login (nick + kod → cookie typerzy_session)
- [x] Auth API: GET /api/auth/me (odczyt sesji)
- [x] Auth API: POST /api/auth/logout (kasowanie cookie)
- [x] Predictions API: POST /api/predictions (upsert)
- [x] Predictions API: GET /api/data/predictions (moje typowania)
- [x] Admin API: GET/PATCH /api/admin/users
- [x] Admin API: PATCH /api/admin/matches
- [x] Cron: /api/sync-matches (dual auth: Bearer CRON_SECRET + admin cookie)
- [x] Cron: /api/sync-results
- [x] Cron: /api/recalculate-points (pełna implementacja)
- [x] Cron: /api/sync-standings
- [x] lib/store.ts — dual-mode (loginAsync, bulk setters, fire-and-forget)
- [x] components/providers.tsx — hydratacja stanu z Supabase w trybie produkcji
- [x] app/page.tsx — async login z loading state
- [x] AdminPanel — sync buttons z feedback statusem
- [x] npm run build ✅ 0 błędów TypeScript
- [x] README.md — 16-krokowy deploy guide
- [x] SESSION_CONTEXT.md

## 🔄 Następne kroki (deploy)

- [ ] **Utwórz projekt Supabase** → uruchom schema.sql, rls.sql, seed.sql
- [ ] **Ustaw env vars na Vercel** (6 zmiennych — patrz README krok 6)
- [ ] **Deploy na Vercel** → zweryfikuj cron jobs
- [ ] Zaproś graczy, przetestuj login + flow typowania
- [ ] Zaakceptuj pierwszych graczy z panelu admina

## 📋 Backlog

- [ ] Zaimplementować sync-matches z prawdziwym football API (`FOOTBALL_API_KEY`)
- [ ] Zaimplementować sync-results z prawdziwym football API
- [ ] Typowanie mistrza turnieju (UI + endpoint)
- [ ] Bonusy automatyczne (round_king, streak) po recalculate-points
- [ ] Push notifications (nowe wyniki)
- [ ] Statystyki graczy (wykres)
- [ ] Eksport do CSV
- [ ] Testy E2E (Playwright)
