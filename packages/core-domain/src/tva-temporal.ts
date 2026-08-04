/**
 * Motor de TVA cu efectivitate temporala (effective-dated tax rules).
 *
 * De ce exista: pana acum cota de TVA era o constanta hardcodata (`COTE_TVA_RO`
 * din tva.ts, standard 19%), iar tabela `cote_tva` din baza de date nu era
 * citita niciodata de runtime. Asta e gresit din doua motive:
 *  1. Arhitectural — o schimbare de cota ar cere un find-and-replace global.
 *  2. Fiscal — Romania a schimbat cotele prin Legea 141/2025 (publicata
 *     25 iulie 2025): de la 1 august 2025 cota standard a crescut 19% -> 21%,
 *     iar cotele reduse de 5% si 9% s-au consolidat intr-o singura cota redusa
 *     de 11%. Deci "19%" e incorect pentru orice document cu data >= 2025-08-01.
 *
 * Modelul de aici trateaza cotele ca DATE, nu ca cod: fiecare regula are un
 * interval de valabilitate [validDeLa, validPanaLa). Cota aplicabila se
 * REZOLVA la data faptului generator (tax-point), pe categorie fiscala. Cand nu
 * exista nicio regula aplicabila, se arunca o eroare EXPLICITA — nu se aplica
 * tacit o cota implicita (principiul "no silent default" din program).
 *
 * IMPORTANT (ce NU face inca acest slice, si vine in fazele urmatoare):
 *  - persistarea regulii rezolvate pe linia POSTATA (depinde de agregatul de
 *    document + posting din Faza 3);
 *  - maparea fina produs -> categorie fiscala si sub-categoriile din legislatia
 *    secundara (ce bunuri erau 5% vs 9% inainte de 2025);
 *  - maparea catre casutele din D300/D394/D390/SAF-T (fazele 7-9).
 * Aici e nucleul pur si testabil: modelul + resolverul + seed-ul verificat.
 */

/** Categorie semantica de cota. */
export type CategorieCotaTva = 'standard' | 'redusa' | 'scutit' | 'taxare_inversa' | 'neimpozabil';

/** Contextul tranzactiei (relevant pentru fazele intracomunitare/export). */
export type ContextTranzactie = 'intern' | 'intracomunitar' | 'export' | 'import';

/**
 * O regula de TVA valabila intr-un interval de timp, pentru o categorie fiscala.
 * `codCategorieFiscala` e cheia stabila pe care o poarta un produs/serviciu
 * (ex. "standard", "redus_alimente"), iar cota se schimba in timp prin reguli
 * cu `validDeLa` diferit — asa un produs care era 9% devine 11% fara sa-si
 * schimbe categoria.
 */
export interface RegulaTva {
  id: string;
  versiune: number;
  jurisdictie: string; // ex. 'RO'
  categorie: CategorieCotaTva;
  /** Cheia stabila de categorie fiscala (produsul o poarta). */
  codCategorieFiscala: string;
  /** Procentul cotei (0..100). */
  procent: number;
  /** Data de la care se aplica (inclusiv), ISO `YYYY-MM-DD`. */
  validDeLa: string;
  /** Data pana la care se aplica (EXCLUSIV), ISO; `null` = deschis. */
  validPanaLa: string | null;
  /** Referinta legala (ex. "Legea 141/2025"). */
  referintaLegala: string;
  descriere: string;
}

/** Ce se cere resolverului: data faptului generator + categoria fiscala + context. */
export interface ContextRezolvareTva {
  /** Data faptului generator (tax-point), ISO `YYYY-MM-DD`. */
  data: string;
  /** Categoria fiscala a produsului/serviciului (ex. "standard"). */
  codCategorieFiscala: string;
  jurisdictie?: string; // implicit 'RO'
  context?: ContextTranzactie; // implicit 'intern'
}

/** Aruncata cand nu exista nicio regula de TVA aplicabila — niciodata cota implicita tacita. */
export class RegulaTvaInexistenta extends Error {
  constructor(public readonly ctx: ContextRezolvareTva) {
    super(
      `Nu exista o regula de TVA aplicabila pentru categoria "${ctx.codCategorieFiscala}" la data ${ctx.data} (jurisdictie ${ctx.jurisdictie ?? 'RO'}). Configureaza o regula valabila pentru aceasta perioada.`,
    );
    this.name = 'RegulaTvaInexistenta';
  }
}

/** Data ISO `YYYY-MM-DD` -> numar comparabil (fara fus orar). */
function ziComparabila(iso: string): number {
  // Normalizam la primele 10 caractere (YYYY-MM-DD) ca sa ignoram ora/fusul.
  const zi = iso.slice(0, 10).replace(/-/g, '');
  const n = Number.parseInt(zi, 10);
  if (!Number.isFinite(n)) throw new Error(`Data invalida: "${iso}"`);
  return n;
}

/** O regula acopera o data data? [validDeLa, validPanaLa). */
function reguleAcoperaData(regula: RegulaTva, data: string): boolean {
  const d = ziComparabila(data);
  if (d < ziComparabila(regula.validDeLa)) return false;
  if (regula.validPanaLa !== null && d >= ziComparabila(regula.validPanaLa)) return false;
  return true;
}

/**
 * Rezolva regula de TVA aplicabila. Filtreaza pe jurisdictie + categorie fiscala
 * + interval de valabilitate; daca raman mai multe (intervale suprapuse), alege
 * pe cea cu `validDeLa` cel mai recent (cea mai specifica pentru data ceruta),
 * departajand la egalitate pe versiunea mai mare. Arunca `RegulaTvaInexistenta`
 * daca niciuna nu se potriveste.
 */
export function rezolvaRegulaTva(
  reguli: readonly RegulaTva[],
  ctx: ContextRezolvareTva,
): RegulaTva {
  const jurisdictie = ctx.jurisdictie ?? 'RO';
  const candidate = reguli.filter(
    (r) =>
      r.jurisdictie === jurisdictie &&
      r.codCategorieFiscala === ctx.codCategorieFiscala &&
      reguleAcoperaData(r, ctx.data),
  );
  if (candidate.length === 0) throw new RegulaTvaInexistenta(ctx);

  return candidate.reduce((cea_mai_buna, r) => {
    const a = ziComparabila(r.validDeLa);
    const b = ziComparabila(cea_mai_buna.validDeLa);
    if (a > b) return r;
    if (a === b && r.versiune > cea_mai_buna.versiune) return r;
    return cea_mai_buna;
  });
}

/** Comoditate: doar procentul cotei aplicabile la data ceruta. */
export function procentTvaLaData(reguli: readonly RegulaTva[], ctx: ContextRezolvareTva): number {
  return rezolvaRegulaTva(reguli, ctx).procent;
}

/**
 * Seed verificat al regulilor de TVA din Romania.
 *
 * Sursa cotelor din 2025: Legea 141/2025 (publicata 25.07.2025), in vigoare de
 * la 1 august 2025 — cota standard 19% -> 21%, cotele reduse 5% si 9%
 * consolidate intr-o cota redusa unica de 11%. Verificat cu surse autoritative
 * la data implementarii (avalara.com, vatupdate.com, globalvatcompliance.com).
 *
 * Categoriile fiscale reduse istorice sunt pastrate ca `redus_5` / `redus_9`
 * (dupa cota lor DE DINAINTE de august 2025); ambele se pliaza pe 11% dupa
 * tranzitie. Maparea exacta produs -> categorie (ce bunuri sunt in fiecare
 * categorie redusa) tine de legislatia secundara si se rafineaza intr-o etapa
 * ulterioara; aici seed-ul e corect la nivel de COTA pe ambele parti ale
 * tranzitiei.
 */
export const TRANZITIE_TVA_RO_2025 = '2025-08-01';

export const REGULI_TVA_RO: readonly RegulaTva[] = [
  // Standard: 19% pana la tranzitie, 21% dupa.
  {
    id: 'ro-standard-19',
    versiune: 1,
    jurisdictie: 'RO',
    categorie: 'standard',
    codCategorieFiscala: 'standard',
    procent: 19,
    validDeLa: '2017-01-01',
    validPanaLa: TRANZITIE_TVA_RO_2025,
    referintaLegala: 'Cod fiscal (cota standard pana la 31.07.2025)',
    descriere: 'Cota standard 19% (pana la 31 iulie 2025 inclusiv)',
  },
  {
    id: 'ro-standard-21',
    versiune: 1,
    jurisdictie: 'RO',
    categorie: 'standard',
    codCategorieFiscala: 'standard',
    procent: 21,
    validDeLa: TRANZITIE_TVA_RO_2025,
    validPanaLa: null,
    referintaLegala: 'Legea 141/2025',
    descriere: 'Cota standard 21% (de la 1 august 2025)',
  },
  // Categorie redusa istorica de 9% -> 11% dupa tranzitie.
  {
    id: 'ro-redus9-9',
    versiune: 1,
    jurisdictie: 'RO',
    categorie: 'redusa',
    codCategorieFiscala: 'redus_9',
    procent: 9,
    validDeLa: '2017-01-01',
    validPanaLa: TRANZITIE_TVA_RO_2025,
    referintaLegala: 'Cod fiscal (cota redusa 9% pana la 31.07.2025)',
    descriere: 'Cota redusa 9% (pana la 31 iulie 2025 inclusiv)',
  },
  {
    id: 'ro-redus9-11',
    versiune: 1,
    jurisdictie: 'RO',
    categorie: 'redusa',
    codCategorieFiscala: 'redus_9',
    procent: 11,
    validDeLa: TRANZITIE_TVA_RO_2025,
    validPanaLa: null,
    referintaLegala: 'Legea 141/2025',
    descriere: 'Cota redusa unica 11% (de la 1 august 2025; fostele bunuri la 9%)',
  },
  // Categorie redusa istorica de 5% -> 11% dupa tranzitie.
  {
    id: 'ro-redus5-5',
    versiune: 1,
    jurisdictie: 'RO',
    categorie: 'redusa',
    codCategorieFiscala: 'redus_5',
    procent: 5,
    validDeLa: '2017-01-01',
    validPanaLa: TRANZITIE_TVA_RO_2025,
    referintaLegala: 'Cod fiscal (cota redusa 5% pana la 31.07.2025)',
    descriere: 'Cota redusa 5% (pana la 31 iulie 2025 inclusiv)',
  },
  {
    id: 'ro-redus5-11',
    versiune: 1,
    jurisdictie: 'RO',
    categorie: 'redusa',
    codCategorieFiscala: 'redus_5',
    procent: 11,
    validDeLa: TRANZITIE_TVA_RO_2025,
    validPanaLa: null,
    referintaLegala: 'Legea 141/2025',
    descriere: 'Cota redusa unica 11% (de la 1 august 2025; fostele bunuri la 5%)',
  },
  // Scutit: 0%, neschimbat.
  {
    id: 'ro-scutit-0',
    versiune: 1,
    jurisdictie: 'RO',
    categorie: 'scutit',
    codCategorieFiscala: 'scutit',
    procent: 0,
    validDeLa: '2017-01-01',
    validPanaLa: null,
    referintaLegala: 'Cod fiscal (operatiuni scutite)',
    descriere: 'Scutit de TVA (0%)',
  },
];
