# Ghid de contributie

Multumim pentru interes. Acest document descrie cum sa pornesti mediul de
dezvoltare si ce standarde de calitate se aplica.

> **Notita de licenta**: acesta este un produs comercial (vezi [LICENSE](LICENSE)).
> Consultarea codului si contributiile in scop de evaluare/audit sunt binevenite;
> utilizarea in productie necesita o licenta valida.

## Cerinte

- **Node.js ≥ 20** si **npm 10** (folosim npm workspaces).
- Pentru build-ul desktop nativ: **Rust** (stabil) + toolchain-ul Tauri al
  sistemului (WebView2 pe Windows, WebKitGTK pe Linux, Xcode CLT pe macOS).

## Pornire rapida

```bash
npm install            # instaleaza tot workspace-ul (monorepo)
npm run dev            # server de dezvoltare UI (http://localhost:1420)
```

Utilizator demo (mod local, fara parola): alege un rol la ecranul de login.

## Comenzi utile

```bash
npm test               # teste unitare + de componenta (turbo, toate pachetele)
npm run typecheck      # verificare de tipuri (toate pachetele)
npm run lint           # biome (lint + format check)
npm run format         # biome format --write (aplica formatarea)
npm run build:web      # build web/PWA
npm run test:e2e       # Playwright (porneste automat dev-serverul)
npm run dev:server     # API-ul de retea/cloud (server/)
```

## Standarde

- **Un singur formatter/linter**: [Biome](https://biomejs.dev). Ruleaza
  `npm run format` inainte de commit; CI respinge codul neformatat.
- **TypeScript strict**: fara `any` nejustificat; `npm run typecheck` trebuie sa
  fie verde.
- **Testare**: logica de domeniu (bani, TVA, stoc, contabilitate, fiscal) se
  testeaza cu Vitest; fluxurile-cheie de UI cu Playwright. Orice corectie de bug
  vine cu un test care ar fi prins bug-ul.
- **Reguli fiscale intr-un singur loc**: modificarile legislative se fac in
  `packages/core-domain` / `packages/fiscal-ro`, ca sa se propage identic la
  desktop / web / mobil.
- **Comentarii**: explica *de ce*, nu *ce*. Codul e in romana (domeniu contabil
  romanesc); pastreaza consecventa.

## Structura pe scurt

Vezi [README.md](README.md) pentru harta completa a pachetelor. Pe scurt:
`core-domain` (reguli pure) → `data` (repository-uri/adaptoare) →
`ui` (React, partajat pe toate platformele); `fiscal-ro`, `auth`, `license`,
`ai`, `sync` sunt pachete transversale; `server/` e API-ul optional de retea.

## Flux de lucru

1. Creeaza un branch din `main`.
2. Fa modificarea + testele aferente.
3. Ruleaza local: `npm run lint && npm run typecheck && npm test`.
4. Deschide un Pull Request; CI ruleaza automat aceleasi verificari + e2e.

Vulnerabilitatile de securitate se raporteaza privat — vezi [SECURITY.md](SECURITY.md).
