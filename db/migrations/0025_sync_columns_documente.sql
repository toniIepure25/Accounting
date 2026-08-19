-- Ultimele coloane de sincronizare: pe documente + liniile lor. `documente` are
-- DEJA `version` (blocarea optimista, migratia 0014) — refolosita si pentru sync;
-- primeste doar `updated_at` + `deleted_at`. `documente_linii` primeste toate trei.
--
-- ATENTIE: pe documente, `version` e stampilat de MOTORUL de comenzi (@gr/application:
-- fiecare tranzitie de stare face +1, sub blocare optimista). Repository-ul generic
-- pastreaza `version`/`updatedAt` cand sunt date EXPLICIT (calea verbatim), deci
-- comenzile raman autoritare — vezi stampilarea `updatedAt` din lifecycle/post-document.

ALTER TABLE documente ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
ALTER TABLE documente ADD COLUMN deleted_at TEXT;

ALTER TABLE documente_linii ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE documente_linii ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
ALTER TABLE documente_linii ADD COLUMN deleted_at TEXT;
