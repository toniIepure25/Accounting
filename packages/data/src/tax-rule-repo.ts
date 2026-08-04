import {
  type ContextRezolvareTva,
  type RegulaTva,
  RegulaTvaInexistenta,
  rezolvaRegulaTva,
} from '@gr/core-domain';
import type { SqlExecutor } from './sql-executor.js';

/**
 * Contract de date EXPLICIT pentru regulile de TVA persistate — NU generic CRUD
 * peste tabela `tax_rules`. Rezolvarea autoritara:
 *   1. aduce candidatii persistati (filtrare pe data + status in SQL, nu in UI);
 *   2. ii mapeaza in reguli de domeniu;
 *   3. rezolva prin motorul pur din @gr/core-domain (`rezolvaRegulaTva`);
 *   4. intoarce identitatea regulii (pentru snapshot la postare, Faza 3);
 *   5. arunca eroare de domeniu explicita cand nu exista potrivire.
 */

/** Forma persistata a unei reguli (mirror pe randul din tabela). */
export interface PersistedTaxRule {
  id: string;
  jurisdiction: string;
  taxType: string;
  code: string;
  name: string;
  category: string;
  /** Cota in puncte de baza (19% = 1900). Reprezentare intreaga exacta. */
  rateBasisPoints: number;
  validFrom: string;
  validTo: string | null;
  legalReference: string;
  legalSourceUrl: string | null;
  status: string;
  version: number;
}

export interface TaxRuleApplicabilityQuery {
  jurisdiction: string;
  taxType?: string; // implicit 'VAT'
  code: string; // codCategorieFiscala
  /** Data faptului generator (ISO); se compara pe zi. */
  date: string;
}

export interface TaxRuleRepository {
  /** Candidatii APROBATI al caror interval acopera data — filtrare in SQL. */
  findApplicable(q: TaxRuleApplicabilityQuery): Promise<PersistedTaxRule[]>;
  getById(id: string): Promise<PersistedTaxRule | null>;
  /** Toate versiunile (orice status) pentru o categorie — pentru administrare/audit. */
  listVersions(q: {
    jurisdiction: string;
    taxType?: string;
    code: string;
  }): Promise<PersistedTaxRule[]>;
}

// biome-ignore lint/suspicious/noExplicitAny: randuri SQL eterogene (snake_case)
function rand(r: any): PersistedTaxRule {
  return {
    id: r.id,
    jurisdiction: r.jurisdiction,
    taxType: r.tax_type,
    code: r.code,
    name: r.name,
    category: r.category,
    rateBasisPoints: Number(r.rate_basis_points),
    validFrom: r.valid_from,
    validTo: r.valid_to ?? null,
    legalReference: r.legal_reference,
    legalSourceUrl: r.legal_source_url ?? null,
    status: r.status,
    version: Number(r.version),
  };
}

/** Mapare persistat -> regula de domeniu (bp -> procent). */
export function persistedToDomain(p: PersistedTaxRule): RegulaTva {
  return {
    id: p.id,
    versiune: p.version,
    jurisdictie: p.jurisdiction,
    // categoria de domeniu (standard/redusa/scutit/...) e coloana `category`.
    categorie: p.category as RegulaTva['categorie'],
    codCategorieFiscala: p.code,
    procent: p.rateBasisPoints / 100,
    validDeLa: p.validFrom,
    validPanaLa: p.validTo,
    referintaLegala: p.legalReference,
    descriere: p.name,
  };
}

/** Zi comparabila `YYYY-MM-DD` (ignora ora/fusul). */
function zi(iso: string): string {
  return iso.slice(0, 10);
}

export function createSqlTaxRuleRepository(exec: SqlExecutor): TaxRuleRepository {
  return {
    async findApplicable(q) {
      const taxType = q.taxType ?? 'VAT';
      const d = zi(q.date);
      const randuri = await exec.select(
        `SELECT * FROM tax_rules
          WHERE jurisdiction = ? AND tax_type = ? AND code = ? AND status = 'approved'
            AND valid_from <= ? AND (valid_to IS NULL OR valid_to > ?)`,
        [q.jurisdiction, taxType, q.code, d, d],
      );
      return randuri.map(rand);
    },
    async getById(id) {
      const r = await exec.select('SELECT * FROM tax_rules WHERE id = ?', [id]);
      return r.length > 0 ? rand(r[0]) : null;
    },
    async listVersions(q) {
      const taxType = q.taxType ?? 'VAT';
      const randuri = await exec.select(
        `SELECT * FROM tax_rules
          WHERE jurisdiction = ? AND tax_type = ? AND code = ?
          ORDER BY valid_from, version`,
        [q.jurisdiction, taxType, q.code],
      );
      return randuri.map(rand);
    },
  };
}

export interface RezultatRezolvareTva {
  /** Regula persistata aleasa (identitate pentru snapshot la postare). */
  persistata: PersistedTaxRule;
  /** Reprezentarea de domeniu (procent etc.). */
  regula: RegulaTva;
  /** Cota in procente. */
  procent: number;
}

/**
 * Rezolvare autoritara peste regulile PERSISTATE. Foloseste exact acelasi motor
 * pur (`rezolvaRegulaTva`) ca rezolvarea in-memory, deci rezultatul e identic —
 * verificat prin testul de echivalenta DB vs. domeniu.
 */
export async function rezolvaTvaPersistat(
  repo: TaxRuleRepository,
  ctx: ContextRezolvareTva,
): Promise<RezultatRezolvareTva> {
  const candidate = await repo.findApplicable({
    jurisdiction: ctx.jurisdictie ?? 'RO',
    code: ctx.codCategorieFiscala,
    date: ctx.data,
  });
  if (candidate.length === 0) throw new RegulaTvaInexistenta(ctx);
  const domeniu = candidate.map(persistedToDomain);
  const regula = rezolvaRegulaTva(domeniu, ctx);
  const persistata = candidate.find((c) => c.id === regula.id)!;
  return { persistata, regula, procent: regula.procent };
}
