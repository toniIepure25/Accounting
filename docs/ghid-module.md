# Ghid — adăugarea unei verticale (modul)

Aplicația este modulară: nucleul nu cunoaște verticalele (Mobilă, HoReCa, Amanet…).
Fiecare modul își declară entitățile, ecranele și rutele, apoi se înregistrează.

Obiectivul: să poți crea un domeniu nou **rapid**, fără a atinge nucleul.

## Pași

1. **Entități + reguli** (dacă e cazul): adaugă scheme Zod și logică în `packages/core-domain`
   (sau într-un pachet dedicat `packages/modules/<domeniu>` pentru logică specifică).
   Exemplu existent: [`gestiune.ts`](../packages/core-domain/src/entities/gestiune.ts).

2. **Persistență**: adaugă tabelele în `db/migrations/000X_<domeniu>.sql` și un repository în
   `packages/data/src/repositories/`, apoi expune-l în `DataProvider`
   ([`provider.ts`](../packages/data/src/provider.ts)). Repository-ul SQL merge pe SQLite și Postgres.

3. **Ecrane**: creează paginile React în `packages/ui/src/pages/` (sau un folder de modul),
   refolosind design system-ul din [`components/ui.tsx`](../packages/ui/src/components/ui.tsx).

4. **Înregistrare**: adaugă un `AppModule` cu `NavItem`-urile lui în
   [`modules/registry.ts`](../packages/ui/src/modules/registry.ts). Atât — rutele și meniul
   apar automat, la fel și în command palette.

5. **Traduceri**: adaugă cheile în [`lib/i18n.tsx`](../packages/ui/src/lib/i18n.tsx) (RO + EN).

## Principii de customizare

- **Custom fields**: câmpuri suplimentare pe entitățile de bază, definite ca date (metadata),
  fără schimbare de cod (tabela `camp_personalizat`, Faza 1).
- **Serii de documente** configurabile — vezi
  [`document-numbering.ts`](../packages/core-domain/src/document-numbering.ts).
- **Feature flags / branding** per client (temă, logo, date firmă) — Faza 1.

Exemplul minim de referință: modulul „nomenclatoare" din `registry.ts`, cu ecranul
`Gestiuni` complet (grilă, căutare, date din `DataProvider`).
