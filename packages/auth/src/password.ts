/**
 * Hash de parola cu PBKDF2 (Web Crypto — disponibil in browser, Node 20+ si
 * Tauri, fara dependinte native). Format stocat: `pbkdf2$<iteratii>$<salt-hex>$<hash-hex>`.
 */
const ITERATII = 210_000;
const LUNGIME_HASH = 32; // bytes (SHA-256)

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

async function deriva(parola: string, salt: Uint8Array, iteratii: number): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(parola) as BufferSource,
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: iteratii, hash: 'SHA-256' },
    keyMaterial,
    LUNGIME_HASH * 8,
  );
  return new Uint8Array(bits);
}

/** Genereaza hash-ul stocabil pentru o parola noua. */
export async function hashParola(parola: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await deriva(parola, salt, ITERATII);
  return `pbkdf2$${ITERATII}$${toHex(salt)}$${toHex(hash)}`;
}

/** Verifica o parola introdusa fata de hash-ul stocat (comparatie constant-time). */
export async function verificaParola(parola: string, stocat: string): Promise<boolean> {
  const parti = stocat.split('$');
  if (parti.length !== 4 || parti[0] !== 'pbkdf2') return false;
  const iteratii = Number.parseInt(parti[1]!, 10);
  const salt = fromHex(parti[2]!);
  const asteptat = fromHex(parti[3]!);
  const calculat = await deriva(parola, salt, iteratii);
  if (calculat.length !== asteptat.length) return false;
  let diff = 0;
  for (let i = 0; i < calculat.length; i++) diff |= calculat[i]! ^ asteptat[i]!;
  return diff === 0;
}
