/**
 * Reprezentarea banilor in unitati minore intregi (bani), pentru a evita
 * complet erorile de virgula mobila in calcule contabile.
 *
 * 1 RON = 100 bani. Toate sumele interne sunt numere intregi de tip `Bani`.
 * Un numar intreg pana la 2^53 acopera ~90.000 de miliarde RON, suficient.
 */

/** Marca de tip (branded type) pentru sume intregi in bani. */
export type Bani = number & { readonly __brand: 'Bani' };

/** Rotunjire comerciala: jumatate se rotunjeste in sus, in modul (half away from zero). */
export function roundHalfAwayFromZero(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

/** Construieste o valoare `Bani` dintr-un numar deja in bani (validat ca intreg). */
export function bani(value: number): Bani {
  return roundHalfAwayFromZero(value) as Bani;
}

/** Converteste RON (ex. 12.34) in bani (1234). */
export function ronToBani(ron: number): Bani {
  return roundHalfAwayFromZero(ron * 100) as Bani;
}

/** Converteste bani (1234) in RON numeric (12.34). Accepta si `number` simplu. */
export function baniToRon(value: number): number {
  return value / 100;
}

export const addBani = (a: Bani, b: Bani): Bani => (a + b) as Bani;
export const subBani = (a: Bani, b: Bani): Bani => (a - b) as Bani;

/** Inmulteste o suma in bani cu o cantitate (posibil fractionara) si rotunjeste. */
export function mulBani(amount: Bani, quantity: number): Bani {
  return roundHalfAwayFromZero(amount * quantity) as Bani;
}

export const sumBani = (values: readonly Bani[]): Bani =>
  values.reduce((acc, v) => acc + v, 0) as Bani;

/** Formateaza o suma in bani ca text localizat (implicit ro-RO, RON). */
export function formatBani(
  value: Bani,
  opts: { locale?: string; currency?: string; withSymbol?: boolean } = {},
): string {
  const { locale = 'ro-RO', currency = 'RON', withSymbol = true } = opts;
  const ron = baniToRon(value);
  return withSymbol
    ? new Intl.NumberFormat(locale, { style: 'currency', currency }).format(ron)
    : new Intl.NumberFormat(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(ron);
}
