import { randomBytes } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import {
  type Permisiune,
  type Rol,
  arePermisiune,
  emiteToken,
  verificaParola,
  verificaToken,
} from '@gr/auth';
import { celMaiRecentBlocaj, documentBlocat } from '@gr/core-domain';
import type { DataProvider } from '@gr/data';
import { log } from './log.js';

/**
 * Autentificare + autorizare reale pe server. Inainte de asta, RBAC-ul din
 * @gr/auth era verificat DOAR in UI (client) — un client care vorbeste direct
 * cu API-ul (fara UI) putea citi/scrie orice, necondiționat. Acum orice cerere
 * (in afara de /health, /ready, /auth/login) cere un token de sesiune valid,
 * iar fiecare resursa/verb cere permisiunea corespunzatoare din matricea de
 * roluri — acelasi `arePermisiune` folosit si de client.
 */

const DURATA_SESIUNE_MS = 12 * 60 * 60 * 1000; // 12 ore

export const SESSION_SECRET = (() => {
  const v = process.env.SESSION_SECRET;
  if (v) return v;
  // Un secret hardcodat (literal in sursa) ar fi public prin insasi natura
  // codului open — oricine il citeste ar putea emite un token de admin valid
  // pentru orice deployment care a uitat sa seteze SESSION_SECRET. In loc de
  // asta, generam un secret aleator la fiecare pornire: serverul tot
  // functioneaza fara configurare explicita (developer experience neschimbata),
  // dar secretul nu mai e ghicibil — costul e ca toate sesiunile sunt
  // invalidate la un restart (utilizatorii trebuie sa se re-autentifice),
  // acceptabil fata de un secret cunoscut public.
  log.warn(
    'SESSION_SECRET nesetat — folosesc un secret aleator generat la pornire ' +
      '(sesiunile nu supravietuiesc unui restart). Seteaza SESSION_SECRET explicit ' +
      'intr-un deployment real (LAN/cloud) pentru sesiuni stabile.',
  );
  return randomBytes(32).toString('hex');
})();

export interface SesiuneAutentificata {
  utilizatorId: string;
  nume: string;
  rol: Rol;
  firmaId: string | null;
}

/**
 * Token-uri revocate (semnatura, partea dupa ultimul punct) — tokenul in sine
 * ramane valid criptografic pana la expirare, dar un logout sau o dezactivare
 * trebuie sa aiba efect IMEDIAT, nu abia dupa `DURATA_SESIUNE_MS` (12 ore).
 * In-memory: pe un server cu mai multe procese/instante ar trebui mutata intr-un
 * store partajat (Redis etc.) — suficient insa pentru un singur proces (LAN/mic).
 */
const TOKENURI_REVOCATE = new Set<string>();

export function revocaToken(token: string): void {
  const sig = token.trim().split('.')[1];
  if (sig) TOKENURI_REVOCATE.add(sig);
}

// Protectie brute-force: dupa MAX_INCERCARI esuari consecutive pentru acelasi
// nume de utilizator, urmatoarele incercari sunt refuzate DIRECT (fara sa mai
// verifice parola) pentru DURATA_BLOCARE_MS. In-memory, per proces — suficient
// pentru un singur server (LAN/mic); un deployment cu mai multe instante ar
// avea nevoie de un store partajat (Redis etc.).
const MAX_INCERCARI = 5;
const DURATA_BLOCARE_MS = 5 * 60 * 1000; // 5 minute
interface StareIncercariLogin {
  esuari: number;
  blocatPanaLa: number;
}
const INCERCARI_LOGIN = new Map<string, StareIncercariLogin>();

function inregistreazaEsuareLogin(cheie: string): void {
  const stare = INCERCARI_LOGIN.get(cheie) ?? { esuari: 0, blocatPanaLa: 0 };
  stare.esuari++;
  if (stare.esuari >= MAX_INCERCARI) {
    stare.blocatPanaLa = Date.now() + DURATA_BLOCARE_MS;
    stare.esuari = 0;
  }
  INCERCARI_LOGIN.set(cheie, stare);
}

/** Cauta un utilizator activ dupa nume si verifica parola. Emite un token de sesiune la succes. */
export async function autentifica(
  provider: DataProvider,
  nume: string,
  parola: string,
): Promise<
  { ok: true; token: string; utilizator: SesiuneAutentificata } | { ok: false; motiv: string }
> {
  const cheieIncercari = nume.trim().toLowerCase();
  const stareIncercari = INCERCARI_LOGIN.get(cheieIncercari);
  if (stareIncercari && stareIncercari.blocatPanaLa > Date.now()) {
    const ramasSec = Math.ceil((stareIncercari.blocatPanaLa - Date.now()) / 1000);
    return { ok: false, motiv: `Prea multe incercari esuate — reincearca peste ${ramasSec}s.` };
  }

  const toti = await provider.utilizatori.list();
  const gasit = toti.find((u) => u.nume === nume);
  if (!gasit || !gasit.activ) {
    inregistreazaEsuareLogin(cheieIncercari);
    return { ok: false, motiv: 'utilizator sau parola incorecta' };
  }
  const parolaOk = await verificaParola(parola, gasit.parolaHash);
  if (!parolaOk) {
    inregistreazaEsuareLogin(cheieIncercari);
    return { ok: false, motiv: 'utilizator sau parola incorecta' };
  }
  INCERCARI_LOGIN.delete(cheieIncercari);

  const acum = new Date();
  const payload = {
    utilizatorId: gasit.id,
    nume: gasit.nume,
    rol: gasit.rol as Rol,
    firmaId: gasit.firmaId,
    emisLa: acum.toISOString(),
    expiraLa: new Date(acum.getTime() + DURATA_SESIUNE_MS).toISOString(),
  };
  const token = await emiteToken(payload, SESSION_SECRET);
  return { ok: true, token, utilizator: payload };
}

/**
 * Extrage + verifica tokenul Bearer dintr-o cerere. `null` daca lipseste sau
 * e invalid, revocat (logout) sau daca utilizatorul a fost between timp
 * dezactivat — fara verificarea din urma, dezactivarea unui utilizator din
 * Setari nu avea niciun efect practic pana la expirarea naturala a tokenului
 * (pana la 12 ore).
 */
export async function verificaCerere(
  req: IncomingMessage,
  provider: DataProvider,
): Promise<SesiuneAutentificata | null> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  const sig = token.split('.')[1];
  if (sig && TOKENURI_REVOCATE.has(sig)) return null;
  const rezultat = await verificaToken(token, SESSION_SECRET);
  if (!rezultat.valid) return null;
  const utilizator = await provider.utilizatori.getById(rezultat.payload.utilizatorId);
  if (!utilizator?.activ) return null;
  return rezultat.payload;
}

/** Permisiunea ceruta pentru o resursa (tabela) + verb HTTP, `null` = orice utilizator autentificat. */
export function permisiuneResursa(
  resource: string,
  method: string,
  curent?: { stare?: string } | null,
  bodyStare?: string | null,
): Permisiune | null {
  if (resource === 'utilizatori') return 'utilizatori.administrare';
  // audit_log: POST (creare) e permis oricui e autentificat (asa scrie withAudit
  // pe fiecare mutatie — identitatea reala e impusa de server, vezi index.ts).
  // PATCH/DELETE sunt blocate NECONDITIONAT direct in index.ts (append-only),
  // inainte sa ajunga aici — nu exista o permisiune care sa le deblocheze, de
  // aceea nu apar tratate separat mai jos.
  if (resource === 'audit_log') return method === 'GET' ? 'audit.vizualizare' : null;
  // Trezorerie (casa + banca): acelasi drept ca in UI (modulul "Trezorerie"
  // cere deja `casa.operare` pentru a vedea pagina) — casierul opereaza pe
  // ambele, nu doar pe registrul de casa.
  if (resource === 'operatiuni_casa' || resource === 'operatiuni_bancare') return 'casa.operare';
  // Date sensibile: fara o permisiune dedicata, orice utilizator autentificat
  // (inclusiv vanzator/gestionar) putea citi CNP-uri de angajati, registrul
  // mijloacelor fixe si planul de conturi al firmei — informatii care nu au
  // legatura cu vanzarea/gestiunea de zi cu zi.
  if (resource === 'personal') return 'personal.vizualizare';
  if (resource === 'mijloace_fixe' || resource === 'plan_conturi') {
    return 'contabilitate.vizualizare';
  }
  if (resource === 'documente' || resource === 'documente_linii') {
    if (method === 'GET') return null;
    if (method === 'DELETE') return 'documente.validare';
    if (method === 'POST') return 'documente.creare';
    if (method === 'PATCH') {
      const devineValidat = bodyStare === 'validat';
      const eraValidat = curent?.stare === 'validat';
      return devineValidat || eraValidat ? 'documente.validare' : 'documente.creare';
    }
    return 'documente.creare';
  }
  if (method === 'GET') return null; // nomenclatoare: lectura libera pentru orice utilizator autentificat
  return 'nomenclatoare.editare';
}

export function poateAccesa(rol: Rol, permisiune: Permisiune | null): boolean {
  return permisiune === null || arePermisiune(rol, permisiune);
}

/**
 * Inchidere de perioada: un document cu data <= data-limita de blocare (vezi
 * Firma.perioadaBlocataPanaLa) nu mai poate fi validat/editat/sters de NICIUN
 * rol, inclusiv admin — controlul se ridica explicit din Setari, nu se
 * ocoleste din ecranul de documente. Multi-firma nu scopeaza inca datele per
 * firma, deci se foloseste cea mai recenta blocare dintre toate firmele.
 */
export async function perioadaBlocataPentru(
  provider: DataProvider,
  dataDoc: string,
): Promise<boolean> {
  const firme = await provider.firme.list();
  return documentBlocat(dataDoc, celMaiRecentBlocaj(firme));
}
