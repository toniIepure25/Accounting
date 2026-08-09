import { createServer } from 'node:http';
import { genereazaDecontDinRegistre, genereazaSaftDinRegistre } from '@gr/application';
import { arePermisiune, hashParola, verificaParola } from '@gr/auth';
import { esteImutabil } from '@gr/core-domain';
import {
  type CursorDocument,
  type Repository,
  interogheazaDocumente,
  listeazaMiscariStocPersistate,
  listeazaNoteContabilePersistate,
  listeazaSolduriStoc,
  randuriVizibilePentruFirma,
} from '@gr/data';
import { chatAI } from './ai.js';
import {
  autentifica,
  invalideazaSesiuni,
  perioadaBlocataPentru,
  permisiuneResursa,
  poateAccesa,
  revocaToken,
  verificaCerere,
} from './auth.js';
import { COMENZI, type NumeComanda, ruleazaComanda } from './commands.js';
import { creeazaServerDb } from './db.js';
import { incarcaLicenta, maiIncapeUtilizatorActiv } from './licenta.js';
import { idCerere, log } from './log.js';

/** Versiunea si commit-ul, raportate de /version. Commit-ul vine din CI (env). */
const VERSIUNE = process.env.npm_package_version ?? '0.0.0';
const COMMIT = process.env.GIT_COMMIT ?? process.env.GITHUB_SHA ?? 'necunoscut';

/**
 * API REST pentru modurile retea (LAN) si cloud. Expune repository-urile
 * din @gr/data peste HTTP, cu acelasi contract pe care il consuma clientii prin
 * `createApiProvider`. Fara framework — doar node:http.
 *
 * Stocare: vezi db.ts — PostgreSQL real daca DATABASE_URL e setat, altfel
 * provider in-memory cu date demo (pornire instant, pentru probe).
 */
async function main() {
  const { provider, exec, persistent, verificaConexiune } = await creeazaServerDb();
  await incarcaLicenta();

  /** Lungime minima de parola impusa server-side (nu doar in formularul din UI). */
  const LUNGIME_MINIMA_PAROLA = 8;

  // Maparea resursa REST (nume tabela) -> repository.
  // biome-ignore lint/suspicious/noExplicitAny: registru eterogen de repo-uri
  const REPOS: Record<string, Repository<any, any>> = {
    firme: provider.firme,
    puncte_lucru: provider.puncteLucru,
    gestiuni: provider.gestiuni,
    parteneri: provider.parteneri,
    grupe_produse: provider.grupeProduse,
    produse: provider.produse,
    plan_conturi: provider.planConturi,
    personal: provider.personal,
    liste_preturi: provider.listePreturi,
    tip_consum: provider.tipuriConsum,
    obiecte_inventar: provider.obiecteInventar,
    preparate: provider.preparate,
    retete_linii: provider.reteteLinii,
    documente: provider.documente,
    documente_linii: provider.documenteLinii,
    operatiuni_casa: provider.operatiuniCasa,
    optiuni_configurator: provider.optiuniMobila,
    audit_log: provider.auditLog,
    utilizatori: provider.utilizatori,
    mijloace_fixe: provider.mijloaceFixe,
    operatiuni_bancare: provider.operatiuniBancare,
    profil_configurator: provider.profilConfigurator,
    combinatii_interzise: provider.combinatiiInterzise,
  };

  // Resurse tranzactionale scopate pe firma (vezi Document.firmaId) — restul
  // (nomenclatoare) raman comune tuturor firmelor dintr-o instalare. Aceeasi
  // regula (randuriVizibilePentruFirma) e aplicata si client-side
  // (packages/ui/src/lib/data-context.tsx `withFirmaScope`), dar AICI e
  // impunerea reala pentru modurile retea/cloud — un client nu poate fi de
  // incredere sa se auto-limiteze la firma lui.
  const RESURSE_SCOPATE_PE_FIRMA = new Set([
    'documente',
    'documente_linii',
    'operatiuni_casa',
    'operatiuni_bancare',
    'mijloace_fixe',
  ]);

  /** Mesajul de depasire a licentei — acelasi la creare si la reactivare. */
  const mesajLicentaPlina = (max: number | null, activi: number) =>
    `Licenta permite ${max} utilizatori activi (folositi: ${activi}). Dezactiveaza un cont existent sau treci la un plan superior.`;

  /**
   * Invariant de siguranta: instalarea trebuie sa ramana mereu cu cel putin un
   * administrator activ. Fara asta, ultimul admin isi poate schimba rolul,
   * se poate dezactiva sau sterge — si nimeni nu mai poate administra
   * utilizatorii, licenta sau setarile, fara interventie manuala in baza de
   * date. Impus pe server, nu doar ascuns in UI.
   */
  async function ramaneUnAdminActiv(
    utilizatorId: string,
    dupaSchimbare: { rol?: string; activ?: boolean } | null,
  ): Promise<boolean> {
    const toti = await provider.utilizatori.list();
    const adminiActivi = toti.filter((u) => u.rol === 'admin' && u.activ);
    const esteVizatAdminActiv = adminiActivi.some((u) => u.id === utilizatorId);
    if (!esteVizatAdminActiv) return true; // nu atingem un admin activ

    // `dupaSchimbare === null` inseamna stergere.
    const ramaneAdmin =
      dupaSchimbare !== null &&
      (dupaSchimbare.rol ?? 'admin') === 'admin' &&
      (dupaSchimbare.activ ?? true) === true;
    if (ramaneAdmin) return true;

    return adminiActivi.length > 1;
  }

  function apartineFirmei(
    row: { firmaId?: string | null } | null,
    firmaId: string | null,
  ): boolean {
    if (!row) return false;
    if (!firmaId) return true; // sesiune fara firma asignata (super-admin) vede tot
    return row.firmaId == null || row.firmaId === firmaId;
  }

  const PORT = Number(process.env.PORT ?? 8787);

  // Fara CORS_ORIGIN setat, ramane wildcard (`*`) — comportamentul de pana acum,
  // potrivit pentru retea locala unde terminalele pot avea orice hostname/IP.
  // Cu auth prin Bearer token (nu cookie), wildcard-ul nu e exploatabil azi
  // (un site tert nu poate citi tokenul altcuiva), dar pentru un deployment
  // cloud expus pe internet, operatorul poate restrange explicit la origini
  // cunoscute (lista separata prin virgula).
  const CORS_ORIGINS = process.env.CORS_ORIGIN?.split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  // Fara o limita, un client (autentificat sau nu, pe rutele dinaintea
  // verificaCerere) ar putea trimite un corp de cerere nemarginit, umpland
  // memoria serverului — un vector simplu de epuizare a resurselor (DoS).
  // 5 MB e generos pentru orice corp legitim din aplicatie (inclusiv un logo
  // de firma incarcat ca data URL, limitat oricum la 400 KB in UI).
  const LIMITA_CORP_BYTES = 5 * 1024 * 1024;
  class CorpPreaMare extends Error {}

  async function readBody(req: import('node:http').IncomingMessage): Promise<unknown> {
    const chunks: Buffer[] = [];
    let total = 0;
    for await (const c of req) {
      total += (c as Buffer).length;
      if (total > LIMITA_CORP_BYTES)
        throw new CorpPreaMare('corpul cererii depaseste limita admisa');
      chunks.push(c as Buffer);
    }
    const raw = Buffer.concat(chunks).toString('utf8');
    return raw ? JSON.parse(raw) : {};
  }

  const server = createServer(async (req, res) => {
    // Un id per cerere, corelabil intre logul de acces si eventualele erori;
    // intors si clientului in `x-request-id` ca sa poata fi cautat in loguri.
    const idReq = idCerere();
    const start = performance.now();
    const send = (status: number, body?: unknown) => {
      const cerut = req.headers.origin;
      const acao = !CORS_ORIGINS
        ? '*'
        : cerut && CORS_ORIGINS.includes(cerut)
          ? cerut
          : (CORS_ORIGINS[0] ?? '*');
      res.writeHead(status, {
        'content-type': 'application/json',
        'access-control-allow-origin': acao,
        'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
        // 'authorization' e necesar de cand clientul ataseaza tokenul de sesiune
        // (Bearer) pe fiecare cerere — fara el, browserul respinge cererea la
        // nivel de CORS inainte sa ajunga la server (preflight OPTIONS trece,
        // dar cererea reala e blocata local in browser).
        'access-control-allow-headers': 'content-type, authorization',
        'access-control-expose-headers': 'x-request-id',
        'x-request-id': idReq,
      });
      res.end(body === undefined ? '' : JSON.stringify(body));
      // Log de acces structurat, o linie per cerere. `health`/`ready` sunt
      // zgomotoase (probe de orchestrare la fiecare cateva secunde) — le lasam
      // pe `debug`, restul pe `info`, iar erorile 5xx pe `warn`.
      const durataMs = Math.round(performance.now() - start);
      const cale = (req.url ?? '/').split('?')[0];
      const nivel =
        status >= 500 ? 'warn' : cale === '/health' || cale === '/ready' ? 'debug' : 'info';
      log[nivel]('cerere', { idReq, metoda: req.method, cale, status, durataMs });
    };
    try {
      if (req.method === 'OPTIONS') return send(204);
      const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
      const [, resource, id, actiune] = url.pathname.split('/');

      // Versiune + commit — util pentru a sti exact ce ruleaza in productie.
      if (resource === 'version')
        return send(200, { versiune: VERSIUNE, commit: COMMIT, persistent });
      // Liveness: procesul ruleaza. Readiness: baza de date raspunde (relevant
      // in mod PostgreSQL — util pentru orchestrare / load balancer).
      if (resource === 'health') return send(200, { ok: true, persistent });
      if (resource === 'ready') {
        const gata = await verificaConexiune();
        return send(gata ? 200 : 503, { gata, persistent });
      }

      // Autentificare: emite un token de sesiune (vezi @gr/auth) daca parola e corecta.
      if (resource === 'auth' && id === 'login' && req.method === 'POST') {
        const body = (await readBody(req)) as { nume?: string; parola?: string };
        const rezultat = await autentifica(provider, body.nume ?? '', body.parola ?? '');
        if (!rezultat.ok) return send(401, { error: rezultat.motiv });
        return send(200, { token: rezultat.token, utilizator: rezultat.utilizator });
      }
      // Logout: revoca tokenul curent explicit — fara asta, un token Bearer
      // (stateless) ramanea valid pana la expirarea sa naturala (12 ore) chiar
      // dupa ce utilizatorul apasa "Deconectare".
      if (resource === 'auth' && id === 'logout' && req.method === 'POST') {
        const header = req.headers.authorization;
        if (header?.startsWith('Bearer ')) revocaToken(header.slice('Bearer '.length).trim());
        return send(204);
      }

      // De aici incolo (in afara de health/ready/auth/login/logout de mai sus),
      // orice cerere trebuie sa poarte un token de sesiune valid — inainte,
      // API-ul accepta orice cerere necondiționat, ceea ce facea RBAC-ul din UI
      // (client) pur decorativ pentru un server expus in retea.
      const sesiune = await verificaCerere(req, provider);
      if (!sesiune) return send(401, { error: 'autentificare necesara' });

      // Comenzi autoritare: POST /commands/<nume>. Postarea/stornarea sunt
      // evenimente de business (stoc + jurnal + fiscal atomic prin @gr/application),
      // nu PATCH-uri de stare — UI-ul le trimite ca sa nu ocoleasca motorul.
      if (resource === 'commands' && id) {
        if (req.method !== 'POST') return send(405, { error: 'metoda nepermisa' });
        if (!COMENZI.includes(id as NumeComanda)) {
          return send(404, { error: `comanda necunoscuta: ${id}` });
        }
        // Postarea/stornarea = validare de document; aprobarea/anularea = creare.
        const permisiune =
          id === 'approve-document' || id === 'cancel-document'
            ? 'documente.creare'
            : 'documente.validare';
        if (!poateAccesa(sesiune.rol, permisiune)) {
          return send(403, { error: 'acces interzis' });
        }
        // biome-ignore lint/suspicious/noExplicitAny: corp JSON al comenzii
        const body = (await readBody(req)) as any;
        const rez = await ruleazaComanda(exec, id, body ?? {}, sesiune.nume);
        return send(rez.status, rez.body);
      }

      // Rapoarte citite din REGISTRELE persistente (sursa de adevar), nu
      // recalculate din documente in client. GET /reports/journal intoarce notele
      // contabile din journal_entries + journal_lines, scopate pe firma sesiunii.
      if (resource === 'reports' && id === 'journal') {
        if (req.method !== 'GET') return send(405, { error: 'metoda nepermisa' });
        if (!poateAccesa(sesiune.rol, 'contabilitate.vizualizare')) {
          return send(403, { error: 'acces interzis' });
        }
        const note = await listeazaNoteContabilePersistate(exec, sesiune.firmaId);
        return send(200, note);
      }

      // GET /reports/stock: miscarile + soldurile de stoc din registrul persistat
      // (fise de magazie, balanta stocurilor, rulaje), scopate pe firma sesiunii.
      if (resource === 'reports' && id === 'stock') {
        if (req.method !== 'GET') return send(405, { error: 'metoda nepermisa' });
        if (!poateAccesa(sesiune.rol, 'rapoarte.vizualizare')) {
          return send(403, { error: 'acces interzis' });
        }
        const [miscari, solduri] = await Promise.all([
          listeazaMiscariStocPersistate(exec, sesiune.firmaId),
          listeazaSolduriStoc(exec, sesiune.firmaId),
        ]);
        return send(200, { miscari, solduri });
      }

      // GET /reports/decont?de=&pana=: decontul de TVA (baza D300) din evenimentele
      // fiscale persistate, scopat pe firma sesiunii — fara dubla numarare NIR.
      if (resource === 'reports' && id === 'decont') {
        if (req.method !== 'GET') return send(405, { error: 'metoda nepermisa' });
        if (!poateAccesa(sesiune.rol, 'contabilitate.vizualizare')) {
          return send(403, { error: 'acces interzis' });
        }
        const decont = await genereazaDecontDinRegistre(
          { exec, actor: sesiune.nume },
          {
            de: url.searchParams.get('de') || undefined,
            pana: url.searchParams.get('pana') || undefined,
            firmaId: sesiune.firmaId,
          },
        );
        return send(200, decont);
      }

      // GET /reports/documents: lista de documente KEYSET-paginata (RK-13) — filtrare
      // + paginare pe SERVER (indexata, LIMIT marginit), scopata pe firma sesiunii,
      // in loc de a aduce toata tabela in client si a o filtra acolo. Cursor prin
      // (cursor_data, cursor_id); `urmatorCursor` in raspuns cand mai exista o pagina.
      if (resource === 'reports' && id === 'documents') {
        if (req.method !== 'GET') return send(405, { error: 'metoda nepermisa' });
        const q = url.searchParams;
        const cursorData = q.get('cursor_data');
        const cursorId = q.get('cursor_id');
        const dupa: CursorDocument | undefined =
          cursorData && cursorId ? { data: cursorData, id: cursorId } : undefined;
        const pagina = await interogheazaDocumente(
          exec,
          {
            firmaId: sesiune.firmaId,
            tip: q.get('tip') || undefined,
            stare: q.get('stare') || undefined,
            partenerId: q.get('partener_id') || undefined,
            de: q.get('de') || undefined,
            pana: q.get('pana') || undefined,
          },
          { limita: q.get('limita') ? Number(q.get('limita')) : undefined, dupa },
        );
        return send(200, pagina);
      }

      // GET /reports/saft?an=&luna=: fisierul SAF-T (D406) generat din registrul
      // contabil PERSISTAT (partida dubla), reconciliat, scopat pe firma sesiunii —
      // nu recompus din documente in client. Intoarce { xml, reconciliere }.
      if (resource === 'reports' && id === 'saft') {
        if (req.method !== 'GET') return send(405, { error: 'metoda nepermisa' });
        if (!poateAccesa(sesiune.rol, 'contabilitate.vizualizare')) {
          return send(403, { error: 'acces interzis' });
        }
        const an = Number(url.searchParams.get('an')) || new Date().getFullYear();
        const luna = Number(url.searchParams.get('luna')) || new Date().getMonth() + 1;
        const ll = String(luna).padStart(2, '0');
        const de = `${an}-${ll}-01`;
        const pana = `${an}-${ll}-${String(new Date(an, luna, 0).getDate()).padStart(2, '0')}`;
        // Identitatea firmei vine din sesiune (nu din client), autoritar.
        const firma = sesiune.firmaId ? await provider.firme.getById(sesiune.firmaId) : null;
        const rezultat = await genereazaSaftDinRegistre(
          { exec, actor: sesiune.nume },
          {
            companie: {
              nume: firma?.denumire || 'Firma nesetata',
              cui: firma?.cui || '',
              perioadaLuna: luna,
              perioadaAn: an,
            },
            de,
            pana,
            firmaId: sesiune.firmaId,
          },
        );
        return send(200, rezultat);
      }

      // Schimbarea propriei parole: cere parola veche (o sesiune furata nu
      // trebuie sa permita preluarea definitiva a contului) si revoca tokenul
      // curent la succes, fortand o reautentificare cu parola noua.
      if (resource === 'auth' && id === 'schimba-parola' && req.method === 'POST') {
        const body = (await readBody(req)) as { parolaVeche?: string; parolaNoua?: string };
        const noua = body.parolaNoua ?? '';
        if (noua.length < LUNGIME_MINIMA_PAROLA) {
          return send(400, {
            error: `parola noua trebuie sa aiba cel putin ${LUNGIME_MINIMA_PAROLA} caractere`,
          });
        }
        const eu = await provider.utilizatori.getById(sesiune.utilizatorId);
        if (!eu) return send(404, { error: 'utilizator inexistent' });
        if (!(await verificaParola(body.parolaVeche ?? '', eu.parolaHash))) {
          return send(403, { error: 'parola actuala este incorecta' });
        }
        await provider.utilizatori.update(eu.id, { parolaHash: await hashParola(noua) });
        // Delogare de peste tot: invalideaza toate sesiunile (nu doar tokenul
        // curent) dupa schimbarea parolei — un token furat pe alt dispozitiv nu
        // mai e valabil imediat.
        await invalideazaSesiuni(provider, eu.id);
        const header = req.headers.authorization;
        if (header?.startsWith('Bearer ')) revocaToken(header.slice('Bearer '.length).trim());
        return send(204);
      }

      // Resetarea parolei altui utilizator — doar pentru administratori.
      // Nu cere parola veche (administratorul nu o cunoaste, si nici nu trebuie).
      if (resource === 'utilizatori' && id && actiune === 'reseteaza-parola') {
        if (req.method !== 'POST') return send(405, { error: 'metoda nepermisa' });
        if (!arePermisiune(sesiune.rol, 'utilizatori.administrare')) {
          return send(403, { error: 'acces interzis' });
        }
        const body = (await readBody(req)) as { parolaNoua?: string };
        const noua = body.parolaNoua ?? '';
        if (noua.length < LUNGIME_MINIMA_PAROLA) {
          return send(400, {
            error: `parola trebuie sa aiba cel putin ${LUNGIME_MINIMA_PAROLA} caractere`,
          });
        }
        const tinta = await provider.utilizatori.getById(id);
        if (!tinta) return send(404, { error: 'utilizator inexistent' });
        await provider.utilizatori.update(id, { parolaHash: await hashParola(noua) });
        // Resetarea parolei de catre admin invalideaza sesiunile tintei — daca
        // resetarea e din cauza unui cont compromis, sesiunile atacatorului cad.
        await invalideazaSesiuni(provider, id);
        return send(204);
      }

      // Starea licentei vazuta de server (consum de utilizatori) — folosita de
      // ecranul de administrare ca sa afiseze "X din Y utilizatori".
      if (resource === 'licenta' && id === 'stare' && req.method === 'GET') {
        const { activi, max } = await maiIncapeUtilizatorActiv(provider);
        return send(200, { utilizatoriActivi: activi, utilizatoriMax: max });
      }

      // Alocare atomica de numere de document (vezi @gr/data numerotare.ts).
      if (resource === 'numerotare' && id === 'next' && req.method === 'POST') {
        const body = (await readBody(req)) as {
          tipDocument: string;
          an: number;
          prefixImplicit: string;
          lungimeImplicita?: number;
        };
        const rezultat = await provider.numerotare.next(
          body.tipDocument,
          body.an,
          body.prefixImplicit,
          body.lungimeImplicita,
        );
        return send(200, rezultat);
      }

      // Agent Claude (cheia API ramane pe server).
      if (resource === 'ai' && id === 'chat' && req.method === 'POST') {
        const body = (await readBody(req)) as {
          mesaje: { rol: 'user' | 'assistant'; text: string }[];
          ctx: unknown;
        };
        const text = await chatAI(body.mesaje ?? [], body.ctx ?? {});
        return send(200, { text });
      }

      const repo = resource ? REPOS[resource] : undefined;
      if (!repo) return send(404, { error: 'resursa necunoscuta' });
      const numeResursa = resource ?? '';

      // Utilizatori: nu expunem niciodata hash-ul de parola in raspunsuri.
      // biome-ignore lint/suspicious/noExplicitAny: forma eterogena a randurilor din REPOS
      const ascundeHash = (row: any) => {
        if (numeResursa !== 'utilizatori' || !row) return row;
        const { parolaHash: _parolaHash, ...rest } = row;
        return rest;
      };

      const scopatPeFirma = RESURSE_SCOPATE_PE_FIRMA.has(numeResursa);

      if (req.method === 'GET') {
        if (!poateAccesa(sesiune.rol, permisiuneResursa(numeResursa, 'GET'))) {
          return send(403, { error: 'acces interzis' });
        }
        if (!id) {
          const toate = await repo.list();
          const vizibile = scopatPeFirma
            ? randuriVizibilePentruFirma(toate, sesiune.firmaId)
            : toate;
          return send(200, vizibile.map(ascundeHash));
        }
        const e = await repo.getById(id);
        if (!e) return send(404, { error: 'inexistent' });
        // Din perspectiva unei alte firme, randul pur si simplu nu exista —
        // 404, nu 403, ca sa nu confirmam nici macar existenta lui.
        if (scopatPeFirma && !apartineFirmei(e, sesiune.firmaId)) {
          return send(404, { error: 'inexistent' });
        }
        return send(200, ascundeHash(e));
      }
      if (req.method === 'POST') {
        if (!poateAccesa(sesiune.rol, permisiuneResursa(numeResursa, 'POST'))) {
          return send(403, { error: 'acces interzis' });
        }
        // biome-ignore lint/suspicious/noExplicitAny: REPOS e un registru eterogen (Repository<any, any>)
        const body = (await readBody(req)) as any;
        // Firma vine din SESIUNE, nu din corpul cererii — un client nu poate
        // crea date "in numele" altei firme trimitand un firmaId diferit.
        if (scopatPeFirma && sesiune.firmaId) body.firmaId = sesiune.firmaId;
        // Identitatea si timpul unei intrari de audit vin din SESIUNE, nu din
        // corpul cererii — altfel orice utilizator autentificat ar putea POST-a
        // o intrare care impersoneaza pe altcineva (`utilizator`/`rol` arbitrare),
        // falsificand jurnalul de audit. Actiunea/entitatea raman cele trimise
        // de client (asa scrie `withAudit` pe fiecare mutatie), doar cine-a-facut
        // si cand sunt impuse autoritativ aici.
        if (numeResursa === 'audit_log') {
          body.utilizator = sesiune.nume;
          body.rol = sesiune.rol;
          body.timp = new Date().toISOString();
        }
        // Limita de utilizatori din licenta, impusa AICI (nu doar in UI): un
        // client care vorbeste direct cu API-ul nu trebuie sa poata depasi
        // planul platit. Conturile dezactivate nu se numara.
        if (numeResursa === 'utilizatori' && body.activ !== false) {
          const { ok, activi, max } = await maiIncapeUtilizatorActiv(provider);
          if (!ok) {
            return send(402, {
              error: mesajLicentaPlina(max, activi),
            });
          }
        }
        return send(201, ascundeHash(await repo.create(body)));
      }
      if (req.method === 'PATCH' && id) {
        // Jurnalul de audit e append-only: nicio modificare, de la niciun rol
        // (nici admin) — altfel un utilizator ar putea rescrie istoricul.
        if (numeResursa === 'audit_log') {
          return send(403, {
            error: 'jurnalul de audit este append-only — nu poate fi modificat',
          });
        }
        // biome-ignore lint/suspicious/noExplicitAny: REPOS e un registru eterogen (Repository<any, any>)
        const patch = (await readBody(req)) as any;
        // `utilizatori` are nevoie de starea curenta ca sa deosebeasca o
        // REACTIVARE (consuma o licenta) de o simpla editare a unui cont deja
        // activ (nu consuma nimic) — fara asta, schimbarea rolului cuiva ar fi
        // refuzata cand licenta e exact la limita.
        const curent =
          numeResursa === 'documente' || numeResursa === 'utilizatori' || scopatPeFirma
            ? await repo.getById(id)
            : null;
        if (scopatPeFirma && !apartineFirmei(curent, sesiune.firmaId)) {
          return send(404, { error: 'inexistent' });
        }
        if (scopatPeFirma) {
          // Nu lasa clientul sa "mute" randul la alta firma printr-un patch.
          // Cheia trebuie OMISA complet, nu setata `undefined`: fuziunea
          // `{...current, ...patch}` din repo-uri ar trata `undefined` ca
          // prezent si ar lasa firmaId pe valoarea implicita din schema Zod
          // (null), nu pe cea din `current`.
          // biome-ignore lint/performance/noDelete: `patch.firmaId = undefined` ar sterge firmaId-ul existent la actualizare (vezi comentariul de mai sus) — delete e singura optiune corecta aici.
          delete patch.firmaId;
        }
        if (
          !poateAccesa(
            sesiune.rol,
            permisiuneResursa(
              numeResursa,
              'PATCH',
              numeResursa === 'documente' ? curent : null,
              patch?.stare ?? null,
            ),
          )
        ) {
          return send(403, { error: 'acces interzis' });
        }
        if (numeResursa === 'utilizatori' && !(await ramaneUnAdminActiv(id, patch ?? {}))) {
          return send(409, {
            error:
              'Trebuie sa ramana cel putin un administrator activ. ' +
              'Promoveaza alt utilizator la rol de administrator inainte de aceasta schimbare.',
          });
        }
        // Reactivarea unui cont consuma o licenta la fel ca o creare — altfel
        // limita s-ar putea ocoli dezactivand si reactivand conturi in bucla.
        if (numeResursa === 'utilizatori' && patch?.activ === true) {
          const eraInactiv = curent ? curent.activ === false : true;
          if (eraInactiv) {
            const { ok, activi, max } = await maiIncapeUtilizatorActiv(provider);
            if (!ok) {
              return send(402, { error: mesajLicentaPlina(max, activi) });
            }
          }
        }
        // Imutabilitatea documentului (Faza 3, ADR-0003): un document POSTAT
        // (validat) / stornat / anulat nu mai poate fi modificat prin CRUD
        // generic — de la niciun rol. Corectarea se face prin stornare, nu prin
        // editare in loc. Aceasta e aplicarea server-side a agregatului.
        if (numeResursa === 'documente' && curent && esteImutabil(curent.stare)) {
          return send(409, {
            error:
              'documentul este postat/stornat/anulat (imutabil) — nu poate fi modificat; ' +
              'foloseste stornarea pentru corectii',
          });
        }
        // Inchidere de perioada: se aplica NECONDITIONAT (inclusiv admin), doar
        // pe `documente` — verifica atat data curenta cat si data noua din
        // patch (daca se schimba), ca sa nu poata fi ocolita schimband data.
        if (numeResursa === 'documente' && curent) {
          const dataNoua = patch?.data ?? curent.data;
          const firmaDoc = (curent as { firmaId?: string | null }).firmaId ?? null;
          if (
            (await perioadaBlocataPentru(provider, curent.data, firmaDoc)) ||
            (await perioadaBlocataPentru(provider, dataNoua, firmaDoc))
          ) {
            return send(423, {
              error: 'perioada inchisa — documentul nu mai poate fi modificat',
            });
          }
        }
        return send(200, ascundeHash(await repo.update(id, patch)));
      }
      if (req.method === 'DELETE' && id) {
        // Jurnalul de audit e append-only: nicio stergere, de la niciun rol.
        if (numeResursa === 'audit_log') {
          return send(403, {
            error: 'jurnalul de audit este append-only — nu poate fi sters',
          });
        }
        if (!poateAccesa(sesiune.rol, permisiuneResursa(numeResursa, 'DELETE'))) {
          return send(403, { error: 'acces interzis' });
        }
        const curent = numeResursa === 'documente' || scopatPeFirma ? await repo.getById(id) : null;
        if (scopatPeFirma && !apartineFirmei(curent, sesiune.firmaId)) {
          return send(404, { error: 'inexistent' });
        }
        if (numeResursa === 'documente' && curent && esteImutabil(curent.stare)) {
          return send(409, {
            error:
              'documentul este postat/stornat/anulat (imutabil) — nu poate fi sters; ' +
              'foloseste stornarea pentru corectii',
          });
        }
        if (
          numeResursa === 'documente' &&
          curent &&
          (await perioadaBlocataPentru(
            provider,
            curent.data,
            (curent as { firmaId?: string | null }).firmaId ?? null,
          ))
        ) {
          return send(423, { error: 'perioada inchisa — documentul nu mai poate fi sters' });
        }
        if (numeResursa === 'utilizatori' && !(await ramaneUnAdminActiv(id, null))) {
          return send(409, {
            error:
              'Trebuie sa ramana cel putin un administrator activ. ' +
              'Promoveaza alt utilizator la rol de administrator inainte de a sterge acest cont.',
          });
        }
        await repo.remove(id);
        return send(204);
      }
      return send(405, { error: 'metoda nepermisa' });
    } catch (err) {
      if (err instanceof CorpPreaMare) {
        send(413, { error: 'corpul cererii este prea mare' });
        return;
      }
      // Detaliul erorii (care poate contine mesaje interne de la baza de date
      // sau stack trace) se logheaza server-side, NU se trimite clientului —
      // altfel ar fi o scurgere de informatii. Clientul primeste doar id-ul
      // cererii, cu care o problema raportata poate fi corelata in loguri.
      log.error('eroare neasteptata', {
        idReq,
        cale: (req.url ?? '/').split('?')[0],
        eroare: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      send(500, { error: 'eroare interna', idReq });
    }
  });

  // `listen` raporteaza esecul printr-un eveniment 'error' asincron, NU printr-o
  // exceptie — deci `main().catch` de mai jos nu l-ar prinde. Fara un handler
  // explicit, o eroare de pornire (ex. portul deja ocupat) ar aparea ca un
  // crash brut 'Unhandled error event', nu ca un mesaj clar in loguri.
  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      log.error('portul este deja ocupat — alt proces asculta pe el?', { port: PORT });
    } else {
      log.error('eroare de server', { eroare: err.message });
    }
    process.exit(1);
  });

  server.listen(PORT, () => {
    log.info('server pornit', {
      port: PORT,
      stocare: persistent ? 'postgresql' : 'in-memory (demo)',
      versiune: VERSIUNE,
    });
  });
}

main().catch((err) => {
  log.error('eroare fatala la pornire', {
    eroare: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  process.exit(1);
});
