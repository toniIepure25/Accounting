import type { EditionId, ModuleId, PlanId } from './editions.js';

/**
 * Licenta = payload semnat cu cheia PRIVATA a furnizorului (ECDSA P-256).
 * Verificarea foloseste doar cheia PUBLICA — poate fi distribuita in clientul
 * livrat (embedded in cod) fara sa permita cuiva sa emita o licenta noua.
 * Spre deosebire de o schema simetrica (HMAC cu un singur secret), cheia
 * publica NU poate fi folosita pentru a semna — doar pentru a verifica.
 */
export interface LicentaPayload {
  client: string;
  editie: EditionId;
  /** Suprascrie modulele editiei (optional). */
  module?: ModuleId[];
  emisLa: string; // ISO
  expira: string | null; // ISO sau null (perpetua)
  /**
   * Campuri comerciale — toate OPTIONALE, ca licentele emise inainte de
   * introducerea planurilor sa ramana valide si sa se comporte ca inainte
   * (fara plan = fara limita de utilizatori, fara trial).
   */
  plan?: PlanId;
  /** Numar maxim de utilizatori activi; `null`/absent = nelimitat. */
  utilizatoriMax?: number | null;
  /** Licenta de evaluare — UI-ul o semnaleaza distinct fata de una platita. */
  trial?: boolean;
}

const enc = new TextEncoder();

function base64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromBase64url(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  // Tipul de retur explicit Uint8Array<ArrayBuffer> (nu doar Uint8Array, care
  // in TS 5.9 e implicit Uint8Array<ArrayBufferLike>) e necesar pentru a fi
  // acceptat direct ca BufferSource de `crypto.subtle.verify` mai jos.
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const ALGORITM_CHEIE = { name: 'ECDSA', namedCurve: 'P-256' } as const;
const ALGORITM_SEMNARE = { name: 'ECDSA', hash: 'SHA-256' } as const;

/**
 * Cheia PUBLICA demo a furnizorului — folosita implicit de client (UI) SI de
 * server, ca sa nu poata aparea drift intre ele (o cheie schimbata intr-un loc
 * si uitata in celalalt ar face licentele valide sa fie respinse de server sau
 * invers). Fiind publica, prezenta ei in cod nu permite emiterea de licente.
 *
 * Un deployment real isi genereaza propria pereche cu
 * `scripts/genereaza-chei.mjs` si inlocuieste aceasta constanta (clientul),
 * respectiv seteaza `LICENSE_PUBLIC_KEY` (serverul).
 */
export const CHEIE_PUBLICA_DEMO: JsonWebKey = {
  key_ops: ['verify'],
  ext: true,
  kty: 'EC',
  x: '_fKr6TLIT4hIiWvaNKdZ9ojrYLeVYu-X6Z5jImeHNFg',
  y: 'VTb1oCnQNVe8NczX7mkwaa2k_KqX6XrH7-1jeH45rbs',
  crv: 'P-256',
};

/**
 * Genereaza o pereche noua de chei. Se ruleaza O SINGURA DATA, offline, de
 * catre furnizor (vezi scripts/genereaza-chei.mjs) — cheia privata NU se
 * distribuie niciodata clientilor, doar cea publica ajunge in cod.
 */
export async function genereazaPerechiChei(): Promise<{
  cheiePublica: JsonWebKey;
  cheiePrivata: JsonWebKey;
}> {
  const perechea = await crypto.subtle.generateKey(ALGORITM_CHEIE, true, ['sign', 'verify']);
  const [cheiePublica, cheiePrivata] = await Promise.all([
    crypto.subtle.exportKey('jwk', perechea.publicKey),
    crypto.subtle.exportKey('jwk', perechea.privateKey),
  ]);
  return { cheiePublica, cheiePrivata };
}

async function importaCheiePrivata(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey('jwk', jwk, ALGORITM_CHEIE, false, ['sign']);
}
async function importaCheiePublica(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey('jwk', jwk, ALGORITM_CHEIE, false, ['verify']);
}

/** Emite o cheie de licenta semnata cu cheia PRIVATA (folosit de furnizor la vanzare). */
export async function emiteLicenta(
  payload: LicentaPayload,
  cheiePrivataJwk: JsonWebKey,
): Promise<string> {
  const body = base64url(enc.encode(JSON.stringify(payload)));
  const cheie = await importaCheiePrivata(cheiePrivataJwk);
  const semnatura = await crypto.subtle.sign(ALGORITM_SEMNARE, cheie, enc.encode(body));
  return `${body}.${base64url(new Uint8Array(semnatura))}`;
}

export type RezultatLicenta =
  | { valida: true; payload: LicentaPayload }
  /**
   * Semnatura e corecta, doar data a trecut — payload-ul se returneaza TOTUSI,
   * ca apelantul sa poata aplica o perioada de gratie (vezi stare.ts). Fara
   * asta, o licenta expirata ar fi indistinguibila de una falsificata, iar
   * clientul ar pierde brusc accesul la propriile date in ziua expirarii.
   */
  | { valida: false; motiv: 'expirata'; payload: LicentaPayload }
  | { valida: false; motiv: 'format' | 'semnatura' };

/** Verifica o cheie de licenta cu cheia PUBLICA a furnizorului si returneaza payload-ul daca e valida. */
export async function verificaLicenta(
  cheie: string,
  cheiePublicaJwk: JsonWebKey,
  acum = new Date(),
): Promise<RezultatLicenta> {
  const parts = cheie.trim().split('.');
  if (parts.length !== 2) return { valida: false, motiv: 'format' };
  const [body, sig] = parts;

  let ok: boolean;
  try {
    const cheiePublica = await importaCheiePublica(cheiePublicaJwk);
    ok = await crypto.subtle.verify(
      ALGORITM_SEMNARE,
      cheiePublica,
      fromBase64url(sig!),
      enc.encode(body!),
    );
  } catch {
    return { valida: false, motiv: 'format' };
  }
  if (!ok) return { valida: false, motiv: 'semnatura' };

  let payload: LicentaPayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(fromBase64url(body!)));
  } catch {
    return { valida: false, motiv: 'format' };
  }
  if (payload.expira && new Date(payload.expira) < acum)
    return { valida: false, motiv: 'expirata', payload };
  return { valida: true, payload };
}
