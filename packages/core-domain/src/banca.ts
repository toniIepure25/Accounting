import type { OperatiuneBancara } from './entities/banca.js';
import type { OperatiuneCasa } from './entities/casa.js';
import type { FaraCampuriSync } from './entities/sync-fields.js';

/**
 * Import extras bancar (CSV) + reconciliere cu operatiunile de casa.
 *
 * Formatul CSV asteptat (o linie de antet, apoi randuri): `data,suma,descriere`
 * — data ISO (yyyy-mm-dd), suma cu semn (pozitiv = incasare, negativ = plata),
 * descriere = textul liber din extras. Bancile romanesti export in formate
 * variate (unele MT940/CAMT.053 XML) — CSV e un numitor comun larg suportat;
 * parsarea nativa MT940/CAMT.053 ramane pentru o runda ulterioara.
 */
export interface RandExtrasCsv {
  data: string;
  sumaBani: number;
  referinta: string;
}

export function parseExtrasCsv(text: string): RandExtrasCsv[] {
  const linii = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (linii.length === 0) return [];
  const [, ...restul] = linii; // prima linie = antet, ignorata
  const randuri: RandExtrasCsv[] = [];
  for (const linie of restul) {
    const parti = linie.split(',');
    if (parti.length < 2) continue;
    const data = parti[0]!.trim();
    const suma = Number.parseFloat(parti[1]!.trim().replace(',', '.'));
    if (!data || Number.isNaN(suma)) continue;
    randuri.push({ data, sumaBani: Math.round(suma * 100), referinta: (parti[2] ?? '').trim() });
  }
  return randuri;
}

export interface PotrivireBancara {
  operatiuneBancaraId: string;
  operatiuneCasaId: string;
}

const zileIntre = (a: string, b: string): number =>
  Math.round((new Date(a).getTime() - new Date(b).getTime()) / 86_400_000);

/**
 * Reconciliere automata: pentru fiecare operatiune bancara nereconciliata,
 * cauta o operatiune de casa cu acelasi tip (incasare/plata dupa semnul
 * sumei), aceeasi suma si o data apropiata (in limita de toleranta) — nu inca
 * folosita intr-o alta potrivire. Nu modifica datele — returneaza doar
 * perechile gasite, persistarea (marcarea reconciliata) e responsabilitatea
 * apelantului.
 */
export function reconciliazaAutomat(
  bancare: readonly FaraCampuriSync<OperatiuneBancara>[],
  casa: readonly FaraCampuriSync<OperatiuneCasa>[],
  toleranteZile = 3,
): PotrivireBancara[] {
  const casaDisponibila = new Set(casa.map((c) => c.id));
  const rezultate: PotrivireBancara[] = [];

  for (const b of bancare) {
    if (b.reconciliata) continue;
    const tipAsteptat = b.sumaBani >= 0 ? 'incasare' : 'plata';
    const sumaAbs = Math.abs(b.sumaBani);
    const candidat = casa.find(
      (c) =>
        casaDisponibila.has(c.id) &&
        c.tip === tipAsteptat &&
        c.sumaBani === sumaAbs &&
        Math.abs(zileIntre(b.data, c.data)) <= toleranteZile,
    );
    if (candidat) {
      rezultate.push({ operatiuneBancaraId: b.id, operatiuneCasaId: candidat.id });
      casaDisponibila.delete(candidat.id);
    }
  }
  return rezultate;
}
