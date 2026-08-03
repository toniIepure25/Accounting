# Gestiune & Contabilitate — rescriere (revamp)

Rescriere de la zero a aplicației KISS (WPF/.NET, doar Windows, bază Access) într-o
aplicație **cross-platform, offline-first, modulară**, cu UI modern.

- **Rulează pe** Windows, macOS, Linux (desktop, prin Tauri v2). Pregătită pentru mobil și web (PWA).
- **Offline-first**: date locale în SQLite; funcționează fără internet.
- **Modulară**: nucleu de gestiune + contabilitate peste care se adaugă verticale (Mobilă, HoReCa, Amanet…).
- **Un singur nucleu de reguli** (`@gr/core-domain` + viitorul `@gr/fiscal-ro`): o modificare
  fiscală/legislativă se face o dată și se propagă la desktop / mobil / web.

> Aplicația veche din `D:\contabilitate\KISS` **nu este modificată**. Tot codul nou trăiește aici, în `revamp/`.

## Stadiu (roadmap)

| Fază | Conținut | Stare |
|---|---|---|
| **0. Fundație** | Monorepo, design system, rutare, i18n RO/EN, temă light/dark, strat de date comutabil, migrații SQLite, shell Tauri | ✅ implementată |
| **1. Nucleu gestiune + contabilitate** | Parteneri, produse/materiale/mărfuri, grupe, liste prețuri, plan de conturi, tip consum, personal, preparate/rețete; recepții (NIR), bonuri, transferuri, plus/minus, facturi, vânzări, avize, proforme; motor de stoc (CMP), fișe de magazie, balanțe stocuri, rulaje, reevaluare, jurnale, balanțe parteneri, casă | ✅ implementată |
| **2. Modul Mobilă (far)** | Configurator preț live (dimensiuni/materiale/finisaje/accesorii), comenzi cu avans, panou de producție pe stări, planificare livrări, opțiuni configurator | ✅ implementată |
| **3. Fiscal RO** | Validare CUI, **e-Factura** (UBL 2.1/CIUS-RO), **decont TVA**, **SAF-T (D406)**, factură printabilă (PDF) | ✅ implementată |
| **4. Rețea/server (LAN/cloud)** | Adaptor `createApiProvider` (REST) + server API ([`server/`](server)); **executor PostgreSQL** + **conector ANAF SPV** (OAuth2/upload/status) | ✅ schelet funcțional |
| **5. Web (PWA)** | Service worker + manifest (instalabil, offline) prin `vite-plugin-pwa` | ✅ implementată |
| 6. Mobil (iOS/Android) | Aceeași aplicație Tauri v2 + UI partajat; ținte activate cu `tauri android/ios init` | ▶ pregătită ([apps/mobile](apps/mobile/README.md)) |
| **7. Nesting/debitare + Auth/RBAC** | Optimizare debitare PAL/MDF (guillotine + diagramă de tăiere), calcul cant, BOM feronerie, reguli de configurator; **autentificare + roluri** (admin/contabil/gestionar/casier/vânzător) cu blocare pe permisiune | ✅ implementată |
| **8. Fundație de producție (LAN)** | Server **PostgreSQL real** (migrații automate la boot) + `docker-compose`, **numerotare atomică** de documente, **jurnal de audit**, **backup/restore**, **multi-firmă**, **motor de sincronizare** cablat (orchestrator + verificare conectivitate) | ✅ implementată |
| **8-bis. Audit flux/logică + securitate reală** | **Autentificare server-side reală** (`POST /auth/login` + middleware RBAC pe fiecare cerere — vezi [server/src/auth.ts](server/src/auth.ts), înlocuiește RBAC-ul care înainte era doar decorativ în UI); corecții de logică găsite prin audit: cost CMP corect la bonul de consum (nu prețul de vânzare), legătură NIR↔factură furnizor (3-way match, fără dublă contabilizare), an de numerotare imutabil la editare, permisiuni reale pe validare/ștergere document | ✅ implementată |
| **9. Adâncire Mobilă** | Flux complet **cu gărzi de stare** oferta→confirmată→în producție→finalizată→livrată→facturată: confirmarea încasează avansul (casă reală), intrarea în producție **generează automat bonul de consum** din BOM real (materiale legate de catalog prin `produsId`) și **consumă stoc real la CMP** (blochează tranziția dacă stocul e insuficient), livrarea generează avizul, facturarea generează factura de vânzare — toate legate de comandă prin `documentSursaId`. Cost real (material CMP + manoperă) și **marjă pe comandă**; **deviz PDF** pentru oferte | ✅ implementată |
| **10. Fiscal — e-Factura B2C + închidere de perioadă** | **e-Factura pentru persoane fizice** (CNP, fără CUI — obligatoriu B2C ≥10.000 lei din 2025, extins la PFA/CNP din iunie 2026); **închidere de perioadă**: documentele dintr-o perioadă închisă nu mai pot fi validate/editate/șterse de niciun rol (nici admin), impusă atât server-side cât și în UI | ✅ implementată |
| **10-bis. Contabilitate aprofundată** | **Mijloace fixe** (amortizare liniară/degresivă, notă de amortizare `681`/`281` integrată în partida dublă); registre legale complete — **Registru-jurnal** (print/PDF), **Cartea mare** (toate conturile), **Registru-inventar**; **D300 detaliat pe cote TVA**, **D394**, **D390 (VIES)** ca declarații de lucru; **audit log append-only** impus de server (nicio modificare/ștergere, nici pentru admin); **Bancă**: import extras CSV + reconciliere automată (idempotentă) și manuală | ✅ implementată |
| **11. Calitate: teste UI + e2e + CI** | Teste de componentă (`@testing-library/react` + `vitest`/jsdom) pentru `Gated`, `EntityGrid`, `DocumentEditor`; **Playwright** cu 2 teste e2e reale rulate local (autentificare, creare document) peste UI-ul real în Chromium; `.github/workflows/ci.yml` (lint+typecheck+test+build+e2e) | ✅ implementată |
| **12. Modul Mobilă — adâncire** | **Reguli de configurator** (dimensiuni min/max + combinații material×finisaj interzise) validate live, cu ecran de administrare; **permisiune reală** (`documente.creare`) la crearea comenzii din configurator (lipsea complet); **nesting real pe șarjă** — combină piesele mai multor comenzi confirmate/în producție pe aceleași plăci (aici e economia reală de material) + **export CNC (CSV)**; **planificare producție pe departamente** (debitare→cant→CNC→vopsitorie→montaj) cu panou de capacitate, obligatorii înaintea trecerii la „Finalizată”; **agendă livrare + montaj** (calendar lunar) + curier/AWB editabile | ✅ implementată |
| **13. Multi-firmă — scopare reală** | `firmaId` pe documente/casă/bancă/mijloace fixe + a doua firmă demo pentru probă; **stampilare automată la creare** + **filtrare la citire** (client, prin `withFirmaScope`) — impuse **și pe server** (`server/src/index.ts`, 404 pe rânduri din altă firmă, firma vine din sesiune nu din cerere); nomenclatoarele rămân comune deliberat | ✅ implementată |
| **14. White-label per firmă + Dashboard operațional real** | **Branding per firmă** (logo, culoare primară, nume aplicație afișat) editabil din Setări, aplicat runtime în Sidebar/titlul paginii și pe documentele tipărite (factură, deviz) — instalarea poate fi prezentată/vândută sub identitatea vizuală a fiecărui client; **Tablou de bord** rescris de la zero cu date **reale** (înainte erau cifre hardcodate): valoare stoc, sold casă/bancă, sold clienți de încasat, alertă stoc sub minim, comenzi Mobilă pe stadiu, capacitate producție pe departament, livrări/montaj din următoarele 7 zile | ✅ implementată |
| **15. Profesionalizare UX/robustețe** | **`ErrorBoundary`** global (un ecran brandat, nu crash-ul brut React Router); **sistem de toast-uri** (succes/eroare/info) care înlocuiește `alert()`-urile native și mesajele ad-hoc inconsistente din toată aplicația; **dialog de confirmare stilizat** (`useConfirm`) care înlocuiește `confirm()` nativ la orice acțiune distructivă; **stare de încărcare reală** în `DataTable`/`EntityGrid`/`DocumentEditor` (nu mai arată fals „fără înregistrări” înainte ca datele să ajungă); `try/catch` + toast de eroare pe toate salvările; **accesibilitate**: `title`/`aria-label` pe butoanele doar-cu-icoană, `Modal` cu `role="dialog"`, focus mutat în dialog la deschidere și restaurat la închidere, capcană de tastatură (Tab nu iese din dialog) | ✅ implementată |
| **17. Comercializare (produs vandabil)** | **Model de licentiere comercial**: planuri (Esential/Profesional/Enterprise), **limita de utilizatori** impusa si server-side, licente de **trial**, expirare cu **avertisment + perioada de gratie**, iar dupa expirare **mod doar-citire** (datele raman consultabile si exportabile); **administrare utilizatori** (ecran nou: creare cont, rol, activare/dezactivare, resetare parola, protectie anti-lockout); **schimbarea propriei parole**; **wizard de configurare initiala** la prima pornire; **documente legale** (EULA + informare GDPR) in aplicatie; **code-splitting pe ruta** (bundle initial 515 KB → 372 KB) | ✅ implementată |
| **16. Runda de securitate** | **XSS** (`escapeHtml` în toate funcțiile de print — factură, deviz, registre, rapoarte) și **CSV/formula injection** (`csvField` în toate exporturile) eliminate; audit de securitate dedicat pe server → **secret de sesiune** nu mai are fallback hardcodat, **rate limiting**/lockout la login, **logout + revocare token**, verificare `utilizator.activ` pe fiecare cerere, **RBAC** extins pe date sensibile (personal/bancă/mijloace fixe/plan de conturi), comparație **constant-time** a semnăturii de sesiune, **CORS** cu origine configurabilă, limită de mărime a corpului cererii; **licențiere: HMAC simetric → semnătură asimetrică ECDSA P-256** (`@gr/license`) — cheia publică din client nu mai poate fi folosită pentru a forja licențe noi | ✅ implementată |

Acoperă toate elementele din meniul aplicației KISS (Date fixe, Materii prime, Mărfuri,
Furnizori, Clienți, Casă, Balanțe, Reevaluare, Preparate/Rețete), reorganizate și îmbunătățite,
plus un plan de profesionalizare "all-inclusive" (vezi planul de lucru) pentru paritate cu
SmartBill/Saga/WinMentor și ERP-uri de mobilă.

## Structură

```
packages/core-domain   # TS pur: bani, TVA, stoc (CMP), documente, rapoarte, partidă dublă, nesting, audit (+ teste)
packages/data          # repository-uri + adaptoare (SQLite/Postgres/API), migrații, numerotare atomică, backup, provider comutabil
packages/fiscal-ro     # CUI, e-Factura (UBL/CIUS-RO), decont TVA, SAF-T (D406) (+ teste)
packages/license       # ediții + module, cheie semnată asimetric (ECDSA P-256), entitlements (izolare per client) (+ teste)
packages/auth          # roluri + permisiuni (RBAC), hash parolă PBKDF2, token de sesiune (+ teste)
packages/ai            # asistent offline (reguli) + provider Claude prin server (+ teste)
packages/sync          # motor offline-first: reconciliere last-write-wins + tombstones + orchestrator (+ teste)
packages/ui            # aplicația React (design system, shell, toate ecranele) — partajată desktop/web/mobil (+ teste componentă)
db/                     # migrații SQL (SQLite+Postgres: init, operational, audit, firme, mijloace fixe, bancă, scopare pe firmă, reguli configurator) + seed
apps/desktop           # shell Tauri v2 (Win/macOS/Linux) + plugin SQL; și baza pentru mobil
apps/web               # țintă web (PWA) — reutilizează packages/ui
apps/mobile            # ținte iOS/Android (Tauri v2) — vezi README
server/                # API REST + agent Claude + conector ANAF SPV (mTLS) + PostgreSQL real — acum în workspace
e2e/                    # teste Playwright (login, creare document) peste UI-ul real
.github/workflows/      # CI (lint + typecheck + test + build + e2e)
docker-compose.yml     # PostgreSQL 16 + server (mod rețea/cloud) — `docker compose up -d`
docs/                  # ADR-uri + ghiduri
```

## Cerințe

- **Node.js ≥ 20** și **npm 10** (folosim npm workspaces). *(pnpm este o alternativă validă.)*
- Pentru build-ul desktop nativ: **Rust** (stabil) + toolchain-ul Tauri al sistemului
  (WebView2 pe Windows, WebKitGTK pe Linux, Xcode CLT pe macOS).

## Comenzi

```bash
npm install            # instalează tot workspace-ul
npm test               # rulează testele de domeniu + componentă (turbo, pe toate pachetele)
npm run typecheck      # verificare de tipuri pe toate pachetele
npm run build:web      # build web/PWA (ieșire în packages/ui/dist)
npm run dev            # server de dezvoltare UI (http://localhost:1420)
npm run dev:desktop    # aplicația desktop (Tauri) — necesită Rust
npm run test:e2e       # Playwright (pornește automat npm run dev -w @gr/ui)
npm run tauri -- icon ./logo.png   # generează iconițele din logo
```

> Pe Windows, dacă `%TEMP%` e pe o unitate aproape plină, `npx playwright install chromium`
> poate eșua cu `ENOSPC` chiar dacă alte unități au spațiu liber — setează
> `PLAYWRIGHT_BROWSERS_PATH` (și opțional `TEMP`/`TMP`) către un folder de pe altă unitate
> înainte de instalare.

## Licențiere pe ediții (izolare per client)

[`@gr/license`](packages/license): fiecare client primește o **cheie de licență semnată** care
fixează **ediția** (Fabrică de mobilă, Bar/Restaurant, Florărie, Retail, Complet) și modulele
deblocate. Un client de mobilă vede și poate accesa **doar** modulele lui — grupurile ascunse din meniu
**și** rutele blocate (`<Gated>`), chiar accesate direct prin URL. Ediția se schimbă doar din cheie
(clientul nu poate debloca module). Setări → „Licență și module” arată starea și activează chei.

Semnătura e **asimetrică** (ECDSA P-256, [license.ts](packages/license/src/license.ts)): furnizorul
ține o cheie **privată** offline și semnează cu ea; clientul livrat conține doar cheia **publică**
corespunzătoare ([license-context.tsx](packages/ui/src/lib/license-context.tsx)), care poate verifica
o licență dar nu poate emite una nouă. Fluxul pentru furnizor:

```bash
node packages/license/scripts/genereaza-chei.mjs        # o singura data — scrie cheia privata local, afiseaza cea publica
node packages/license/scripts/emite-licenta.mjs \
  --client "Fabrica de Mobila SRL" --editie mobila --plan profesional --expira 2027-12-31
```

Peste **editie** (ce domeniu acopera produsul) exista si **planul** comercial (cat de mare e clientul):
`esential` (3 utilizatori), `profesional` (10), `enterprise` (nelimitat) — sau o limita negociata
explicit prin `--utilizatori <n>`. Cu `--trial` licenta e marcata ca evaluare si semnalata distinct in
UI. Limita de utilizatori e impusa **si de server** (variabila `LICENSE_KEY`), nu doar in interfata:
o cerere directa catre API care ar depasi planul primeste **402**.

Licenta are un ciclu de viata gradual, nu o taiere brusca: avertisment cu 30 de zile inainte de
expirare → **perioada de gratie de 14 zile** in care totul functioneaza normal → apoi **mod
doar-citire**. In modul doar-citire, consultarea, rapoartele si **exporturile raman disponibile** —
datele contabile apartin clientului, iar obligatia legala de a le pastra e a firmei.

Cheia privată se scrie în `packages/license/.chei-furnizor/` (`.gitignore`, NICIODATĂ distribuită) —
scriptul de emitere refuză să ruleze dacă nu o găsește. Cheia publică generată se lipește o singură
dată în `VENDOR_CHEIE_PUBLICA` din `license-context.tsx`.

## Asistent AI

[`@gr/ai`](packages/ai): un **asistent offline** (bazat pe reguli) răspunde din date fără internet
(stoc, casă, TVA, comenzi, reaprovizionare), iar când e configurat un server, întrebările merg la
**Claude** (`claude-opus-5`) prin [`server/`](server) — cheia API rămâne pe server, nu în browser.

## Autentificare & roluri (RBAC)

[`@gr/auth`](packages/auth): login obligatoriu (ecran [Login](packages/ui/src/pages/Login.tsx)),
5 roluri (**admin, contabil, gestionar, casier, vânzător**) cu o matrice de permisiuni; ecranele
sensibile (Contabilitate, Fiscal, Casă, Setări) sunt blocate pe permisiune prin `<Gated permisiune=.../>`,
verificat inclusiv la accesare directă prin URL. Parolele se hash-uiesc PBKDF2 (210k iterații),
tokenul de sesiune e semnat HMAC (`@gr/auth/session.ts`).

**În mod local/demo** (fără server configurat), alegerea rolului la login e suficientă pentru
evaluare rapidă — nu există o rețea de apărat. **În modurile rețea/cloud**, autentificarea e
**reală și impusă de server**: `POST /auth/login` verifică parola (tabela `utilizatori`, migrația
[0005_utilizatori.sql](db/migrations/0005_utilizatori.sql)) și emite un token de sesiune; de acolo
încolo, **orice cerere** către API (în afară de `/health`, `/ready`, `/auth/login`) cere un token
valid, iar fiecare resursă/verb e verificat contra matricei de permisiuni **pe server**
([server/src/auth.ts](server/src/auth.ts)) — nu doar în UI. Utilizator demo: `admin` / `admin123`
(vezi `demoSeed` din [demo-seed.ts](packages/data/src/demo-seed.ts)). Documentele **validate** nu
mai pot fi editate/șterse decât de un rol cu `documente.validare`, și doar după o redeschidere
explicită confirmată (nu editare silențioasă).

## Optimizare debitare (nesting) — modul Mobilă

Peste `listaDebitare` există acum **`optimizeazaDebitare`** ([nesting.ts](packages/core-domain/src/nesting.ts)):
euristică guillotine (shelf FFD) cu grosime de tăiere (kerf) și rotire, care calculează numărul de
plăci necesare și procentul de pierdere — plus **calcul cant** (ml de cant pe laturi) și **BOM
feronerie** din accesoriile alese. Configuratorul Mobilă afișează rezultatul + o **diagramă de
tăiere SVG** pe prima placă.

## Verificat

- `npm test` → **166 teste verzi** (8 pachete: core-domain, data, fiscal-ro, license, auth, ai, sync,
  **ui**) — bani/TVA, stoc CMP, documente, rapoarte, **partidă dublă** (invariant debit=credit, cost CMP
  corect la consum, 3-way match NIR↔factură fără dublă contabilizare, **amortizare** 681/281),
  nesting/cant/feronerie (**+ nesting pe lot de comenzi cu trasabilitate pe cod**, `panouriPentruLot`),
  **BOM→consum real de stoc** (`necesarConsumStoc`), **departamente de producție** (ordine fixă,
  `urmatorulDepartament`/`toateDepartamenteleFinalizate`), **închidere de perioadă**
  (`documentBlocat`/`celMaiRecentBlocaj`), **audit** (filtrare + diff câmpuri), **numerotare atomică**
  (inclusiv 20 alocări concurente → 20 numere unice), **backup/restore round-trip** (păstrează ID-uri +
  relații), **CUI/e-Factura (inclusiv B2C prin CNP)/decont detaliat pe cote/D394/D390/SAF-T**,
  **mijloace fixe** (plan de amortizare liniară/degresivă), **bancă** (parsare CSV + reconciliere,
  inclusiv non-duplicare la rulări repetate), **scopare pe firmă** (`randuriVizibilePentruFirma`/
  `withFirmaScope` — filtrare + stampilare, inclusiv cazul fără firmă selectată), **licențiere pe
  ediții**, **auth/RBAC**, **motor de sincronizare** — plus **10 teste de componentă**
  (`@testing-library/react` + jsdom): `Gated` (blocare pe modul/permisiune), `EntityGrid`
  (listare/creare/ștergere/căutare CRUD peste un repository real în memorie), `DocumentEditor` (creare
  document real prin providerii reali de date/auth/firmă — nu mock-uit), și `FirmaProvider` (regresie
  dedicată pentru bug-ul de fallback găsit live, vezi mai jos).
- `npm run test:e2e` (**Playwright**, Chromium, rulat efectiv local) → **4 teste e2e verzi**: autentificare
  în mod demo (alegere rol, fără parolă); creare + salvare a unei proforme noi cu o linie de produs,
  verificată direct în tabel (total, cod document, stare „ciorna"); **wizardul de configurare inițială**
  parcurs complet, cu verificarea că datele introduse ajung efectiv pe firmă (nu doar în formular); și
  varianta „sari peste configurare" — toate peste `npm run dev -w @gr/ui` real, nu componente izolate.
- `npm run typecheck` → **10/10 pachete** fără erori — **inclusiv `server/`**, acum parte reală a
  workspace-ului (nu doar scris, ci compilat și verificat).
- `npm run lint` (biome) → curat (0 erori; un singur avertisment `noExplicitAny`, tolerat explicit în
  construcția generică a provider-ului). Corectate în această rundă câteva probleme reale de lint
  preexistente găsite abia acum, la introducerea CI-ului: comentarii `eslint-disable` moarte (proiectul
  folosește biome, nu eslint) înlocuite cu `biome-ignore` funcționale, o dependență inutilă la un
  `useMemo` (`produsById`), o cheie de listă pe index nejustificată, și rânduri de tabel cu click
  (`DataTable`) care acum au și echivalent de tastatură (`Enter`/`Space`) când `onRowClick` e folosit.
- `npm run build:web` → build de producție reușit (PWA: service worker + manifest).
- Verificat în browser end-to-end pe date demo: **login obligatoriu**, **casier blocat pe Contabilitate
  și Setări** („Acces restricționat") dar **cu acces la Casă** (permisiunea corectă), nomenclatoare CRUD,
  documente (recepții → validare), **balanța stocurilor prin CMP** (7.000 RON), registru de casă cu sold
  rulant, configurator Mobilă cu preț live + listă de debitare + **optimizare debitare (2 plăci, diagramă
  SVG)**, **e-Factura XML + factură PDF**, **balanță de verificare echilibrată**, **asistent AI care
  răspunde din date**, **izolare pe licență** (rută HoReCa blocată pe ediția Mobilă).
- **Server real pornit și testat prin HTTP**: `npm run dev:server` → `GET /health`, `GET /ready`,
  `GET /gestiuni` (date demo), **`POST /numerotare/next` alocă secvențial (1, 2, ...) peste rețea**.
  Din UI (Setări → Mod de funcționare → Rețea locală): butonul „Verifică" a contactat serverul real
  și a afișat **„Conectat · 19 ms · stocare: memorie"**. Zero erori în consolă pe tot parcursul.
- **Autentificare server-side end-to-end**: `POST /documente` fără token → **401** (înainte accepta
  necondiționat); login greșit → **401**; login corect (`admin`/`admin123`) → token de sesiune;
  cu tokenul, un utilizator `vânzător` nou-creat POATE crea o ciornă dar primește **403** la
  validare/ștergere și la `GET /utilizatori` (rezervat `admin`); `GET /utilizatori` nu expune
  niciodată `parolaHash`. Verificat și din UI: mod „Rețea locală" → login `admin`/`admin123` prin
  formularul real → date încărcate prin API autentificat (confirmat din `network requests`, nu doar
  vizual) → `Deconectare` → login din nou ca `vânzător` (mod demo) → butonul de ștergere document
  dispare, iar editarea unui document deja validat e blocată cu mesaj explicit.
- **Flux Mobilă complet verificat live**: o comandă configurată cu material real (PAL, legat prin
  `produsId` de catalog) parcursă prin toate stările — confirmare → **încasare avans reală** (apare în
  Registrul de casă), intrare în producție → **bon de consum auto-generat** (`BC-2026-...`) care scade
  stocul real la CMP (verificat în Balanța stocurilor: 100→94,44 mp PAL), livrare → **aviz auto-generat**,
  facturare → **factură de vânzare auto-generată** cu liniile corecte — și balanța de verificare a rămas
  **echilibrată** pe tot parcursul (contul 601 la 222,28 RON = cost CMP, nu cele 250,07 RON preț de
  vânzare). Testat și blocajul de stoc insuficient (mesaj clar, tranziția refuzată).
- **e-Factura B2C verificată live**: factură către un client persoană fizică (fără CUI, cu CNP) →
  XML generat corect cu `<cac:PartyIdentification schemeID="CNP">`, fără niciun `PartyTaxScheme`
  pentru cumpărător.
- **Închidere de perioadă verificată live, server + UI**: `PATCH`/`DELETE` pe un document dintr-o
  perioadă închisă → **423** de la server (inclusiv pentru `admin`); din UI, editarea/ștergerea unui
  document blocat afișează mesajul explicit și nu deschide formularul; redeschiderea perioadei
  restabilește accesul imediat.
- **3 bug-uri reale găsite DOAR prin testare live** (nu ar fi fost prinse de teste unitare sau
  typecheck): (1) alocatorul de numerotare demo pornea de la 0 indiferent de documentele deja
  existente în seed → primul document nou coliziona cu un cod deja existent; (2) CORS-ul serverului nu
  permitea header-ul `authorization`, deci orice cerere autentificată reală eșua silențios cu
  `net::ERR_FAILED` deși preflight-ul trecea; (3) `DocumentEditor` (ecranul generic de documente)
  rescria necondiționat `meta` la `'{}'` și `documentSursaId` la `null` la **orice** salvare — editarea
  unei comenzi Mobilă (ex. ca să-i setezi gestiunea) îi ștergea silențios configurația și starea de
  producție. Toate trei confirmă valoarea verificării end-to-end față de teste izolate.
- **Ciclul complet de contabilitate aprofundată verificat live în browser**, în ordine, fără nicio
  regresie a balanței de verificare (mereu echilibrată D=C): Mijloace fixe (rulare amortizare →
  notă contabilă vizibilă în Registru-jurnal) → Registru-jurnal (print) → Cartea mare (fișe pe toate
  conturile) → Registru-inventar (agregare) → D394 (livrări/achiziții) → D390 (partener UE) → D300
  (decont pe cote) → Banca (import CSV + reconciliere automată, apoi manuală pe rândul nepotrivit).
- `.github/workflows/ci.yml` e scris corect (lint → typecheck → test → build:web, apoi un job separat
  de e2e cu instalare Chromium) și **fiecare pas a fost rulat manual, cu succes, în acest mediu** —
  dar fișierul însuși **nu a fost executat pe un runner GitHub Actions real** (necesită push către un
  repo GitHub; acest director nu are încă `.git`).
- **Adâncire Mobilă verificată live, capăt la capăt**: configurație peste maxim admis + combinație
  interzisă → eroare afișată, „Creează comandă” dezactivat (testat și click-ul, nu doar afișarea);
  configurație validă → comandă creată; comandă avansată prin toate cele 5 departamente de producție
  (panoul de capacitate s-a actualizat la fiecare pas) — „Avansează” spre „Finalizată” blocat cu mesaj
  explicit cât timp un departament nu era bifat, permis după; șarjă de debitare cu o comandă reală →
  diagramă de tăiere pe 2 plăci + export CNC (CSV, fără erori în consolă); agendă livrare/montaj →
  câmpuri curier/AWB/dată montaj editate inline, persistate corect (verificat direct din DOM, nu din
  textul paginii — vezi bug-ul de mai jos), calendarul lunar arată corect ziua de livrare și cea de
  montaj pe luna corectă.
- **Multi-firmă verificată live, în ambele direcții**: cu o a doua firmă demo, un document creat sub
  o firmă nu a apărut la comutarea pe cealaltă firmă (și invers), pentru facturi, mijloace fixe și
  comenzi Mobilă deopotrivă; balanța de verificare a rămas echilibrată. Găsit și corectat un bug real
  în timpul acestei verificări (fallback-ul de firmă nu se persista în `localStorage` cât timp
  utilizatorul nu atingea explicit selectorul — vezi secțiunea „Multi-firmă — scopare reală”).
- **O lecție de metodologie din această rundă**: un simptom inițial de „date pierdute” la editarea
  câmpurilor curier/AWB s-a dovedit, după investigare directă în consolă (`document.activeElement`,
  setare de valoare prin setter-ul nativ + evenimente), un artefact al metodei de testare (typing
  repetat fără golirea câmpului întâi, plus un eveniment `blur` sintetic care nu declanșează handler-ul
  React) — nu un bug real de produs. Notat explicit aici ca să nu fie confundat cu cele găsite și
  confirmate mai sus.

## Contabilitate (partidă dublă)

Note contabile generate automat din documente + casă (monografie RO), în [`contabilitate.ts`](packages/core-domain/src/contabilitate.ts):
achiziții (`3xx`/`4426`/`401`), vânzări (`4111`/`707`/`4427`) cu descărcare de gestiune (`607`/stoc),
consumuri (`601`), încasări/plăți casă (`5311`). Rapoarte: **Registru-jurnal**, **Balanță de verificare**
(cu verificarea echilibrului), **Fișă de cont**.

## Fiscal (RO)

Pachetul [`@gr/fiscal-ro`](packages/fiscal-ro) concentrează regulile fiscale — o modificare se face
o singură dată și se propagă la desktop / web / mobil:
- **CUI** cu cifra de control (algoritmul ANAF), afișat ca validare live în Parteneri.
- **e-Factura**: XML UBL 2.1 conform CIUS-RO, cu preview + descărcare (ecranul `Fiscal → e-Factura`).
- **Decont TVA** (colectată/deductibilă) și **SAF-T (D406)** — export XML.
- **Factură printabilă** (print-to-PDF din browser).

## Contabilitate aprofundată (Faza 10-bis)

- **Mijloace fixe** ([mijloace-fixe.ts](packages/core-domain/src/mijloace-fixe.ts)): amortizare
  **liniară** sau **degresivă** (cu trecere automată la liniar spre finalul duratei, ca să nu
  depășească niciodată valoarea de intrare), plan lunar complet. „Rulează amortizarea" generează
  un document `nota_amortizare` (681=D / 281=C) integrat direct în partida dublă și în
  Registru-jurnal, fără o tabelă de persistență separată.
- **Registre legale complete** ([contabilitate.tsx](packages/ui/src/pages/contabilitate.tsx),
  [rapoarte.tsx](packages/ui/src/pages/rapoarte.tsx)): Registru-jurnal cu **export/print PDF**,
  **Cartea mare** (fișele tuturor conturilor, nu doar unul câte unul), **Registru-inventar**
  (agregă stocuri + mijloace fixe + creanțe/datorii + disponibil casă într-un singur instantaneu).
- **D300 detaliat pe cote TVA** ([decont.ts](packages/fiscal-ro/src/decont.ts)), **D394**
  ([d394.ts](packages/fiscal-ro/src/d394.ts)) și **D390/VIES** ([d390.ts](packages/fiscal-ro/src/d390.ts)):
  construite ca **declarații de lucru** — logica de agregare (grupare pe cotă/partener/țară) e
  corectă și testată, dar schema exactă XML a formularului oficial ANAF **nu a fost verificată**
  împotriva sistemului declarativ live — de făcut înainte de o depunere reală.
- **Jurnal de audit append-only, impus de server**: `PATCH`/`DELETE` pe `audit_log` returnează
  **403 necondiționat, inclusiv pentru admin** ([server/src/index.ts](server/src/index.ts)) — bug
  real găsit prin audit (înainte, orice rol autentificat putea rescrie istoricul).
- **Bancă** ([banca.ts](packages/core-domain/src/banca.ts), ecran `Trezorerie → Banca`): import
  extras **CSV** (`data,suma,descriere`, sumă cu semn), **reconciliere automată** (tip + sumă +
  toleranță de dată) idempotentă la rulări repetate, plus legătură manuală prin dropdown. Import
  nativ **MT940/CAMT.053** rămâne o rundă ulterioară.

## Modul Mobilă — adâncire

- **Reguli de configurator** ([mobila.ts](packages/core-domain/src/mobila.ts) `verificaConfiguratie`,
  ecran `Reguli configurator`): un profil de dimensiuni min/max (un singur rând activ) + o listă de
  combinații material×finisaj interzise, editabile din UI. Configuratorul calculează erorile live și
  **blochează** butonul „Creează comandă” cât timp configurația e invalidă.
- **Permisiune reală la creare**: „Creează comandă” din configurator nu verifica nicio permisiune —
  orice utilizator autentificat putea crea o comandă, spre deosebire de toate celelalte ecrane de
  documente (`DocumentEditor` face verificarea). Corectat: butonul e dezactivat fără
  `documente.creare`, și handler-ul verifică din nou (nu doar UI-ul).
- **Nesting real pe șarjă, nu doar preview** ([SarjaDebitarePage](packages/ui/src/pages/mobila.tsx)):
  optimizarea de debitare din Configurator arăta mereu o SINGURĂ comandă, în timpul configurării —
  niciodată aplicată comenzilor reale. Ecranul nou „Șarjă de debitare” combină piesele mai multor
  comenzi **confirmate/în producție** pe aceleași plăci (aici e economia reală de material, ~30%
  promisă în plan) + **export CNC (CSV)** cu poziția fiecărei piese pe fiecare placă.
- **Planificare producție pe departamente** (`DEPARTAMENTE_PRODUCTIE`: debitare→cant→CNC→
  vopsitorie→montaj): stare „În producție” nu mai e o cutie unică — fiecare comandă are un progres
  pe departamente, cu buton „Finalizează <departament>” care respectă ordinea fixă; trecerea la
  „Finalizată” e **blocată** cât timp mai există departamente neterminate. Panou de capacitate
  (câte comenzi sunt curent la fiecare departament).
- **Agendă livrare + montaj**: comanda are acum și dată de montaj (separată de livrare) + curier/AWB,
  editabile direct în tabelul „Planificare livrări”; adăugat un calendar lunar cu marcaje pentru
  livrare (camion) și montaj (cheie), navigabil lună cu lună.

## Multi-firmă — scopare reală

- **`firmaId`** adăugat pe entitățile tranzacționale: `Document`, `DocumentLinie`, `OperatiuneCasa`,
  `OperatiuneBancara`, `MijlocFix` ([migrația 0008](db/migrations/0008_firma_scoping.sql)) — nullable,
  fără migrare de date (rândurile vechi, `firmaId: null`, rămân vizibile tuturor firmelor, nu dispar
  retroactiv). Nomenclatoarele (parteneri, produse, gestiuni...) rămân comune tuturor firmelor,
  decizie deliberată, nu un gol.
- **`withFirmaScope`** ([firma-scope.ts](packages/data/src/firma-scope.ts), testat): decorează un
  repository ca `withAudit` — `list()` filtrează pe firma curentă, `create()` stampilează firma
  curentă (ignoră orice `firmaId` trimis de apelant). Aplicat client-side în
  [data-context.tsx](packages/ui/src/lib/data-context.tsx) peste cele 5 resurse de mai sus.
- **Impunere reală server-side** ([server/src/index.ts](server/src/index.ts)): pentru modurile
  rețea/cloud, un client nu poate fi de încredere să se auto-limiteze — GET list filtrează,
  GET/PATCH/DELETE pe un id din altă firmă răspund **404** (nu 403, ca să nu confirme nici măcar
  existența rândului), POST stampilează firma **din sesiune**, ignorând orice `firmaId` din corpul
  cererii.
- **Bug real găsit și corectat prin verificare live**: firma curentă (`firmaCurenta()` în
  data-context.tsx) citește direct `localStorage` (ca să evite o dependință circulară cu
  `FirmaProvider`, care are nevoie de `useData()`). Dar cazul obișnuit — o singură firmă — nu randează
  deloc selectorul, deci utilizatorul nu-l atinge niciodată, iar `localStorage` rămânea `null` la
  nesfârșit: documentele noi ar fi fost create **nescopate**, inofensiv cât există o singură firmă, dar
  vizibile pentru orice firmă adăugată ulterior. Corectat în
  [firma-context.tsx](packages/ui/src/lib/firma-context.tsx): rezultatul fallback-ului (`firme[0]`) se
  persistă explicit în `localStorage`, nu doar selecția manuală — cu test de regresie dedicat
  ([firma-context.test.tsx](packages/ui/src/lib/firma-context.test.tsx)).
- **Verificat live, în ambele direcții**: o a doua firmă demo (SC Nord Mobila SRL) cu propriile
  documente/mijloace fixe/casă — comutarea din Sidebar + navigare arată strict datele firmei curente;
  o comandă creată în timp ce era activă Nord nu a apărut la comutarea pe Titan, și invers; balanța de
  verificare a rămas echilibrată pe tot parcursul.
- **Reîncărcare automată la comutare** ([data-context.tsx](packages/ui/src/lib/data-context.tsx),
  [firma-context.tsx](packages/ui/src/lib/firma-context.tsx)): comutarea firmei din Sidebar
  reîmprospătează imediat orice pagină deja deschisă, fără navigare — fosta „limitare onestă” de mai
  jos e rezolvată. Mecanism: `DataProviderContext` desparte providerul în strat **stabil** (`base`:
  conexiunea memory/API, construită o singură dată per mod de deployment, ca să nu piardă datele
  demo din sesiune) și strat de **decorare** (`withAudit`/`withFirmaScope`, reconstruit la schimbarea
  firmei). `FirmaProvider` emite un `CustomEvent` (`EVENIMENT_FIRMA_SCHIMBATA`) la fiecare schimbare de
  firmă (selecție manuală sau fallback persistat) — evenimentul nativ `storage` nu era o opțiune,
  fiindcă nu se declanșează în tab-ul care face chiar el scrierea. `data-context.tsx` ascultă acest
  eveniment și reconstruiește stratul de decorare, producând repository-uri cu identitate nouă; hook-ul
  `useCollection`, deja folosit peste tot, detectează automat noua identitate și reîncarcă — fără nicio
  modificare pe paginile individuale. **Verificat live**: comutare Titan↔Nord fără navigare pe
  Vânzări facturate (FCT-2026-000001 ↔ FCT-2026-N00001) și Mijloace fixe (MF-001 ↔ MF-N01), în ambele
  sensuri, fără erori în consolă; balanța de verificare a rămas echilibrată; suita Playwright rulează
  verde după schimbare.

## Branding per firmă (white-label) + Tablou de bord real

Rundă motivată direct de scopul comercial: aplicația trebuie să poată fi **prezentată și vândută
separat, sub identitatea vizuală a fiecărei firme client** (ex. o fabrică de mobilă specifică),
nu doar cu date fiscale proprii (deja acoperit de multi-firmă) — și tabloul de bord de la prima
pornire trebuie să arate cifre reale, nu un mockup.

- **`Firma`** ([firma.ts](packages/core-domain/src/entities/firma.ts)) are acum `logoDataUrl`
  (imagine mică, data URL — încărcată direct din Setări, fără server de fișiere, ca instalarea să
  rămână offline-first), `culoarePrimara` (hex) și `numeAplicatie` — toate nullable, `null` = rămâne
  brandingul generic ([migrația 0010](db/migrations/0010_branding_firma.sql)).
- **Aplicat runtime** ([branding.ts](packages/ui/src/lib/branding.ts)): `culoarePrimara` (hex) e
  convertită în tripletul HSL folosit de tokenii CSS din `styles.css` și suprascrie `--primary` pe
  `documentElement` — Sidebar, butoane și accente își schimbă culoarea imediat, per firmă activă,
  fără rebuild. `numeAplicatie` înlocuiește titlul generic al aplicației în Sidebar și în titlul
  tab-ului de browser. **Simplificare asumată pentru v1**: culoarea de brand rămâne identică în
  tema light/dark (stilul inline are prioritate față de regulile `.dark`) — o adaptare de contrast
  per temă ar necesita generarea unei a doua nuanțe, lăsată pentru o rundă ulterioară dacă un client
  chiar are nevoie de asta.
- **Bug real găsit și corectat**: cardul „Date firmă” din Setări era complet **deconectat de la
  date reale** — un `useState` local hardcodat (`'SC Titan_CO SRL'`, `'RO12345678'`, un „punct de
  lucru” care nu există deloc ca atare pe entitatea `Firma`), fără niciun buton de salvare
  funcțional. Rescris să citească/scrie direct în `db.firme` (denumire, CUI, adresă, județ,
  localitate, IBAN, bancă), plus cardul nou de branding (logo/culoare/nume aplicație).
- **Bug real, mai grav, găsit și corectat**: factura tipărită, XML-ul e-Factura și exportul SAF-T
  ([fiscal.tsx](packages/ui/src/pages/fiscal.tsx)) foloseau o constantă `VANZATOR` hardcodată cu
  datele firmei Titan — **o factură emisă sub o a doua firmă (Nord) apărea totuși cu antetul și CUI-ul
  primei firme**, o discrepanță fiscală reală, nu doar cosmetică. Corectat: `firmaCaVanzator(firma)`
  construiește datele vânzătorului din `firmaCurenta` (prin `useFirma()`), verificat live pentru
  ambele firme demo (factura Titan arată `RO14399840`/Titan, factura Nord arată `RO33445566`/Nord).
- **Antet cu logo pe documentele client-facing** ([print-branding.ts](packages/ui/src/lib/print-branding.ts)):
  factura tipărită și devizul Mobila au acum un antet cu logo+denumirea firmei curente. Documentele
  legale interne (registru-jurnal, cartea mare, D300/D394/D390, registru-inventar) rămân neutre,
  deliberat — formatul lor e standardizat, nu de reprezentare a mărcii.
- **Tablou de bord rescris complet** ([Dashboard.tsx](packages/ui/src/pages/Dashboard.tsx)): înainte
  arăta 4 cifre **hardcodate** (`124530`, `8742.5`...) care nu proveneau din nicio dată reală — un
  gol serios pentru un ecran de primă impresie. Acum: valoare stoc, sold casă, sold bancă (nou —
  nu exista nicio agregare a soldului bancar înainte), sold clienți de încasat (`balantaParteneri`),
  comenzi Mobilă active, TVA de plată — toate calculate din documentele/operațiunile reale (reutilizează
  parțial `useAIContext`, deja folosit de asistentul AI). Soldurile negative de casă/bancă și soldul de
  încasat pozitiv sunt evidențiate cu roșu. Pentru ediția Mobilă: comenzi pe stadiu (bare orizontale,
  o singură nuanță — magnitudine pe categorie ordonată, nu identitate, deci fără nevoie de paletă
  categorială), capacitate producție pe departament, livrări/montaj din următoarele 7 zile, alertă
  stoc sub minim (`Produs.stocMinim` există în schemă de multă vreme, dar nu era folosit **nicăieri**
  în UI înainte de asta).
- **Curățenie de cod însoțitoare**: `parseConfiguratieMobila` (parsare + valori implicite din schema
  Zod pentru `Document.meta`) mutată din `mobila.tsx` (unde era duplicată local ca `parseCfg`/`CFG_GOALA`)
  în `@gr/core-domain`, ca Dashboard-ul să poată reutiliza aceeași sursă unică de adevăr fără a
  reimplementa valorile implicite.
- **Verificat live, pentru ambele firme demo**: schimbată denumirea aplicației și culoarea primară
  pentru Nord (titlul tab-ului și Sidebar-ul s-au schimbat imediat, `getComputedStyle` confirmă
  `--primary: 142 76% 36%` pentru `#16a34a`); factura Nord tipărită arată corect antetul și CUI-ul
  Nord; comutarea înapoi pe Titan revine imediat la brandingul generic, fără erori în consolă.
  Tabloul de bord pentru Titan arată cifre reale și consistente cu alte ecrane deja verificate
  (valoare stoc 7.000,00 RON — identic cu balanța stocurilor).

## Profesionalizare UX/robustețe

Rundă declanșată de cererea explicită „verifică tot flow-ul și logica, du totul la un nivel
super profesional de ERP". Un audit de cod dedicat (nu doar testarea manuală obișnuită) a căutat
sistematic pattern-uri neprofesionale — `alert()`/`confirm()` nativ, lipsa unei plase de siguranță
la erori de randare, stări de încărcare ignorate, butoane fără nume accesibil — și fiecare
constatare a fost corectată, nu doar documentată.

- **`ErrorBoundary`** ([ErrorBoundary.tsx](packages/ui/src/components/ErrorBoundary.tsx), montat în
  jurul întregii aplicații în `App.tsx`): înainte, **nu exista niciunul** — o eroare de randare
  oriunde în aplicație înlocuia tot UI-ul brandat (Sidebar/Topbar) cu ecranul brut, nebrandat, de
  crash al React Router. Acum se afișează un ecran clar, cu explicație și buton de reîncărcare, fără
  să expună stack trace-ul către utilizator — critic pentru o eroare neașteptată în mijlocul unei
  prezentări la client.
- **Sistem de toast-uri** ([toast.tsx](packages/ui/src/lib/toast.tsx), `useToast()`): înainte, fiecare
  ecran raporta succes/eroare altfel — unele cu `alert()` nativ (blochează thread-ul UI, are numele
  site-ului în bara de titlu), altele cu un `<p>` neutru într-un `useState` local, iar în `Setari.tsx`
  mesajul de succes și cel de eroare la restaurarea unui backup foloseau **aceeași** variabilă și
  același stil vizual (nicio distincție de culoare între „a mers" și „a eșuat" la cea mai
  distructivă acțiune din aplicație). Acum un singur mecanism, consecvent: succes (verde), eroare
  (roșu), info (albastru), auto-dispariție după 5s, cu buton de închidere manuală.
- **Dialog de confirmare stilizat** ([confirm.tsx](packages/ui/src/lib/confirm.tsx), `useConfirm()`):
  înlocuiește `confirm()` nativ la fiecare acțiune distructivă (ștergere înregistrare/document/
  operațiune de casă, redeschiderea unui document validat, restaurarea unui backup) cu un modal din
  design system-ul aplicației, cu titlu și mesaj specifice acțiunii și butonul de confirmare
  evidențiat ca „danger" (roșu) pentru ștergeri.
- **Stare de încărcare reală** ([DataTable.tsx](packages/ui/src/components/DataTable.tsx)): `useCollection`
  expunea deja `loading`, dar **nimeni nu-l citea** — orice tabel gol la montare (înainte ca datele
  să sosească) arăta mesajul „Nu există înregistrări", identic cu cazul în care chiar nu există date.
  Acum `DataTable` are un `loading?: boolean` care arată un indicator de încărcare în loc, cablat în
  `EntityGrid`, `DocumentEditor`, `casa.tsx` și `banca.tsx`.
- **`try/catch` pe toate salvările** (`EntityGrid.save`/`del`, `DocumentEditor.save`/`valideaza`/
  `sterge`, `casa.tsx`, `Setari.tsx`): înainte, o eroare la `repo.create`/`update` (validare, rețea)
  devenea o promisiune respinsă necaptată — butonul de „Salvează" părea pur și simplu să nu facă
  nimic. Acum orice eșec arată un toast de eroare cu mesajul real, iar succesul arată un toast de
  confirmare.
- **Accesibilitate**: butoanele doar-cu-icoană (edit/șterge, pe fiecare rând din fiecare tabel al
  aplicației, plus butonul de închidere al oricărui modal) aveau `title` doar pe jumătate din cazuri
  și `aria-label` aproape niciodată (3 apariții în tot `packages/ui/src`) — un cititor de ecran
  anunța „buton" fără sens la editare/ștergere pe zeci de ecrane. Toate au acum `title`+`aria-label`
  descriptive. `Modal` ([controls.tsx](packages/ui/src/components/controls.tsx)) are acum
  `role="dialog"`, `aria-modal`, `aria-labelledby`, mută focusul în dialog la deschidere, îl
  restaurează pe elementul declanșator la închidere, și capcanează Tab-ul în interiorul dialogului
  cât timp e deschis (Tab de pe ultimul element sare pe primul, Shift+Tab invers).
- **Tabloul de bord nu mai afișează un flash de cifre 0/goale**: `Dashboard.tsx` arăta imediat
  `valoareStocBani: 0`, liste goale etc. înainte ca cererile async să se termine, apoi „sărea" la
  cifrele reale — citea ca un bug, nu ca o încărcare. Acum un singur comutator de încărcare
  (`documente.loading` + o stare locală pentru restul cererilor) arată un indicator „Se încarcă..."
  pentru tot conținutul până sunt gata toate datele, apoi randează dintr-o dată tabloul complet.
- **Verificat live, cu teste actualizate**: `EntityGrid.test.tsx`/`DocumentEditor.test.tsx`
  actualizate să interacționeze cu dialogul de confirmare real (nu mai simulează `window.confirm`);
  în browser — creat și șters o înregistrare de test, confirmat toast-ul de succes la fiecare pas,
  confirmat că ștergerea NU are efect până nu se apasă explicit „Șterge" în dialog, confirmat
  `role="dialog"` vizibil în arborele de accesibilitate, confirmat focus mutat în dialog la
  deschidere și restaurat pe butonul declanșator la Escape. **O lecție de metodologie, nu un bug
  real**: în timpul verificării, un tab de browser rămas deschis în timp ce editam în lanț
  `toast.tsx`/`confirm.tsx`/`controls.tsx`/`DocumentEditor.tsx` a arătat temporar erori
  „`useConfirm` must be used within `ConfirmProvider`" — un artefact cunoscut de Fast Refresh (Vite
  reîncarcă `confirm.tsx`, care exportă un `Context`, dar arborele de provideri deja montat ține
  referința la instanța veche a modulului). Dispare complet cu un tab nou/reîncărcare completă;
  nu poate apărea într-un build de producție (fără HMR).
- **Audit static dedicat** (agent de explorare, read-only, cu instrucțiune explicită să NU repete ce
  e deja documentat): a confirmat că **nu există cod mort/`TODO`/`FIXME`** rămas în aplicație — o
  verificare pozitivă, nu un gol.

Total actualizat: **133+ teste verzi (8 pachete), typecheck 10/10, lint curat, 2 teste e2e Playwright
verzi, build+PWA**. Onest neimplementat din auditul acestei runde (impact mai mic, lăsat deliberat
pentru o rundă viitoare): `banca.tsx`/`mijloace-fixe.tsx`/`contabilitate.tsx`/`fiscal.tsx`/`mobila.tsx`/
`rapoarte.tsx`/`Audit.tsx` nu au toate fost cablate cu `loading` (doar cele mai frecvent atinse:
`EntityGrid`, `DocumentEditor`, `casa.tsx`, `banca.tsx`); `CommandPalette` are `role="dialog"` dar nu
și o capcană completă de Tab ca `Modal`; bundle-ul JS rămâne un singur chunk de ~514 KB — code-splitting
pe rută (`React.lazy`) ar reduce încărcarea inițială, dar nu a fost făcut această rundă.

## Comercializare — de la aplicatie la produs (Faza 17)

Rundă motivată direct de scopul comercial: produsul trebuie sa poata fi **vandut si folosit de firme**, nu doar demonstrat. Auditul a pornit de la intrebarea „ce anume blocheaza azi o vanzare reala?", iar raspunsul a fost mai putin despre functionalitate si mai mult despre lipsurile din jurul ei.

- **Golul cel mai grav: nu exista administrare de utilizatori.** Permisiunea `utilizatori.administrare` exista in matricea de roluri si era impusa de server de mai multe runde, dar **nu avea niciun ecran** — adica un client care cumpara produsul nu-si putea crea colegii fara interventie manuala in baza de date. Ecran nou [Utilizatori.tsx](packages/ui/src/pages/Utilizatori.tsx): creare cont (cu parola hash-uita in client, niciodata trimisa in clar), schimbare rol, activare/dezactivare, resetare parola, consumul de licenta afisat.
- **Protectie anti-lockout**, impusa **server-side** ([server/src/index.ts](server/src/index.ts)): instalarea trebuie sa ramana mereu cu cel putin un administrator activ. Retrogradarea, dezactivarea sau stergerea ultimului admin sunt refuzate cu **409** si un mesaj care spune ce trebuie facut intai. Verificat pe toate cele trei cai.
- **Parole**: `POST /auth/schimba-parola` (cere parola veche si **revoca tokenul curent** la succes, fortand reautentificarea) si `POST /utilizatori/:id/reseteaza-parola` (doar pentru administratori). Lungime minima impusa server-side, nu doar in formular.
- **Model de licentiere comercial** ([stare.ts](packages/license/src/stare.ts)): peste editie (ce domeniu acopera produsul) s-a adaugat **planul** (cat de mare e clientul): Esential 3 utilizatori, Profesional 10, Enterprise nelimitat, cu posibilitatea unei limite negociate explicit in cheie. Licentele pot fi marcate **trial**. Toate campurile sunt optionale, deci **licentele emise anterior raman valide** si se comporta ca inainte.
- **Ciclul de viata al licentei, gradual, nu brusc**: `activa` → `expira_curand` (avertisment cu 30 de zile inainte) → `gratie` (14 zile dupa expirare, totul functioneaza normal) → `expirata`. Banda de stare ([BannerLicenta.tsx](packages/ui/src/components/BannerLicenta.tsx)) apare doar cand exista ceva de comunicat.
- **Modul doar-citire dupa expirare, cu o asimetrie deliberata** ([licenta-guard.ts](packages/data/src/licenta-guard.ts)): scrierea e blocata, dar **citirea, rapoartele si exporturile raman permise neconditionat**. Datele contabile apartin clientului, iar obligatia legala de a le pastra si prezenta (control ANAF, arhivare) e a firmei — o licenta neplatita opreste vanzarea de functionalitate noua, nu accesul la propriul istoric. Garda e aplicata **central**, in stratul de date, nu ecran cu ecran.
- **Limita de utilizatori impusa REAL pe server** ([server/src/licenta.ts](server/src/licenta.ts)): pana acum licenta traia doar in clientul web (localStorage), deci limita era o sugestie — cine vorbea direct cu API-ul putea crea oricati utilizatori. Serverul verifica acum `LICENSE_KEY` cu cheia publica si refuza crearea peste plan cu **402**. Conturile dezactivate nu consuma licenta (un angajat plecat isi pastreaza istoricul fara sa fie platit), iar reactivarea consuma din nou — altfel limita s-ar fi putut ocoli dezactivand si reactivand conturi in bucla.
- **Wizard de configurare initiala** ([Onboarding.tsx](packages/ui/src/components/Onboarding.tsx)): inainte, un client nou ateriza direct peste datele demo ale altcuiva („SC Titan_CO SRL"), fara sa i se spuna de unde isi seteaza propriile date — prima impresie era a unei aplicatii deja folosite de altcineva. Acum: date firma → identitate vizuala → licenta sau evaluare → rezumat. Poate fi sarit si scrie in aceleasi locuri ca ecranul de Setari (fara a doua sursa de adevar).
- **Documente legale in aplicatie** ([legal.ts](packages/ui/src/lib/legal.ts), Setari → Legal): EULA si informarea GDPR. Nu sunt decorative — aplicatia prelucreaza CNP-uri de angajati, CNP-uri de clienti persoane fizice (e-Factura B2C) si date de parteneri, deci informarea trebuie sa fie la indemana. Marcate explicit ca **sablon de revizuit juridic** inainte de prima vanzare.
- **Performanta — bundle-ul redus cu ~30%**: limitarea „un singur chunk de ~515 KB" era semnalata in README de mai multe runde. Rutele sunt acum incarcate lazy ([registry.ts](packages/ui/src/modules/registry.ts)): initial **371,95 kB** (gzip 110,97 kB) fata de 515,52 kB (gzip 146,11 kB), plus ~34 de chunk-uri incarcate la cerere. Avertismentul Vite de marime a disparut.

**Doua bug-uri reale gasite prin verificare, nu prin citirea codului:**
1. **Mesajele de eroare ale serverului erau aruncate la gunoi** ([api-repo.ts](packages/data/src/api-repo.ts)): serverul trimite mesaje explicative si actionabile (`{ error: "Trebuie sa ramana cel putin un administrator activ..." }`), dar clientul afisa doar `API 409 Conflict`. Afecta **toate** regulile de business — 402 licenta plina, 403 acces interzis, 409 ultimul admin, 423 perioada inchisa. Corectat: mesajul serverului e extras si afisat. Verificat live: retrogradarea ultimului admin arata acum textul complet, nu un cod HTTP.
2. **Wizard-ul salva firma, dar interfata ramanea cu datele vechi**: `FirmaProvider` tine o copie a listei de firme incarcata la montare, deci Sidebar-ul, brandingul si Setari ar fi continuat sa afiseze denumirea demo pana la un reload complet — exact impresia gresita pe care wizard-ul trebuia sa o evite. Prins de testul e2e nou, corectat cu reincarcare explicita.

**Verificat**: 166 teste verzi (8 pachete, +20 fata de runda anterioara), typecheck 10/10, lint curat, **4 teste e2e Playwright** (+2 noi, pentru wizard: parcurgere completa cu verificarea ca datele chiar ajung pe firma, si varianta „sari peste"), build+PWA. Live in browser: enforcement-ul de licenta pe un plan de 3 utilizatori (al 4-lea refuzat cu mesaj clar, dezactivarea elibereaza locul, reactivarea peste limita refuzata, schimbarea rolului unui cont activ nu consuma loc), anti-lockout pe toate cele trei cai, resetare de parola urmata de autentificare reusita cu parola noua, schimbarea propriei parole cu revocarea tokenului, navigare pe 5 rute lazy fara erori de consola, si wizard-ul complet pe o instalare curata.

## Runda de securitate (Faza 16)

Rundă declanșată de cererea explicită „asigură-te că este super profesional, fără bug-uri, bine
securizat, cu logica și workflow-ul cât mai bune". Spre deosebire de rundele anterioare (funcționalitate
și UX), aici ținta a fost exclusiv **securitatea și corectitudinea** — un fix XSS/CSV găsit prin
verificare directă a codului de generare HTML/CSV, urmat de un audit de securitate dedicat (agent
separat, focalizat pe server/auth/SQL/CORS/RBAC) ale cărui 11 constatări au fost triate și remediate
aproape în întregime.

- **XSS stocat, în toate funcțiile de print** ([safe-output.ts](packages/ui/src/lib/safe-output.ts),
  `escapeHtml`): `printHtml()` ([export.ts](packages/ui/src/lib/export.ts)) scrie HTML generat direct
  cu `document.write` într-o fereastră same-origin — orice șir necurățat interpolat acolo (denumire
  firmă/partener/produs, adresă) rula cu acces complet la `window.opener` (localStorage/sesiune).
  Corectat în 6+ funcții din 4 fișiere: `facturaHtml`/`d300Html` ([fiscal.tsx](packages/ui/src/pages/fiscal.tsx)),
  `devizHtml` ([mobila.tsx](packages/ui/src/pages/mobila.tsx)), `registruJurnalHtml`/`carteaMareHtml`
  ([contabilitate.tsx](packages/ui/src/pages/contabilitate.tsx)), `inventarHtml`
  ([rapoarte.tsx](packages/ui/src/pages/rapoarte.tsx)), plus antetul de brand
  ([print-branding.ts](packages/ui/src/lib/print-branding.ts)). **Verificat live**: un nume de firmă
  cu payload `<img src=x onerror=alert(document.cookie)>` apare literal, escapat, în factura tipărită;
  `window.__xssTriggered` rămâne `false`.
- **CSV/formula injection** (CWE-1236, `csvField` în același `safe-output.ts`): un câmp de export care
  începe cu `=`/`+`/`-`/`@` e interpretat ca formulă de Excel/LibreOffice la deschidere; aplicat pe toate
  exporturile CSV (D394, D390, șarja de debitare Mobilă) — prefixare cu `'` la formule, quoting la
  virgulă/ghilimele/newline.
- **`audit_log` forjabil de orice rol** (CRITIC): un client putea trimite `POST /audit_log` cu orice
  `{utilizator, rol}` dorea — jurnalul de audit, presupus sursă de adevăr pentru cine-a-făcut-ce, era
  complet nesigur. Corectat în [server/src/index.ts](server/src/index.ts): identitatea
  (`utilizator`/`rol`/`timp`) se suprascrie **întotdeauna** din sesiunea autentificată, niciodată din
  corpul cererii.
- **`SESSION_SECRET` cu fallback hardcodat** (CRITIC): un secret literal în sursă ar fi public prin
  însăși natura codului deschis — oricine l-ar citi putea emite un token de admin valid pentru orice
  deployment care a uitat să seteze variabila de mediu. Corectat
  ([server/src/auth.ts](server/src/auth.ts)): fallback la un secret **generat aleator la pornire**
  (`randomBytes(32)`) — costul e că sesiunile nu supraviețuiesc unui restart fără `SESSION_SECRET`
  explicit, acceptabil față de un secret cunoscut public.
- **Rate limiting/lockout la login**: 5 încercări eșuate consecutive pentru același utilizator →
  blocare 5 minute, verificată **înaintea** oricărei verificări de parolă (nu doar după eșec).
- **Logout real + revocare token + verificare `activ`**: un token semnat (stateless) nu putea fi
  „șters" — deconectarea din UI nu avea niciun efect server-side, iar dezactivarea unui utilizator din
  Setări nu bloca tokenul deja emis până la expirarea sa naturală (12 ore). Corectat: `POST /auth/logout`
  + un set de semnături revocate în memorie, plus verificarea `utilizator.activ` la fiecare cerere
  autentificată.
- **RBAC pe date sensibile**: `GET` pe `personal` (CNP-uri angajați), `operatiuni_bancare`,
  `mijloace_fixe`, `plan_conturi` nu cerea nicio permisiune — orice rol autentificat (inclusiv
  vânzător/gestionar) putea citi date fără legătură cu rolul lui. Corectat server-side
  ([permisiuneResursa](server/src/auth.ts)) **și** în navigarea client ([registry.ts](packages/ui/src/modules/registry.ts),
  [Sidebar.tsx](packages/ui/src/components/Sidebar.tsx)) — un `NavItem` poate acum suprascrie
  permisiunea grupului din care face parte — înainte, o suprascriere la nivel de element era pur și
  simplu ignorată de maparea din `registry.ts`.
- **Comparație non-constant-time a semnăturii de sesiune** (canal lateral de timp): `verificaToken`
  compara semnătura cu `!==` simplu — timpul de răspuns varia marginal cu câte caractere inițiale
  coincideau, teoretic exploatabil pentru reconstrucția semnăturii. Corectat cu o comparație XOR pe
  toată lungimea ([session.ts](packages/auth/src/session.ts)), la fel ca `verificaParola`.
- **CORS cu origine configurabilă**: `Access-Control-Allow-Origin: '*'` fix înlocuit cu o listă albă
  din `CORS_ORIGIN` (variabilă de mediu), calculată per-cerere din header-ul `Origin`.
- **Limită de mărime a corpului cererii**: `POST`/`PATCH` fără nicio limită permitea un client rău
  intenționat să trimită un corp arbitrar de mare; acum 5 MB, cu 413 explicit peste limită.
- **Licențiere: HMAC simetric → semnătură asimetrică ECDSA P-256** (constatare separată, marcată
  CRITIC de audit): schema veche folosea un **singur secret** (`VENDOR_SECRET`) atât pentru a semna
  cât și pentru a verifica licențe, shipat direct în codul clientului — oricine îl citea din bundle
  putea forja o licență „Complet" validă pentru orice instalare. Rescris complet în
  [`@gr/license`](packages/license) (vezi secțiunea dedicată mai sus): furnizorul ține cheia
  **privată** offline, clientul primește doar cheia **publică** (poate verifica, nu poate semna).
  **Verificat live, în ambele direcții**: o licență emisă cu scriptul furnizorului
  (`emite-licenta.mjs`) activează corect din Setări (client/ediție/module afișate corect); o licență
  „forjată" cu o pereche de chei diferită e respinsă — starea licenței rămâne neschimbată, nu preia
  identitatea din cheia forjată. Test dedicat de izolare asimetrică în
  [license.test.ts](packages/license/src/license.test.ts).
- **Decis, nu remediat — react-router (2 CVE moderate)**: `npm audit` semnalează 2 vulnerabilități
  moderate în `react-router` (versiunea majoră curentă); evaluate și **amânate deliberat** — CVE-urile
  țin de SSR/hidratare și de redirect-uri controlate de utilizator, niciunul aplicabil acestei
  aplicații (fără SSR, fără ținte de redirect din input extern), iar fix-ul (bump major, ~47 rute) are
  un risc de regresie disproporționat față de expunerea reală. `npm audit fix` a rezolvat restul
  avertismentelor rezolvabile fără bump major.

**Verificat**: 146 teste verzi (8 pachete, +13 față de runda anterioară — 4 noi în `@gr/license` pentru
schema asimetrică, restul deja existente), typecheck 10/10, lint curat, 2 teste e2e Playwright verzi,
build+PWA reușit. Verificare live completă în browser pentru fluxul de licențiere (activare validă +
respingere licență forjată) și pentru fix-ul XSS (payload real, neexecutat, escapat corect în ieșire).

## Fundație de producție (Faza 8)

- **Numerotare atomică** ([numerotare.ts](packages/data/src/numerotare.ts)): înlocuiește calculul
  client-side „maxim existent + 1" (vulnerabil la duplicate sub concurență și la coliziuni după
  ștergere) cu un alocator atomic — `UPDATE ... RETURNING` pe SQL, coadă de promisiuni pe memorie.
  Expus și prin server (`POST /numerotare/next`).
- **Jurnal de audit** ([audit.ts](packages/core-domain/src/audit.ts) + `withAudit` în
  [audit-wrapper.ts](packages/data/src/audit-wrapper.ts)): fiecare creare/actualizare/ștergere e
  înregistrată automat (utilizator, rol, câmpuri schimbate). Ecran `Audit → Jurnal de audit`,
  vizibil doar la permisiunea `audit.vizualizare` (implicit: admin).
- **Backup/restore** ([backup.ts](packages/data/src/backup.ts)): export complet în JSON, restaurare
  care **păstrează ID-urile și relațiile** dintre tabele (Setări → Backup și restaurare).
- **Multi-firmă** ([firma.ts](packages/core-domain/src/entities/firma.ts)): nomenclator de firme +
  selector persistat (o instalare poate gestiona mai multe firme, ex. un contabil cu mai mulți
  clienți). **Scopare reală a datelor** (documente/casă/bancă/mijloace fixe) — vezi secțiunea
  dedicată mai jos.
- **Server real, în workspace**: [`server/`](server) e acum membru al workspace-ului npm (`@gr/core-domain`/
  `@gr/data` se leagă automat), cu `DATABASE_URL` → PostgreSQL real + migrații automate la boot
  ([db.ts](server/src/db.ts)), `/health` + `/ready`, sau memorie (demo) fără `DATABASE_URL`.
  `docker compose up -d` pornește Postgres 16 + serverul.
- **Motor de sincronizare** ([engine.ts](packages/sync/src/engine.ts)): orchestrator generic peste
  `reconcile()` (push/pull cu callback-uri injectate). Setări → Mod de funcționare → verificare
  reală de conectivitate la server (`/health` + `/ready`).

> **Notă onestă**: motorul de sincronizare complet automat (offline↔server pentru toate cele ~16
> entități) necesită să adaug câmpurile `version`/`updatedAt` pe fiecare schemă de entitate — un pas
> mare, deliberat lăsat pentru o rundă dedicată, ca să nu risc regresii pe tot ce funcționează azi.
> Orchestratorul e complet funcțional și testat; rămâne să fie conectat per-entitate.

Vezi [docs/adr/0001-stack.md](docs/adr/0001-stack.md) pentru decizia de tehnologie și
[docs/ghid-module.md](docs/ghid-module.md) pentru adăugarea unei verticale noi.

## Ce urmează (onest, neimplementat încă)

Ca să fie clar ce e realmente gata față de ce rămâne — nimic din ce urmează nu e ascuns sau pretins gata:

- **Faza 11 — White-label (parțial)**: brandingul per firmă (logo, culoare primară, nume aplicație —
  vezi secțiunea dedicată mai jos) e implementat și verificat; rămân neîmplementate: șabloane PDF
  complet personalizabile (azi doar antet cu logo+denumire pe factură/deviz, restul documentului
  rămâne pe un format fix), manifestul PWA (titlul/culoarea din `manifest.webmanifest` sunt statice,
  fixate la build — un branding runtime complet ar necesita un manifest generat per instalare) și
  legarea culorii/logo-ului de payload-ul de licență (azi setate direct din Setări, per firmă, nu
  livrate centralizat de furnizor).
- **Export CNC**: lista de croire (CSV) e generică (poziții X/Y, dimensiuni, rotire) — nu într-un
  format specific unei mașini CNC anume (fiecare producător are propriul format de import).
- **CI/CD real**: `.github/workflows/ci.yml` există și fiecare pas a fost verificat manual, dar
  fișierul nu a rulat încă pe un runner GitHub Actions real (acest director nu are `.git`/remote);
  packaging nativ semnat (Authenticode/notarizare Apple) rămâne neînceput.
- **D300/D394/D390 sunt declarații de lucru, nu wire-format ANAF verificat**: agregarea (pe cotă/
  partener/țară) e corectă și testată, dar schema XML exactă a formularului oficial nu a fost
  validată împotriva sistemului declarativ ANAF live. **Intrastat** și **e-Transport (UIT)** rămân
  neîncepute.
- **Catalogul ERP all-inclusive (Partea III/B)**: Salarizare+REVISAL, Achiziții (3-way match ca ecran
  dedicat de reconciliere, nu doar legătura pasivă NIR↔factură care există azi), CRM, WMS (coduri de
  bare), POS+AMEF, integrări curieri/e-commerce, import bancar nativ **MT940/CAMT.053** (azi doar
  CSV) — niciunul neînceput; fiecare e un modul separat, dimensionat pentru o rundă proprie.
- **ANAF SPV live**: rămâne dependent de un certificat calificat real (mTLS deja pregătit în
  [server/src/mtls.ts](server/src/mtls.ts)), netestabil în acest mediu.
- **react-router — 2 CVE moderate, amânate deliberat**: privesc SSR/hidratare și redirect-uri
  controlate de utilizator, niciunul aplicabil arhitecturii actuale (client pur, fără SSR, fără
  redirect din input extern); bump-ul major (~47 rute afectate) a fost judecat disproporționat față
  de expunerea reală — de reevaluat dacă aplicația capătă vreodată SSR sau redirect-uri din input.
- **Revocarea de token și rate-limiting-ul de login sunt in-memory, per proces**: suficient pentru un
  singur server (ținta actuală, LAN/mic), dar nu supraviețuiesc unui restart și nu se propagă între mai
  multe instanțe ale serverului — un deployment cu load-balancing ar avea nevoie de un store partajat
  (Redis sau echivalent).
- **SaaS găzduit real (multi-tenant) NU este implementat** — și e important să fie clar, pentru că
  modelul comercial din Faza 17 poate crea impresia contrară. Ce există azi este un produs **licențiat
  per firmă**, instalat local sau pe serverul clientului, cu plan și număr de utilizatori impuse de
  licență. Ce ar mai fi necesar pentru un SaaS propriu-zis, găzduit de furnizor: **izolarea pe tenant**
  (azi o instalare deservește firmele unui singur client, nu clienți diferiți pe aceeași bază),
  **înregistrare self-service** cu trial automat, **facturare recurentă** și integrare cu un procesator
  de plăți, portal de administrare pentru furnizor, plus SLA/backup/monitorizare centralizate. Fiecare
  e o rundă proprie; niciunul nu e început.
- **Fără e-mail**: invitarea unui utilizator nou și resetarea parolei se fac de către administrator, care
  comunică parola inițială pe un canal ales de el. Nu există „am uitat parola" prin e-mail (ar necesita
  un server SMTP configurat) — acceptabil pentru instalări LAN cu administrator prezent, dar necesar
  înainte de un SaaS deschis.
- **Documentele legale (EULA, GDPR) sunt șabloane**, nu aviz juridic: acoperă situația tipică a acestui
  produs, dar denumirea furnizorului, datele de contact și instanța competentă trebuie completate, iar
  textul revizuit de un jurist înainte de prima vânzare.

Ordinea recomandată rămâne cea din planul de lucru: scoparea reală multi-firmă înaintea oricărui
catalog nou de module; CI există acum ca plasă de siguranță pentru tot ce urmează.
