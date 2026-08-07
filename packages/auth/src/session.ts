import type { Rol } from './roles.js';

/**
 * Token de sesiune semnat (HMAC-SHA256), acelasi tipar ca licenta (@gr/license).
 * Serverul emite tokenul la login; clientul il trimite pe fiecare cerere;
 * serverul il verifica fara stare (stateless), cu expirare scurta + refresh.
 */
export interface SesiunePayload {
  utilizatorId: string;
  nume: string;
  rol: Rol;
  firmaId: string | null;
  /**
   * Versiunea sesiunii la momentul emiterii (Faza 11). Serverul o compara cu
   * versiunea curenta a utilizatorului si respinge tokenurile invechite —
   * delogare fortata / schimbare de parola au efect imediat. Optional pentru
   * compatibilitate cu tokenuri emise inainte (tratate ca versiunea 1).
   */
  sessionVersion?: number;
  emisLa: string; // ISO
  expiraLa: string; // ISO
}

const enc = new TextEncoder();

function base64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromBase64url(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
async function hmacHex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Compara doua siruri hex in timp constant (nu se opreste la primul caracter
 * diferit) — la fel ca `verificaParola` din password.ts. Un `!==` simplu pe
 * semnatura tokenului ar fi un canal lateral de timp: raspunsul serverului ar
 * fi (marginal) mai rapid cu cat mai devreme difera semnatura ghicita fata de
 * cea reala, permitand in teorie reconstruirea semnaturii caracter cu caracter.
 */
function compareTimingSafe(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Emite un token de sesiune (server-side, la login reușit). */
export async function emiteToken(payload: SesiunePayload, secret: string): Promise<string> {
  const body = base64url(enc.encode(JSON.stringify(payload)));
  return `${body}.${await hmacHex(secret, body)}`;
}

export type RezultatToken =
  | { valid: true; payload: SesiunePayload }
  | { valid: false; motiv: 'format' | 'semnatura' | 'expirat' };

/** Verifica un token de sesiune. */
export async function verificaToken(
  token: string,
  secret: string,
  acum = new Date(),
): Promise<RezultatToken> {
  const parti = token.trim().split('.');
  if (parti.length !== 2) return { valid: false, motiv: 'format' };
  const [body, sig] = parti;
  if (!compareTimingSafe(sig!, await hmacHex(secret, body!)))
    return { valid: false, motiv: 'semnatura' };
  let payload: SesiunePayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(fromBase64url(body!)));
  } catch {
    return { valid: false, motiv: 'format' };
  }
  if (new Date(payload.expiraLa) < acum) return { valid: false, motiv: 'expirat' };
  return { valid: true, payload };
}
