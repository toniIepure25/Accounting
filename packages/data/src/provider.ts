import {
  type AuditEntry,
  AuditEntrySchema,
  type CombinatieInterzisa,
  CombinatieInterzisaSchema,
  type Document,
  type DocumentLinie,
  DocumentLinieSchema,
  DocumentSchema,
  type Firma,
  FirmaSchema,
  type Gestiune,
  GestiuneSchema,
  type GrupaProdus,
  GrupaProdusSchema,
  type ListaPret,
  ListaPretSchema,
  type MijlocFix,
  MijlocFixSchema,
  type ObiectInventar,
  ObiectInventarSchema,
  type OperatiuneBancara,
  OperatiuneBancaraSchema,
  type OperatiuneCasa,
  OperatiuneCasaSchema,
  type OptiuneConfigurator,
  OptiuneConfiguratorSchema,
  type Partener,
  PartenerSchema,
  type Personal,
  PersonalSchema,
  type PlanCont,
  PlanContSchema,
  type Preparat,
  PreparatSchema,
  type Produs,
  ProdusSchema,
  type ProfilConfigurator,
  ProfilConfiguratorSchema,
  type PunctLucru,
  PunctLucruSchema,
  type RetetaLinie,
  RetetaLinieSchema,
  type TipConsum,
  TipConsumSchema,
  type Utilizator,
  UtilizatorSchema,
} from '@gr/core-domain';
import type { ZodTypeAny } from 'zod';
import { createApiNumerotare } from './api-numerotare.js';
import { type FurnizorToken, createApiRepository } from './api-repo.js';
import { createSqlRepository } from './generic-sql-repo.js';
import { type Numerotare, createMemoryNumerotare, createSqlNumerotare } from './numerotare.js';
import { type Repository, createMemoryRepository } from './repository.js';
import type { SqlExecutor } from './sql-executor.js';

/**
 * Punctul unic de acces la date. Acopera toate nomenclatoarele si documentele
 * portate din KISS + modulul Mobila. UI-ul depinde de aceasta interfata, nu de
 * un backend concret (memory / SQLite / Postgres).
 */
export interface DataProvider {
  firme: Repository<Firma, Partial<Firma>>;
  puncteLucru: Repository<PunctLucru, Partial<PunctLucru>>;
  gestiuni: Repository<Gestiune, Partial<Gestiune>>;
  parteneri: Repository<Partener, Partial<Partener>>;
  grupeProduse: Repository<GrupaProdus, Partial<GrupaProdus>>;
  produse: Repository<Produs, Partial<Produs>>;
  planConturi: Repository<PlanCont, Partial<PlanCont>>;
  personal: Repository<Personal, Partial<Personal>>;
  listePreturi: Repository<ListaPret, Partial<ListaPret>>;
  tipuriConsum: Repository<TipConsum, Partial<TipConsum>>;
  obiecteInventar: Repository<ObiectInventar, Partial<ObiectInventar>>;
  preparate: Repository<Preparat, Partial<Preparat>>;
  reteteLinii: Repository<RetetaLinie, Partial<RetetaLinie>>;
  documente: Repository<Document, Partial<Document>>;
  documenteLinii: Repository<DocumentLinie, Partial<DocumentLinie>>;
  operatiuniCasa: Repository<OperatiuneCasa, Partial<OperatiuneCasa>>;
  optiuniMobila: Repository<OptiuneConfigurator, Partial<OptiuneConfigurator>>;
  /** Jurnal de audit (scris prin withAudit — vezi audit-wrapper.ts). */
  auditLog: Repository<AuditEntry, Partial<AuditEntry>>;
  /** Conturi de utilizatori (autentificare server-side — vezi @gr/auth). */
  utilizatori: Repository<Utilizator, Partial<Utilizator>>;
  /** Registru de mijloace fixe (vezi @gr/core-domain mijloace-fixe.ts). */
  mijloaceFixe: Repository<MijlocFix, Partial<MijlocFix>>;
  /** Operatiuni bancare importate din extras (vezi @gr/core-domain banca.ts). */
  operatiuniBancare: Repository<OperatiuneBancara, Partial<OperatiuneBancara>>;
  /** Profil de reguli configurator Mobila (dimensiuni min/max) — un singur rand activ. */
  profilConfigurator: Repository<ProfilConfigurator, Partial<ProfilConfigurator>>;
  /** Combinatii material x finisaj interzise in configuratorul Mobila. */
  combinatiiInterzise: Repository<CombinatieInterzisa, Partial<CombinatieInterzisa>>;
  /** Alocator atomic de numere de document (vezi numerotare.ts). */
  numerotare: Numerotare;
}

export type DeploymentMode = 'local' | 'lan' | 'cloud';

export interface DeploymentConfig {
  mode: DeploymentMode;
  target?: string;
}

/** Cheile DataProvider care sunt repository-uri (exclude `numerotare`). */
type RepoKey = Exclude<keyof DataProvider, 'numerotare'>;

/** Semintele demo (in-memory), keyed pe numele repository-ului. */
export type MemorySeed = {
  [K in RepoKey]?: readonly EntityOf<DataProvider[K]>[];
};
type EntityOf<R> = R extends Repository<infer T, infer _I> ? T : never;

interface TableDef {
  table: string;
  schema: ZodTypeAny;
}

/** Maparea repo -> (tabela SQL, schema). Sursa unica pentru memory si SQL. */
const DEFS = {
  firme: { table: 'firme', schema: FirmaSchema },
  puncteLucru: { table: 'puncte_lucru', schema: PunctLucruSchema },
  gestiuni: { table: 'gestiuni', schema: GestiuneSchema },
  parteneri: { table: 'parteneri', schema: PartenerSchema },
  grupeProduse: { table: 'grupe_produse', schema: GrupaProdusSchema },
  produse: { table: 'produse', schema: ProdusSchema },
  planConturi: { table: 'plan_conturi', schema: PlanContSchema },
  personal: { table: 'personal', schema: PersonalSchema },
  listePreturi: { table: 'liste_preturi', schema: ListaPretSchema },
  tipuriConsum: { table: 'tip_consum', schema: TipConsumSchema },
  obiecteInventar: { table: 'obiecte_inventar', schema: ObiectInventarSchema },
  preparate: { table: 'preparate', schema: PreparatSchema },
  reteteLinii: { table: 'retete_linii', schema: RetetaLinieSchema },
  documente: { table: 'documente', schema: DocumentSchema },
  documenteLinii: { table: 'documente_linii', schema: DocumentLinieSchema },
  operatiuniCasa: { table: 'operatiuni_casa', schema: OperatiuneCasaSchema },
  optiuniMobila: { table: 'optiuni_configurator', schema: OptiuneConfiguratorSchema },
  auditLog: { table: 'audit_log', schema: AuditEntrySchema },
  utilizatori: { table: 'utilizatori', schema: UtilizatorSchema },
  mijloaceFixe: { table: 'mijloace_fixe', schema: MijlocFixSchema },
  operatiuniBancare: { table: 'operatiuni_bancare', schema: OperatiuneBancaraSchema },
  profilConfigurator: { table: 'profil_configurator', schema: ProfilConfiguratorSchema },
  combinatiiInterzise: { table: 'combinatii_interzise', schema: CombinatieInterzisaSchema },
} satisfies Record<RepoKey, TableDef>;

/** Provider in-memory (demo web fara DB si teste). */
export function createMemoryProvider(seed: MemorySeed = {}): DataProvider {
  const build = (key: RepoKey) => {
    const { schema } = DEFS[key];
    // biome-ignore lint/suspicious/noExplicitAny: builder generic
    return createMemoryRepository<any, any>(
      (input, id) => schema.parse({ ...input, id }),
      (seed[key] as any[]) ?? [],
    );
  };
  // biome-ignore lint/suspicious/noExplicitAny: constructie generica a provider-ului
  const out: any = {};
  for (const key of Object.keys(DEFS) as RepoKey[]) out[key] = build(key);
  // Initializeaza alocatorul cu numerele deja folosite de documentele din seed
  // (inserate direct, fara sa treaca prin numerotare.next) — altfel primul
  // document nou creat ar coliziona vizibil cu un cod deja existent in seed.
  const documenteSeed = seed.documente ?? [];
  out.numerotare = createMemoryNumerotare(
    documenteSeed.map((d) => ({
      tipDocument: d.tip,
      an: new Date(d.data).getFullYear(),
      numar: d.numar,
      prefix: d.serie,
    })),
  );
  return out as DataProvider;
}

/** Provider SQL (SQLite local / Postgres retea-cloud). */
export function createSqlProvider(exec: SqlExecutor): DataProvider {
  // biome-ignore lint/suspicious/noExplicitAny: constructie generica a provider-ului
  const out: any = {};
  for (const key of Object.keys(DEFS) as RepoKey[]) {
    const { table, schema } = DEFS[key];
    out[key] = createSqlRepository(exec, table, schema);
  }
  out.numerotare = createSqlNumerotare(exec);
  return out as DataProvider;
}

/**
 * Leaga TOATE repository-urile de un executor de tranzactie (P2-R5). Toate
 * repo-urile provider-ului rezultat trec prin `tx`, deci scrierile lor fac parte
 * din aceeasi tranzactie — nu exista cadere silentioasa pe executorul radacina.
 * Se foloseste in interiorul unui `exec.transaction(...)`:
 *
 *   await exec.transaction({}, async (tx) => {
 *     const repos = withExecutor(tx);
 *     await repos.documente.create(...);
 *     await repos.documenteLinii.create(...);
 *   });
 *
 * Faza 2 stabileste doar fundatia sigura; comenzile autoritare (Faza 3) o vor
 * folosi ca sa scrie document + linii + stoc + jurnal + audit atomic.
 */
export function withExecutor(tx: SqlExecutor): DataProvider {
  return createSqlProvider(tx);
}

/**
 * Provider peste API REST (client subtire pentru modurile retea / cloud).
 * `getToken` e citit la FIECARE cerere (nu capturat o data), ca token-ul de
 * sesiune curent (din AuthContext) sa ajunga mereu proaspat pe fiecare fetch —
 * altfel un login ulterior sau un logout nu s-ar reflecta in cererile deja
 * construite. Serverul (vezi server/src/auth.ts) respinge orice cerere fara
 * token valid, deci fara acest fir RBAC-ul din UI ar fi doar cosmetic.
 */
export function createApiProvider(baseUrl: string, getToken?: FurnizorToken): DataProvider {
  // biome-ignore lint/suspicious/noExplicitAny: constructie generica a provider-ului
  const out: any = {};
  for (const key of Object.keys(DEFS) as RepoKey[]) {
    out[key] = createApiRepository(baseUrl, DEFS[key].table, getToken);
  }
  out.numerotare = createApiNumerotare(baseUrl, getToken);
  return out as DataProvider;
}

/** Construieste provider-ul potrivit modului de deployment. */
export function createProvider(
  config: DeploymentConfig,
  exec?: SqlExecutor,
  getToken?: FurnizorToken,
): DataProvider {
  if (config.mode === 'local') {
    if (!exec) throw new Error('Modul local necesita un SqlExecutor (SQLite).');
    return createSqlProvider(exec);
  }
  if (!config.target)
    throw new Error('Modurile lan/cloud necesita un URL de API in config.target.');
  return createApiProvider(config.target, getToken);
}
