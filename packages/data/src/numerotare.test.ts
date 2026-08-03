import { describe, expect, it } from 'vitest';
import { createMemoryNumerotare, createSqlNumerotare } from './numerotare.js';
import type { SqlExecutor } from './sql-executor.js';

describe('numerotare — memory (atomic)', () => {
  it('aloca numere unice, secventiale', async () => {
    const n = createMemoryNumerotare();
    const a = await n.next('factura_vanzare', 2026, 'FCT');
    const b = await n.next('factura_vanzare', 2026, 'FCT');
    expect(a.numar).toBe(1);
    expect(b.numar).toBe(2);
    expect(a.cod).toBe('FCT-2026-000001');
    expect(b.cod).toBe('FCT-2026-000002');
  });

  it('serii diferite (tip sau an) sunt independente', async () => {
    const n = createMemoryNumerotare();
    await n.next('factura_vanzare', 2026, 'FCT');
    const alt = await n.next('nir', 2026, 'NIR');
    const anAlt = await n.next('factura_vanzare', 2027, 'FCT');
    expect(alt.numar).toBe(1);
    expect(anAlt.numar).toBe(1);
  });

  it('nu produce duplicate sub apeluri concurente (fixul fata de count-based)', async () => {
    const n = createMemoryNumerotare();
    // 20 alocari "simultane" (fara await intre ele) trebuie sa produca 20 numere unice
    const rezultate = await Promise.all(
      Array.from({ length: 20 }, () => n.next('bon_consum', 2026, 'BC')),
    );
    const numere = rezultate.map((r) => r.numar).sort((a, b) => a - b);
    const unice = new Set(numere);
    expect(unice.size).toBe(20);
    expect(numere[0]).toBe(1);
    expect(numere[19]).toBe(20);
  });

  it('initializata cu numere existente (seed), continua de la cel mai mare fara coliziune', async () => {
    const n = createMemoryNumerotare([
      { tipDocument: 'factura_vanzare', an: 2026, numar: 1, prefix: 'FCT' },
      { tipDocument: 'factura_vanzare', an: 2026, numar: 3, prefix: 'FCT' }, // ex.: un document sters intre timp
    ]);
    const urmator = await n.next('factura_vanzare', 2026, 'FCT');
    expect(urmator.numar).toBe(4);
    expect(urmator.cod).toBe('FCT-2026-000004');

    // o serie neatinsa de `existente` porneste normal de la 1
    const altaSerie = await n.next('nir', 2026, 'NIR');
    expect(altaSerie.numar).toBe(1);
  });
});

describe('numerotare — SQL (UPDATE...RETURNING simulat)', () => {
  it('insereaza seria la prima alocare, apoi incrementeaza', async () => {
    const stare = new Map<
      string,
      { prefix: string; ultimul_numar: number; lungime_numar: number }
    >();
    const exec: SqlExecutor = {
      async execute(sql, params) {
        if (sql.startsWith('INSERT INTO serii_documente')) {
          const [, tip, prefix, an, lungime] = params as [string, string, string, number, number];
          stare.set(`${tip}::${an}`, { prefix, ultimul_numar: 1, lungime_numar: lungime });
        } else if (sql.startsWith('UPDATE serii_documente')) {
          const [tip, an] = params as [string, number];
          const cur = stare.get(`${tip}::${an}`)!;
          cur.ultimul_numar += 1;
        }
        return { rowsAffected: 1 };
      },
      async select<T>(sql: string, params?: readonly unknown[]) {
        const [tip, an] = params as [string, number];
        const r = stare.get(`${tip}::${an}`);
        return (r ? [r] : []) as T[];
      },
    };

    const n = createSqlNumerotare(exec);
    const a = await n.next('factura_vanzare', 2026, 'FCT', 6);
    const b = await n.next('factura_vanzare', 2026, 'FCT', 6);
    expect(a.numar).toBe(1);
    expect(b.numar).toBe(2);
    expect(b.cod).toBe('FCT-2026-000002');
  });
});
