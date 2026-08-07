-- Phase 11: prospetimea sesiunii. `session_version` se include in tokenul de
-- sesiune la login; serverul respinge orice token cu o versiune mai veche decat
-- cea curenta a utilizatorului. Cresterea lui (schimbare de parola / delogare
-- fortata) invalideaza IMEDIAT toate sesiunile utilizatorului — fara sa astepte
-- expirarea naturala a tokenului (pana la 12h). Impreuna cu re-citirea rolului/
-- firmei la fiecare cerere, o schimbare de rol/firma/revocare are efect prompt
-- (RK-11).

ALTER TABLE utilizatori ADD COLUMN session_version INTEGER NOT NULL DEFAULT 1;
