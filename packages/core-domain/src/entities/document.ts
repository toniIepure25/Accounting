import { z } from 'zod';
import { campuriSync } from './sync-fields.js';

/**
 * Model unic de document, coloana vertebrala a aplicatiei. Acopera prin campul
 * `tip` majoritatea documentelor din KISS: receptii (NIR), transferuri,
 * plusuri/minusuri, bonuri de consum, facturi, vanzari cu amanuntul, avize,
 * proforme, comenzi (mobila) si livrari.
 */
export const DocumentTip = z.enum([
  'receptie_furnizor', // intrare marfa/materiale de la furnizor (NIR)
  'receptie_transfer', // intrare prin transfer intre gestiuni
  'plus_minus', // regularizare inventar (plus/minus)
  'bon_consum', // iesire materiale in consum
  'factura_cumparare', // factura furnizor
  'factura_vanzare', // factura client
  'vanzare_amanunt', // vanzare cu amanuntul (bon)
  'aviz', // aviz de insotire a marfii
  'proforma', // factura proforma
  'comanda_mobila', // comanda la comanda (modul Mobila)
  'livrare', // livrare / receptie la client
  'nota_amortizare', // amortizare lunara mijloace fixe (681/281), generata din registrul de mijloace fixe
]);
export type DocumentTip = z.infer<typeof DocumentTip>;

/**
 * Starile din ciclul de viata al unui document (vezi ADR-0003 si
 * document-aggregate.ts pentru masina de stari + regulile de imutabilitate):
 *   ciorna  = draft (editabil liber)
 *   aprobat = approved (validat, in asteptarea postarii; inca corectabil)
 *   validat = POSTAT (posted) — emite efecte (stoc/contabil/fiscal); IMUTABIL.
 *             Numele legacy `validat` e pastrat intentionat: intreaga aplicatie
 *             (contabilitate.ts, reports.ts, stoc, sync) trateaza deja `validat`
 *             drept starea postata. A-l redenumi ar fi o schimbare cu raza mare
 *             fara castig — semantica de "posted" e clara prin agregat.
 *   stornat = reversed (corectat printr-un document de stornare legat)
 *   anulat  = cancelled
 */
export const DocumentStare = z.enum(['ciorna', 'aprobat', 'validat', 'stornat', 'anulat']);
export type DocumentStare = z.infer<typeof DocumentStare>;

export const DocumentLinieSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid(),
  /** Copiata de pe documentul parinte la creare — vezi Document.firmaId. */
  firmaId: z.string().uuid().nullable().default(null),
  produsId: z.string().uuid().nullable().default(null),
  denumire: z.string().min(1),
  unitateMasura: z.string().default('buc'),
  cantitate: z.number().default(1),
  pretUnitarBani: z.number().int().default(0),
  /**
   * Cota TVA a liniei = SNAPSHOT-ul cotei rezolvate (procent). NU mai are un
   * default tacit de 19% — trebuie setata explicit de cel care creeaza linia,
   * din cota rezolvata (categorie produs + data document). Snapshot-ul complet
   * al regulii (tax_rule_id/versiune) se persista la POSTARE, in Faza 3.
   */
  cotaTvaProcent: z.number().int().min(0).max(100),
  pretIncludeTva: z.boolean().default(false),
  netBani: z.number().int().default(0),
  tvaBani: z.number().int().default(0),
  brutBani: z.number().int().default(0),
  ...campuriSync,
});
export type DocumentLinie = z.infer<typeof DocumentLinieSchema>;

export const DocumentSchema = z.object({
  id: z.string().uuid(),
  /**
   * Firma careia ii apartine documentul (scopare multi-firma). `null` =
   * document vechi, dinainte de scopare — ramane vizibil pentru toate
   * firmele (nu "dispare" retroactiv). Documentele noi sunt stampilate cu
   * firma curenta la creare (vezi @gr/data firma-scope.ts), impus si
   * server-side pentru modurile retea/cloud (server/src/index.ts).
   */
  firmaId: z.string().uuid().nullable().default(null),
  tip: DocumentTip,
  serie: z.string().default(''),
  numar: z.number().int().default(0),
  cod: z.string().default(''),
  data: z.string(), // ISO (yyyy-mm-dd)
  partenerId: z.string().uuid().nullable().default(null),
  gestiuneId: z.string().uuid().nullable().default(null),
  gestiuneDestinatieId: z.string().uuid().nullable().default(null),
  punctDeLucruId: z.string().uuid().nullable().default(null),
  /**
   * Document sursa legat (ex.: o factura de cumparare legata de NIR-ul
   * receptiei corespunzatoare, pentru 3-way match). Cand e setat pe o
   * `factura_cumparare` catre un `receptie_furnizor` validat, factura nu mai
   * genereaza a doua nota contabila de achizitie — vezi contabilitate.ts.
   */
  documentSursaId: z.string().uuid().nullable().default(null),
  scadenta: z.string().nullable().default(null),
  observatii: z.string().default(''),
  stare: DocumentStare.default('ciorna'),
  totalNetBani: z.number().int().default(0),
  totalTvaBani: z.number().int().default(0),
  totalBrutBani: z.number().int().default(0),
  avansBani: z.number().int().default(0), // pentru comenzi
  /** camp liber JSON pentru extensii (ex. configuratie Mobila). */
  meta: z.string().default('{}'),
  /**
   * Contor de versiune pentru blocare optimista (Faza 4). Fiecare modificare
   * autoritara prin comenzi il incrementeaza; o comanda cu `expectedVersion`
   * invechit este respinsa (conflict) in loc sa suprascrie orbeste.
   */
  version: z.number().int().min(1).default(1),
  /**
   * Metadate de sincronizare (WIRING-21). `version` de mai sus e refolosit si de
   * sync; aici doar marca temporala + tombstone. Pe documente, aceste campuri sunt
   * STAMPILATE DE MOTORUL de comenzi (lifecycle/post-document), nu de repo-ul generic
   * — comenzile sunt autoritare peste tranzitiile de stare.
   */
  updatedAt: z.string().default(''),
  deletedAt: z.string().nullable().default(null),
});
export type Document = z.infer<typeof DocumentSchema>;

export const DocumentInputSchema = DocumentSchema.omit({ id: true });
export type DocumentInput = z.infer<typeof DocumentInputSchema>;

/** Sensul in stoc al unui tip de document: +1 intrare, -1 iesire, 0 fara efect. */
export function directieStoc(tip: DocumentTip): 1 | -1 | 0 {
  switch (tip) {
    case 'receptie_furnizor':
    case 'receptie_transfer':
      return 1;
    case 'bon_consum':
    case 'factura_vanzare':
    case 'vanzare_amanunt':
    case 'livrare':
      return -1;
    case 'plus_minus': // semnul rezulta din cantitatea (pozitiva/negativa) a liniei
    case 'factura_cumparare':
    case 'aviz':
    case 'proforma':
    case 'comanda_mobila':
    case 'nota_amortizare':
      return 0;
  }
}

export const ETICHETE_DOCUMENT: Record<DocumentTip, string> = {
  receptie_furnizor: 'Receptie furnizor',
  receptie_transfer: 'Transfer',
  plus_minus: 'Plus / Minus',
  bon_consum: 'Bon de consum',
  factura_cumparare: 'Factura cumparare',
  factura_vanzare: 'Factura vanzare',
  vanzare_amanunt: 'Vanzare cu amanuntul',
  aviz: 'Aviz de insotire',
  proforma: 'Proforma',
  comanda_mobila: 'Comanda mobila',
  livrare: 'Livrare',
  nota_amortizare: 'Nota de amortizare',
};
