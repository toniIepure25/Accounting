# Jurnal de modificari

Formatul urmeaza, in linii mari, [Keep a Changelog](https://keepachangelog.com/ro/).
Produsul e livrat incremental pe faze; fiecare faza ramane utilizabila.

## [Nelansat]

### Faza 17 — Comercializare (produs vandabil)
- Model de licentiere comercial: planuri (Esential/Profesional/Enterprise),
  limita de utilizatori impusa **si server-side**, licente de trial, expirare cu
  avertisment + perioada de gratie, apoi mod doar-citire (datele raman
  consultabile si exportabile).
- Ecran de administrare utilizatori (creare, rol, activare/dezactivare, resetare
  parola) cu protectie anti-lockout impusa de server.
- Schimbarea propriei parole (cu revocarea tokenului curent).
- Wizard de configurare initiala la prima pornire.
- Documente legale in aplicatie (EULA + informare GDPR).
- Performanta: code-splitting pe ruta (bundle initial ~515 KB → ~372 KB).
- Fix: mesajele de eroare ale serverului nu mai sunt inlocuite cu coduri HTTP brute.

### Faza 16 — Securitate
- Semnatura licentei trecuta de la HMAC simetric la **ECDSA P-256 asimetric**.
- XSS stocat eliminat (escapeHtml in toate documentele tiparite); CSV/formula
  injection neutralizat.
- Server: secret de sesiune fara fallback hardcodat, rate-limiting la login,
  logout cu revocare de token, verificarea contului activ, RBAC pe date
  sensibile, comparatie in timp constant a semnaturii, CORS configurabil, limita
  de marime a corpului cererii, audit-log append-only.

### Faza 15 — Profesionalizare UX/robustete
- ErrorBoundary global, sistem de toast-uri, dialog de confirmare stilizat,
  stari de incarcare reale, accesibilitate (aria-label, focus management).

### Faza 14 — White-label + Dashboard operational real
- Branding per firma (logo, culoare, nume) aplicat runtime si pe documente.
- Tablou de bord cu date reale (stoc, casa/banca, creante, comenzi Mobila).

### Faza 13 — Multi-firma cu scopare reala
- `firmaId` pe entitatile tranzactionale; filtrare + stampilare impuse si pe
  server; reincarcare automata la comutarea firmei.

### Faza 12 — Adancire modul Mobila
- Reguli de configurator, nesting real pe sarja + export CNC, planificare
  productie pe departamente, agenda livrare + montaj.

### Faza 11 — Calitate: teste UI + e2e + CI
- Teste de componenta (Testing Library), e2e Playwright, workflow CI.

### Faza 10 — Fiscal aprofundat
- e-Factura B2C (CNP), inchidere de perioada, mijloace fixe, registre legale,
  D300/D394/D390, banca (import extras + reconciliere).

### Faza 8-9 — Fundatie de productie + flux Mobila
- Autentificare server-side reala + RBAC, numerotare atomica, jurnal de audit,
  backup/restore, multi-firma, motor de sincronizare; flux comanda complet cu
  garzi de stare si documente auto-generate.

### Fazele 0-7 — Fundatie si nucleu
- Monorepo TypeScript, design system, strat de date comutabil (SQLite/Postgres/
  API), i18n RO/EN, shell Tauri; nucleu de gestiune + contabilitate in partida
  dubla; modul Mobila; fiscal RO (CUI, e-Factura, decont, SAF-T); PWA;
  licentiere pe editii; asistent AI; nesting/debitare.
