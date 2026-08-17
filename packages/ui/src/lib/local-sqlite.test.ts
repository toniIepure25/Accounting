// @vitest-environment node
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import initSqlJs from 'sql.js';
import { describe, expect, it } from 'vitest';
import { creeazaProviderLocalSqlite, stocatorMemorieBaza } from './local-sqlite.js';

const require = createRequire(import.meta.url);
const DIST = dirname(require.resolve('sql.js'));
const injectii = {
  initSqlJs,
  wasmLocateFile: (f: string) => join(DIST, f),
  debounceMs: 5,
};
const asteapta = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('creeazaProviderLocalSqlite — motor SQLite-WASM in modul local', () => {
  it('prima pornire: aplica schema + seed demo (nomenclatoarele nu-s goale)', async () => {
    const { provider } = await creeazaProviderLocalSqlite({
      ...injectii,
      stocator: stocatorMemorieBaza(),
    });
    expect((await provider.produse.list()).length).toBeGreaterThan(0);
    expect((await provider.firme.list()).length).toBeGreaterThan(0);
  });

  it('persista in stocator si datele supravietuiesc unei reincarcari', async () => {
    const stocator = stocatorMemorieBaza();
    const { provider: p1 } = await creeazaProviderLocalSqlite({ ...injectii, stocator });

    await p1.parteneri.create({ tip: 'client', denumire: 'Client Persistat SRL' });
    await asteapta(30); // lasa debounce-ul sa salveze

    const bytes = await stocator.incarca();
    expect(bytes).not.toBeNull();

    // „Reincarcare": provider NOU peste instantaneul salvat, fara re-seed.
    const { provider: p2 } = await creeazaProviderLocalSqlite({
      ...injectii,
      stocator: stocatorMemorieBaza(bytes),
      seed: false,
    });
    const denumiri = (await p2.parteneri.list()).map((p) => p.denumire);
    expect(denumiri).toContain('Client Persistat SRL');
  });
});
