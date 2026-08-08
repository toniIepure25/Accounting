import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Document, DocumentLinieSchema, DocumentSchema } from '@gr/core-domain';
import {
  type Migration,
  type SqlExecutor,
  exportBazaSql,
  importBazaSql,
  migrate,
  verificaIntegritateBackup,
  withExecutor,
} from '@gr/data';
import { fromBetterSqlite } from '@gr/data/node-sqlite';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { createDraftDocument } from './lifecycle.js';
import { postDocument } from './post-document.js';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'db', 'migrations');
function migratii(): Migration[] {
  return readdirSync(DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => ({ id: f.replace(/\.sql$/, ''), sql: readFileSync(join(DIR, f), 'utf8') }));
}

const NOW = '2026-01-15T10:00:00.000Z';

async function bazaGoala(): Promise<SqlExecutor> {
  const exec = fromBetterSqlite(new Database(':memory:'));
  await migrate(exec, migratii());
  return exec;
}

/**
 * DR end-to-end REAL: posteaza un document prin motor (stoc + jurnal + fiscal
 * scriu registrele), face backup complet, il restaureaza intr-o baza NOUA si
 * verifica ca registrele sunt identice si coerente. Aceasta e proba ca un backup
 * chiar salveaza starea financiara postata, nu doar nomenclatoarele.
 */
describe('backup DR — postare reala apoi restaurare intr-o baza noua', () => {
  it('registrele postate (stoc/jurnal/fiscal) supravietuiesc round-trip-ului', async () => {
    const sursa = await bazaGoala();
    const repos = withExecutor(sursa);
    const p = await repos.produse.create({
      cod: 'DULAP',
      denumire: 'Dulap',
      codCategorieFiscala: 'standard',
    });
    const partener = await repos.parteneri.create({ tip: 'client', denumire: 'Client SRL' });
    const g = await repos.gestiuni.create({ cod: 'G1', denumire: 'Gestiune 1' });
    await sursa.execute(
      `INSERT INTO stock_balances (gestiune_id, produs_id, firma_id, cantitate, valoare_bani, pmp_bani, updated_at)
       VALUES (?, ?, NULL, 100, 100000, 1000, ?)`,
      [g.id, p.id, NOW],
    );

    const d: Document = DocumentSchema.parse({
      id: crypto.randomUUID(),
      tip: 'factura_vanzare',
      data: '2025-09-10',
      partenerId: partener.id,
      gestiuneId: g.id,
      stare: 'ciorna',
    });
    const l = DocumentLinieSchema.parse({
      id: crypto.randomUUID(),
      documentId: d.id,
      produsId: p.id,
      denumire: 'Dulap',
      cantitate: 2,
      pretUnitarBani: 10000,
      cotaTvaProcent: 21,
    });
    const deps = { exec: sursa, actor: 'tester', now: () => NOW };
    await createDraftDocument(deps, { document: d, linii: [l] });
    await postDocument(deps, d.id);

    // Postarea a scris registrele in sursa.
    const numar = async (exec: SqlExecutor, tabela: string) =>
      Number((await exec.select<{ n: number }>(`SELECT COUNT(*) AS n FROM ${tabela}`))[0]!.n);
    expect(await numar(sursa, 'stock_ledger_entries')).toBeGreaterThan(0);
    expect(await numar(sursa, 'journal_lines')).toBeGreaterThan(0);
    expect(await numar(sursa, 'fiscal_events')).toBeGreaterThan(0);

    // Backup complet -> restaurare intr-o baza NOUA (goala, doar migrata).
    const snap = await exportBazaSql(sursa);
    const tinta = await bazaGoala();
    await importBazaSql(tinta, snap, { verificaIntegritatea: true });

    // Fiecare registru are exact acelasi numar de randuri dupa restaurare.
    for (const t of [
      'documente',
      'documente_linii',
      'stock_ledger_entries',
      'stock_balances',
      'journal_entries',
      'journal_lines',
      'fiscal_events',
    ]) {
      expect(await numar(tinta, t)).toBe(await numar(sursa, t));
    }

    // Documentul postat e regasibil, cu totalurile autoritare (21% => 24200 brut).
    const [doc] = await tinta.select<{ stare: string; total_brut_bani: number }>(
      'SELECT stare, total_brut_bani FROM documente WHERE id = ?',
      [d.id],
    );
    expect(doc?.stare).toBe('validat');
    expect(Number(doc?.total_brut_bani)).toBe(24200);

    // Soldul de stoc restaurat (100 - 2 = 98) si jurnalul ramane echilibrat.
    const [sold] = await tinta.select<{ cantitate: number }>(
      'SELECT cantitate FROM stock_balances WHERE gestiune_id = ? AND produs_id = ?',
      [g.id, p.id],
    );
    expect(Number(sold?.cantitate)).toBe(98);
    const raport = await verificaIntegritateBackup(tinta);
    expect(raport.journalEchilibrat).toBe(true);
  });
});
