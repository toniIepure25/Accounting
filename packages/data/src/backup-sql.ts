import type { SqlExecutor } from './sql-executor.js';

/**
 * Backup/restaurare la nivel de BAZA DE DATE (nu prin repository-uri), pentru
 * disaster-recovery real.
 *
 * `backup.ts` (bazat pe DataProvider) exporta doar nomenclatoarele si documentele
 * — adica DOAR tabelele care au un Repository. NU cuprinde registrele PERSISTENTE
 * scrise de motorul de postare: stoc (stock_ledger_entries / stock_balances),
 * jurnal contabil (journal_entries / journal_lines), evenimente fiscale
 * (fiscal_events), e-Factura (efactura_submissions), productie (productie_mobila),
 * chei de idempotenta etc. O restaurare doar-prin-provider ar pierde intreg
 * istoricul financiar — o gaura de DR.
 *
 * Modulul de aici face un instantaneu COMPLET, descoperind tabelele direct din
 * catalogul bazei (`sqlite_master`), astfel incat orice tabela noua adaugata in
 * viitor intra automat in backup (nu poate fi uitata dintr-o lista scrisa manual).
 * Restaurarea e ATOMICA (o singura tranzactie) si amana verificarea cheilor
 * straine pana la commit, ca ordinea de inserare (inclusiv auto-referintele
 * documente→documente) sa nu conteze.
 */

/** Instantaneu complet la nivel de baza. Serializabil ca JSON. */
export interface BackupBaza {
  versiune: 1;
  exportatLa: string; // ISO
  /** Randuri brute per tabela (chei = coloane snake_case, exact ca in DB). */
  tabele: Record<string, Record<string, unknown>[]>;
}

/** Tabele care NU fac parte din datele de restaurat (schema, nu date). */
const TABELE_EXCLUSE = new Set(['_migrations']);

/**
 * Descopera tabelele de date din catalogul SQLite. Exclude tabelele interne
 * SQLite si `_migrations` (versiunea de schema se aplica prin `migrate` pe tinta
 * INAINTE de restaurare, nu se copiaza).
 */
export async function descoperaTabele(exec: SqlExecutor): Promise<string[]> {
  const randuri = await exec.select<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  return randuri.map((r) => r.name).filter((n) => !TABELE_EXCLUSE.has(n));
}

/** Citeste toate randurile fiecarei tabele intr-un instantaneu complet. */
export async function exportBazaSql(exec: SqlExecutor): Promise<BackupBaza> {
  const tabele: Record<string, Record<string, unknown>[]> = {};
  for (const t of await descoperaTabele(exec)) {
    tabele[t] = await exec.select<Record<string, unknown>>(`SELECT * FROM "${t}"`);
  }
  return { versiune: 1, exportatLa: new Date().toISOString(), tabele };
}

export interface RezultatRestaurareBaza {
  tabeleRestaurate: number;
  randuriRestaurate: number;
}

function insertRand(
  tabela: string,
  rand: Record<string, unknown>,
): { sql: string; params: unknown[] } {
  const coloane = Object.keys(rand);
  const placeholders = coloane.map(() => '?').join(', ');
  const cols = coloane.map((c) => `"${c}"`).join(', ');
  return {
    sql: `INSERT INTO "${tabela}" (${cols}) VALUES (${placeholders})`,
    params: coloane.map((c) => rand[c]),
  };
}

/**
 * Restaureaza ATOMIC un instantaneu complet intr-o baza DEJA migrata la aceeasi
 * schema (sau mai noua). Sterge tot continutul tabelelor tinta si reincarca exact
 * randurile din backup, pastrand ID-urile (esential pentru relatiile intre
 * tabele). Ruleaza intr-o singura tranzactie cu cheile straine AMANATE pana la
 * commit — deci ordinea de stergere/inserare nu conteaza si auto-referintele
 * (documente→documente_sursa) se restaureaza corect. Daca ceva pica, se face
 * ROLLBACK si baza ramane neatinsa.
 *
 * Opereaza doar pe tabelele care EXISTA pe tinta (descoperite live). O tabela din
 * backup absenta pe tinta e ignorata; o tabela de pe tinta absenta din backup e
 * golita (backup-ul e sursa de adevar pentru o restaurare completa).
 */
export async function importBazaSql(
  exec: SqlExecutor,
  snapshot: BackupBaza,
  optiuni: { verificaIntegritatea?: boolean } = {},
): Promise<RezultatRestaurareBaza> {
  const tinta = await descoperaTabele(exec);

  return exec.transaction({ sqliteMode: 'immediate' }, async (tx) => {
    // Amana verificarea FK pana la COMMIT (SQLite): ordinea nu mai conteaza.
    await tx.execute('PRAGMA defer_foreign_keys = ON');

    for (const t of tinta) await tx.execute(`DELETE FROM "${t}"`);

    let randuriRestaurate = 0;
    let tabeleRestaurate = 0;
    for (const t of tinta) {
      const randuri = snapshot.tabele[t];
      if (!randuri || randuri.length === 0) continue;
      tabeleRestaurate++;
      for (const rand of randuri) {
        const { sql, params } = insertRand(t, rand);
        await tx.execute(sql, params);
        randuriRestaurate++;
      }
    }

    if (optiuni.verificaIntegritatea) {
      const raport = await verificaIntegritateBackup(tx);
      if (!raport.journalEchilibrat) {
        throw new BackupCorruptError(
          `jurnal dezechilibrat dupa restaurare: debit ${raport.totalDebitBani} != credit ${raport.totalCreditBani}`,
        );
      }
    }

    return { tabeleRestaurate, randuriRestaurate };
  });
}

/**
 * Face un backup si il PROBEAZA imediat, restaurandu-l intr-o baza-scratch
 * proaspata si verificand ca round-trip-ul e fidel (acelasi numar de randuri per
 * tabela) si ca jurnalul ramane echilibrat. Un backup pe care nu l-ai
 * test-restaurat NU e un backup — poate fi corupt/incomplet fara sa stii pana in
 * ziua dezastrului. Intoarce instantaneul DOAR daca proba a trecut; altfel arunca
 * `BackupCorruptError` (deci nu ajungi sa scrii pe disc un backup nefolositor).
 *
 * `creeazaScratchMigrat` produce un executor pe o baza GOALA dar deja migrata la
 * aceeasi schema (ex. `() => { const e = fromBetterSqlite(new Database(':memory:'));
 * await migrate(e, migratii()); return e; }`). Injectat ca sa tinem acest modul
 * liber de dependinte de driver/Node (e importat si in bundle-ul web).
 */
export async function backupVerificat(
  exec: SqlExecutor,
  creeazaScratchMigrat: () => Promise<SqlExecutor>,
): Promise<BackupBaza> {
  const snapshot = await exportBazaSql(exec);
  const sursa = await verificaIntegritateBackup(exec);

  const scratch = await creeazaScratchMigrat();
  await importBazaSql(scratch, snapshot, { verificaIntegritatea: true });
  const proba = await verificaIntegritateBackup(scratch);

  for (const [tabela, n] of Object.entries(sursa.randuriPeTabela)) {
    if (proba.randuriPeTabela[tabela] !== n) {
      throw new BackupCorruptError(
        `proba de restaurare a esuat pentru "${tabela}": ${n} randuri in sursa, ${proba.randuriPeTabela[tabela] ?? 0} dupa restaurare`,
      );
    }
  }
  if (
    proba.totalDebitBani !== sursa.totalDebitBani ||
    proba.totalCreditBani !== sursa.totalCreditBani
  ) {
    throw new BackupCorruptError('proba de restaurare a alterat totalurile din jurnal');
  }

  return snapshot;
}

/** Ridicata cand verificarea de integritate a backup-ului esueaza. */
export class BackupCorruptError extends Error {
  constructor(mesaj: string) {
    super(mesaj);
    this.name = 'BackupCorruptError';
  }
}

export interface RaportIntegritateBackup {
  /** Suma debitelor = suma creditelor pe tot registrul-jurnal (partida dubla). */
  journalEchilibrat: boolean;
  totalDebitBani: number;
  totalCreditBani: number;
  /** Numarul de randuri per tabela (pentru comparatie sursa↔restaurat). */
  randuriPeTabela: Record<string, number>;
}

/**
 * Verifica invariantele care TREBUIE sa se pastreze dupa o restaurare corecta:
 * jurnalul contabil ramane echilibrat (partida dubla) si raporteaza numarul de
 * randuri per tabela (baza comparatiei de fidelitate a round-trip-ului).
 */
export async function verificaIntegritateBackup(
  exec: SqlExecutor,
): Promise<RaportIntegritateBackup> {
  const [tot] = await exec.select<{ d: number; c: number }>(
    'SELECT COALESCE(SUM(debit_bani), 0) AS d, COALESCE(SUM(credit_bani), 0) AS c FROM journal_lines',
  );
  const totalDebitBani = Number(tot?.d ?? 0);
  const totalCreditBani = Number(tot?.c ?? 0);

  const randuriPeTabela: Record<string, number> = {};
  for (const t of await descoperaTabele(exec)) {
    const [n] = await exec.select<{ n: number }>(`SELECT COUNT(*) AS n FROM "${t}"`);
    randuriPeTabela[t] = Number(n?.n ?? 0);
  }

  return {
    journalEchilibrat: totalDebitBani === totalCreditBani,
    totalDebitBani,
    totalCreditBani,
    randuriPeTabela,
  };
}
