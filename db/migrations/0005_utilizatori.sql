-- Conturi de utilizatori pentru autentificare server-side reala (POST /auth/login).
-- Separat de simularea client-side folosita in modul demo/local fara server.

CREATE TABLE IF NOT EXISTS utilizatori (
  id           TEXT PRIMARY KEY,
  nume         TEXT NOT NULL,
  parola_hash  TEXT NOT NULL,
  rol          TEXT NOT NULL,
  firma_id     TEXT,
  activ        INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_utilizatori_nume ON utilizatori(nume);
