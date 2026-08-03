/**
 * Editii de produs si modulele pe care le deblocheaza. O editie corespunde unui
 * tip de intreprindere; clientul vede si foloseste DOAR modulele editiei sale.
 */
export type ModuleId = 'core' | 'contabilitate' | 'fiscal' | 'mobila' | 'horeca' | 'retail';

export type EditionId = 'mobila' | 'horeca' | 'florarie' | 'retail' | 'full';

/** Module comune oricarei intreprinderi din Romania. */
const BAZA: ModuleId[] = ['core', 'contabilitate', 'fiscal'];

export const EDITIONS: Record<EditionId, { label: string; module: ModuleId[] }> = {
  mobila: { label: 'Fabrica de mobila', module: [...BAZA, 'mobila'] },
  horeca: { label: 'Bar / Restaurant', module: [...BAZA, 'horeca'] },
  florarie: { label: 'Florarie', module: [...BAZA, 'retail'] },
  retail: { label: 'Comert / Retail', module: [...BAZA, 'retail'] },
  full: { label: 'Complet (toate domeniile)', module: [...BAZA, 'mobila', 'horeca', 'retail'] },
};

/**
 * Planuri comerciale — ortogonale pe editii: editia spune CE domeniu acopera
 * produsul (mobila/HoReCa/retail...), planul spune CAT de mare e clientul
 * (cati utilizatori simultani). Un client de mobilia cu 3 angajati si unul cu
 * 40 folosesc aceeasi editie, dar nu acelasi plan.
 */
export type PlanId = 'esential' | 'profesional' | 'enterprise';

export const PLANURI: Record<PlanId, { label: string; utilizatoriIncluzi: number | null }> = {
  esential: { label: 'Esential', utilizatoriIncluzi: 3 },
  profesional: { label: 'Profesional', utilizatoriIncluzi: 10 },
  // null = nelimitat (negociat per contract)
  enterprise: { label: 'Enterprise', utilizatoriIncluzi: null },
};

export const ETICHETE_MODULE: Record<ModuleId, string> = {
  core: 'Gestiune de baza',
  contabilitate: 'Contabilitate',
  fiscal: 'Fiscal (e-Factura, TVA, SAF-T)',
  mobila: 'Mobila (configurator, comenzi, productie)',
  horeca: 'HoReCa (preparate, retete)',
  retail: 'Retail / vanzari',
};
