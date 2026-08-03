import { formatBani, bani as makeBani } from '@gr/core-domain';

/** Formateaza bani (intreg) ca suma RON ro-RO, fara simbol. */
export function bani(value: number | undefined | null): string {
  return formatBani(makeBani(value ?? 0), { withSymbol: false });
}

/** Formateaza bani cu simbol RON. */
export function lei(value: number | undefined | null): string {
  return formatBani(makeBani(value ?? 0), { withSymbol: true });
}

/** Data ISO -> format ro-RO (dd.mm.yyyy). */
export function data(iso: string | undefined | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('ro-RO');
}

/** Cantitate cu pana la 3 zecimale. */
export function cant(n: number | undefined | null): string {
  return new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 3 }).format(n ?? 0);
}
