# @gr/server — API REST (rețea / cloud)

Backend-ul pentru modurile de deployment **rețea locală (LAN)** și **cloud**.
Expune repository-urile din [`@gr/data`](../packages/data) peste HTTP, cu exact contractul
pe care clienții îl consumă prin `createApiProvider(baseUrl)`.

Face parte din workspace-ul npm rădăcină (`revamp/package.json` → `workspaces`), deci
`@gr/core-domain`/`@gr/data` se leagă automat prin symlink-uri npm — nu necesită un
`npm install` separat.

## Rulare rapidă (date demo în memorie, fără Postgres)

```bash
cd revamp && npm install && npm run dev:server
```
API pe `http://localhost:8787` — ex.: `GET /gestiuni`, `POST /parteneri`, `GET /health`,
`GET /ready`. Fără `DATABASE_URL`, pornește instant cu date demo **nepersistente**
(memorie) — util pentru probe rapide.

## Producție (PostgreSQL, cu Docker Compose)

```bash
docker compose up -d
```
Pornește **PostgreSQL 16** + serverul API ([docker-compose.yml](../docker-compose.yml),
[Dockerfile.server](../Dockerfile.server)). Serverul citește `DATABASE_URL`, rulează
**migrațiile din [`db/migrations`](../db/migrations) automat la boot** (idempotent, via
`migrate()` din `@gr/data`) și apoi servește peste `createSqlProvider`. Vezi
[src/db.ts](src/db.ts) — alege Postgres real sau memorie în funcție de `DATABASE_URL`.

Rulare manuală (fără Docker), cu un Postgres propriu:
```bash
DATABASE_URL=postgres://user:parola@localhost:5432/gestiune npm run dev:server
```

Repository-urile SQL sunt identice cu cele folosite pe desktop (SQLite); doar
`SqlExecutor`-ul diferă. Executorul PostgreSQL este în [src/pg-executor.ts](src/pg-executor.ts)
(`createPgExecutor(pool)`, convertește `?` → `$1`). Clientul (desktop/web/mobil) se
conectează setând modul de deployment pe `lan`/`cloud` și `target` = URL-ul API.

## Endpoint-uri

| Metodă/Rută | Descriere |
|---|---|
| `GET /health` | Liveness — procesul rulează |
| `GET /ready` | Readiness — verifică efectiv conexiunea la baza de date (503 dacă indisponibilă) |
| `GET/POST/PATCH/DELETE /<resursa>[/<id>]` | CRUD generic pe orice tabelă (gestiuni, parteneri, documente, firme, audit_log, ...) |
| `POST /numerotare/next` | Alocare **atomică** a următorului număr de document (`{ tipDocument, an, prefixImplicit, lungimeImplicita }`) |
| `POST /ai/chat` | Agent Claude — cheia API rămâne pe server |

## Integrare ANAF e-Factura (SPV)

[src/anaf-spv.ts](src/anaf-spv.ts) implementează fluxul oficial: `obtineToken` (OAuth2),
`incarcaFactura` (upload XML UBL), `verificaStare`, `descarcaRaspuns`. XML-ul îl produce
[`@gr/fiscal-ro`](../packages/fiscal-ro).

Autentificarea la `logincert.anaf.ro` cere **certificat digital calificat (mTLS)** — se
construiește un agent cu [src/mtls.ts](src/mtls.ts) (`agentMTLS({ pfx, passphrase })`) și se
pasează prin `config.dispatcher`. **Emitentul NU semnează XML-ul** e-Facturii: ANAF aplică
sigiliul ministerului după validare; mTLS + OAuth sunt cerința reală pentru trimitere.
