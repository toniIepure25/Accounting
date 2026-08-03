# ADR 0001 — Alegerea stack-ului tehnologic

**Stare:** acceptat · **Data:** Faza 0

## Context

Aplicația veche (KISS) e WPF/.NET, doar Windows, cu bază Access și cale hardcodată.
Cerințe pentru rescriere: cross-platform (Windows/macOS/Linux) + mobil + web opțional,
offline-first, UI profesional, maxim customizabilă (module pe verticale), toate cele 3
moduri de deployment (local / rețea / cloud) și un singur loc pentru regulile fiscale.

## Decizie

Monorepo **TypeScript** cu:

- **UI React + Vite + Tailwind** (design system propriu), partajat între desktop / web / mobil.
- **Tauri v2 (Rust)** ca shell desktop (binare mici, native, auto-update) și, ulterior, mobil.
- **PWA** din același build pentru web opțional.
- **SQLite** local (offline-first) prin plugin-ul SQL Tauri; **PostgreSQL** pentru rețea/cloud.
- Nucleu de business în **`@gr/core-domain`** (bani în întregi, TVA, entități) + viitorul
  **`@gr/fiscal-ro`** — sursă unică de adevăr pentru reguli.
- Strat de date **abstract și comutabil** (`SqlExecutor` / `DataProvider`) → UI-ul nu depinde de backend.

## Alternative respinse

- **Flutter** — un singur cod pentru toate țintele, dar ecosistem mai slab pentru grile de
  date dense, tipărire și PDF (critice la contabilitate); web-ul nu iese „gratis".
- **Avalonia (C#)** — ar păstra limbajul, dar ecosistem de componente UI mai restrâns și
  fără cale naturală spre web/PWA pentru propagarea update-urilor.
- **Electron** — matur, dar binare grele și consum de memorie mare.

## Consecințe

- Un singur limbaj (TS) de la UI la reguli de business; talent pool mare.
- Web-ul reutilizează UI-ul → update fiscal făcut o dată, propagat peste tot.
- Build-ul desktop nativ necesită toolchain per-OS (rulat local / în CI), nu în acest mediu.
- Pachetele interne folosesc sursa TS direct (transpilată de Vite/Vitest) — fără pas de build separat.
