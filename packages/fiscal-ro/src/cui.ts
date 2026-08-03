/**
 * Validarea codului de identificare fiscala (CUI/CIF) romanesc, cu cifra de
 * control (algoritmul ANAF, cheia 753217532, modulo 11).
 *
 * Cifrele CUI-ului (fara cifra de control) se aliniaza la DREAPTA sub cheie,
 * se inmultesc pozitional, suma * 10 mod 11 da cifra de control (10 -> 0).
 */
const CHEIE = [7, 5, 3, 2, 1, 7, 5, 3, 2];

/** Extrage partea numerica a unui CUI (fara prefixul "RO", fara spatii). */
export function normalizeazaCui(cui: string): string {
  return cui.trim().replace(/^RO/i, '').replace(/\s/g, '');
}

/** Verifica cifra de control a unui CUI romanesc. */
export function cuiValid(cui: string): boolean {
  const n = normalizeazaCui(cui);
  if (!/^\d{2,10}$/.test(n)) return false;

  const cifre = n.split('').map(Number);
  const control = cifre.pop()!;
  const offset = CHEIE.length - cifre.length; // aliniere la dreapta
  if (offset < 0) return false;

  let suma = 0;
  for (let j = 0; j < cifre.length; j++) {
    suma += cifre[j]! * CHEIE[offset + j]!;
  }
  let rest = (suma * 10) % 11;
  if (rest === 10) rest = 0;
  return rest === control;
}
