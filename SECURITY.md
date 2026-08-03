# Politica de securitate

Securitatea acestui produs este tratata ca o cerinta de baza, nu ca un adaos.
Aplicatia gestioneaza date contabile si date cu caracter personal (CNP-uri de
angajati, date ale partenerilor), deci o problema de securitate poate avea
consecinte reale pentru firmele care o folosesc.

## Raportarea unei vulnerabilitati

Daca ai descoperit o vulnerabilitate, **te rugam sa NU o publici intr-un issue
public**. Raporteaz-o privat:

- prin **GitHub Security Advisories** (fila *Security* → *Report a vulnerability*), sau
- prin e-mail la **iepuretoni533@gmail.com**, cu subiectul `[SECURITATE]`.

Include, in masura posibilului: o descriere a problemei, pasii de reproducere,
versiunea/commit-ul afectat si impactul estimat. Vei primi confirmare de
primire si vei fi tinut la curent cu remedierea.

Te rugam sa acorzi un termen rezonabil pentru remediere inainte de orice
divulgare publica (disclosure coordonat).

## Ce este deja acoperit

Rundele de securitate au tratat, cu verificare end-to-end, urmatoarele:

- **Autentificare si sesiuni**: parole hash-uite cu PBKDF2 (210k iteratii, sare
  per utilizator), token de sesiune semnat HMAC cu comparatie in timp constant,
  rate-limiting/lockout la login, logout cu revocare de token, verificarea
  contului activ la fiecare cerere.
- **Autorizare (RBAC)**: fiecare resursa/verb e verificat pe server, nu doar in
  UI; date sensibile (CNP-uri, bancar, mijloace fixe, plan de conturi) restranse
  pe permisiune; invariant "cel putin un administrator activ".
- **Integritatea datelor**: jurnal de audit append-only impus de server;
  inchidere de perioada contabila; scopare pe firma impusa autoritativ.
- **Iesiri sigure**: escaparea HTML in toate documentele tiparite (anti-XSS
  stocat) si neutralizarea formulelor la exportul CSV (anti CSV-injection).
- **Licentiere**: semnatura asimetrica ECDSA P-256 — cheia publica din client
  nu poate emite licente.
- **Transport si resurse**: CORS cu origine configurabila, limita de marime a
  corpului cererii.

Detaliile fiecarei masuri sunt in [README.md](README.md), sectiunile
"Runda de securitate" si "Autentificare & roluri".

## Limitari cunoscute (documentate onest)

Nu sunt vulnerabilitati, ci limite de arhitectura documentate explicit in
README ("Ce urmeaza"):

- revocarea de token si rate-limiting-ul sunt in-memory, per proces (necesita un
  store partajat la scalare pe mai multe instante);
- documentele legale (EULA/GDPR) sunt sabloane, de revizuit juridic;
- nu exista flux de e-mail (resetarea parolei se face de administrator).
