<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:obsidian-vault-agent-rules -->
# Obsidian Vault Documentation

This repository is for the Typerzy Mundial 2026 project.

Active VAULT_ROOT (since ETAP 20, 2026-06-17): M:\Vault
Local fallback/backup (not to be deleted): C:\Users\micha\Vault

The main project documentation is located at:
M:\Vault\02 Projekty\Typerzy Mundial 2026

Global agent rules are located at:
M:\Vault\AGENTS.md

Reusable prompts are located at:
M:\Vault\99 System\Prompts

Before larger changes, Codex must read:
- M:\Vault\AGENTS.md
- M:\Vault\99 System\VAULT_STATUS.md
- M:\Vault\99 System\ACTIVE_TASK.md
- the Typerzy Mundial 2026 project documentation in the Vault
- PROJECT_MEMORY.md for this project, if it exists
- PROJECT_STATUS.md, if it exists
- NEXT_ACTIONS.md, if it exists

Codex must not reorganize the Vault.

Codex must not edit global Vault files when the task only concerns website code.

After work, Codex must prepare a change report with:
- what changed
- which files changed
- whether tests/build passed
- what should be added to the Vault journal

If the task concerns documentation, Codex may propose a Vault entry, but must not mix the 00-99 structure.

If a file is blocked in ACTIVE_TASK.md, Codex must not edit it.
<!-- END:obsidian-vault-agent-rules -->

<!-- BEGIN:krytyczne-zasady-bezpieczenstwa-danych -->
## KRYTYCZNE ZASADY BEZPIECZEŃSTWA DANYCH

- Nie wykonuj DELETE na `predictions` bez wyraźnej zgody właściciela.
- Przed każdą masową zmianą UPDATE/DELETE w Supabase — zrób backup lub przynajmniej pełny SELECT/audyt zmienianych rekordów.
- Duplikaty meczów po integracji WC26 zostały historycznie naprawione przez archiwizację osieroconych `ofb_*` (`is_archived = true`), nie przez DELETE. Nie powtarzaj pierwotnego planu DELETE.
- Logika aplikacji ma używać aktywnych `wc26_%` i pomijać wiersze z `is_archived = true`.
- Nigdy nie przywracaj starego zachowania, które mieszało `wc26_*` i `ofb_*` jako aktywne mecze.
- Po każdej zmianie dotyczącej meczów/punktów — przetestuj `/mecze`, `/tabela`, `/admin`.
- Jeśli lokalne pliki są sprzeczne z Vaultem — zatrzymaj się i zapytaj właściciela.
<!-- END:krytyczne-zasady-bezpieczenstwa-danych -->
