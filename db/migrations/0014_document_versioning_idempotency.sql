-- Phase 4: blocare optimista (version), constrangere unica de numerotare si
-- magazie de idempotenta. Impreuna garanteaza zero numere/postari duplicate sub
-- concurenta + reincercari.

-- 1. Blocare optimista: contorul de versiune al documentului. Comenzile care
-- modifica un document verifica `expectedVersion` si incrementeaza `version` la
-- scriere; o versiune invechita => conflict (409), nu last-write-wins.
ALTER TABLE documente ADD COLUMN version INTEGER NOT NULL DEFAULT 1;

-- 2. Numar unic per (firma, tip, an, serie) — BACKSTOP la nivel de DB pentru
-- alocatorul de numere (serii_documente). Chiar daca doua cai ar aloca acelasi
-- numar (bug, race, retea), a doua inserare/actualizare esueaza pe constrangere.
-- Doar documentele NUMEROTATE (numar > 0); ciornele au numar 0 si serie '' si nu
-- trebuie sa colizioneze intre ele. Anul se extrage din `data` (ISO YYYY-...).
-- Index partial + expresie: valabil pe SQLite si PostgreSQL.
CREATE UNIQUE INDEX IF NOT EXISTS ux_documente_numar
  ON documente (firma_id, tip, substr(data, 1, 4), serie, numar)
  WHERE numar > 0;

-- 3. Idempotenta comenzilor: o cheie (+ hash-ul cererii) -> raspunsul stocat.
-- O reincercare cu aceeasi cheie NU re-executa comanda (nu posteaza / nu aloca
-- numar de doua ori) — intoarce raspunsul memorat. Un hash diferit pe aceeasi
-- cheie semnaleaza o reutilizare gresita a cheii (conflict).
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key          TEXT PRIMARY KEY,
  request_hash TEXT NOT NULL,
  response     TEXT NOT NULL,
  created_at   TEXT NOT NULL
);
