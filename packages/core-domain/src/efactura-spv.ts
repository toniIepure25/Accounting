/**
 * Masina de stari PURA a ciclului de viata e-Factura la SPV (Faza 8). Stratul de
 * aplicatie detine tranzitiile si le persista; aici traieste doar REGULA.
 *
 *   ciorna_xml ─► validat ─► incarcat ─► (acceptat | respins)
 *                                └─► eroare (transport; reincercabil -> incarcat)
 *
 * - `ciorna_xml`: XML generat, nevalidat inca.
 * - `validat`: a trecut validarea structurala; gata de incarcare.
 * - `incarcat`: trimis la SPV (avem index de incarcare); se asteapta raspunsul.
 * - `acceptat`/`respins`: raspuns final SPV. `respins` permite o noua submisie.
 * - `eroare`: esec de transport la incarcare; se poate reincerca incarcarea.
 */

export type StareEfactura =
  | 'ciorna_xml'
  | 'validat'
  | 'incarcat'
  | 'acceptat'
  | 'respins'
  | 'eroare';

const TRANZITII: Record<StareEfactura, readonly StareEfactura[]> = {
  ciorna_xml: ['validat', 'eroare'],
  validat: ['incarcat', 'eroare'],
  incarcat: ['acceptat', 'respins', 'eroare'],
  eroare: ['incarcat', 'validat'],
  acceptat: [],
  respins: [],
};

/** Stari finale (nu mai admit tranzitii). */
const FINALE: ReadonlySet<StareEfactura> = new Set(['acceptat', 'respins']);

export function tranzitieEfacturaPermisa(de_la: StareEfactura, la: StareEfactura): boolean {
  return TRANZITII[de_la].includes(la);
}

export function esteStareFinala(stare: StareEfactura): boolean {
  return FINALE.has(stare);
}

export class TranzitieEfacturaNepermisaError extends Error {
  constructor(
    public readonly de_la: StareEfactura,
    public readonly la: StareEfactura,
  ) {
    super(`Tranzitie e-Factura nepermisa: ${de_la} -> ${la}.`);
    this.name = 'TranzitieEfacturaNepermisaError';
  }
}

export function asertaTranzitieEfactura(de_la: StareEfactura, la: StareEfactura): void {
  if (!tranzitieEfacturaPermisa(de_la, la)) {
    throw new TranzitieEfacturaNepermisaError(de_la, la);
  }
}
