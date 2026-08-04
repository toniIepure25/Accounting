import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REGULI_TVA_RO, RegulaTvaInexistenta, procentTvaLaData } from '@gr/core-domain';
import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import { fromBetterSqlite } from './adapters/better-sqlite.js';
import { type Migration, migrate } from './migrate.js';
import {
  type TaxRuleRepository,
  createSqlTaxRuleRepository,
  rezolvaTvaPersistat,
} from './tax-rule-repo.js';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'db', 'migrations');
function migratii(): Migration[] {
  return readdirSync(DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => ({ id: f.replace(/\.sql$/, ''), sql: readFileSync(join(DIR, f), 'utf8') }));
}

let repo: TaxRuleRepository;
beforeEach(async () => {
  const db = new Database(':memory:');
  const exec = fromBetterSqlite(db);
  await migrate(exec, migratii());
  repo = createSqlTaxRuleRepository(exec);
});

describe('TaxRuleRepository + rezolvare persistata', () => {
  it('rezolva standardul 19% inainte si 21% dupa tranzitie, din DB', async () => {
    const inainte = await rezolvaTvaPersistat(repo, {
      data: '2025-07-31',
      codCategorieFiscala: 'standard',
    });
    const dupa = await rezolvaTvaPersistat(repo, {
      data: '2025-08-01',
      codCategorieFiscala: 'standard',
    });
    expect(inainte.procent).toBe(19);
    expect(inainte.persistata.id).toBe('ro-standard-19');
    expect(dupa.procent).toBe(21);
    expect(dupa.persistata.id).toBe('ro-standard-21');
    expect(dupa.persistata.legalReference).toContain('141/2025');
  });

  it('cotele reduse persistate: 9/5 -> 11 dupa tranzitie', async () => {
    expect(
      (await rezolvaTvaPersistat(repo, { data: '2025-07-31', codCategorieFiscala: 'redus_9' }))
        .procent,
    ).toBe(9);
    expect(
      (await rezolvaTvaPersistat(repo, { data: '2025-08-01', codCategorieFiscala: 'redus_9' }))
        .procent,
    ).toBe(11);
    expect(
      (await rezolvaTvaPersistat(repo, { data: '2025-07-31', codCategorieFiscala: 'redus_5' }))
        .procent,
    ).toBe(5);
    expect(
      (await rezolvaTvaPersistat(repo, { data: '2025-08-01', codCategorieFiscala: 'redus_5' }))
        .procent,
    ).toBe(11);
  });

  it('arunca eroare explicita cand nu exista regula (categorie necategorizata)', async () => {
    await expect(
      rezolvaTvaPersistat(repo, { data: '2025-08-01', codCategorieFiscala: 'necategorizat' }),
    ).rejects.toBeInstanceOf(RegulaTvaInexistenta);
  });

  it('getById si listVersions functioneaza', async () => {
    expect((await repo.getById('ro-standard-21'))?.rateBasisPoints).toBe(2100);
    expect(await repo.getById('inexistent')).toBeNull();
    const versiuni = await repo.listVersions({ jurisdiction: 'RO', code: 'standard' });
    expect(versiuni.map((v) => v.id)).toEqual(['ro-standard-19', 'ro-standard-21']);
  });

  it('ECHIVALENTA DB vs. domeniu: rezultatul persistat = rezultatul motorului pur', async () => {
    // Aceleasi intrari, rezolvate din DB si din seed-ul in-memory, dau aceeasi cota.
    const cazuri: Array<{ data: string; cod: string }> = [];
    for (const cod of ['standard', 'redus_9', 'redus_5', 'scutit']) {
      for (const data of ['2020-06-15', '2025-07-31', '2025-08-01', '2026-12-31']) {
        cazuri.push({ data, cod });
      }
    }
    for (const c of cazuri) {
      const dinDb = await rezolvaTvaPersistat(repo, { data: c.data, codCategorieFiscala: c.cod });
      const dinDomeniu = procentTvaLaData(REGULI_TVA_RO, {
        data: c.data,
        codCategorieFiscala: c.cod,
      });
      expect(dinDb.procent).toBe(dinDomeniu);
    }
  });
});
