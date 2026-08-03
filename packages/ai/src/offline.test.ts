import { describe, expect, it } from 'vitest';
import { createOfflineProvider } from './offline.js';
import type { ContextGestiune } from './types.js';

const ctx: ContextGestiune = {
  soldCasaBani: -261000,
  valoareStocBani: 700000,
  produseSubMinim: [{ denumire: 'PAL melaminat', stoc: 5, minim: 20 }],
  comenziInLucru: 3,
  tvaDePlataBani: 12065,
  nrClienti: 2,
  nrFurnizori: 1,
  vanzariBrutBani: 119000,
};

async function ask(q: string): Promise<string> {
  return createOfflineProvider().chat([{ rol: 'user', text: q }], ctx);
}

describe('asistent offline', () => {
  it('raspunde despre soldul casei', async () => {
    expect(await ask('cati bani am in casa?')).toContain('-2.610,00');
  });
  it('raspunde despre valoarea stocului', async () => {
    expect(await ask('cat stoc am?')).toContain('7.000,00');
  });
  it('listeaza produsele sub minim', async () => {
    const r = await ask('ce trebuie sa comand?');
    expect(r).toContain('PAL melaminat');
    expect(r).toContain('sub minim');
  });
  it('raspunde despre TVA', async () => {
    expect(await ask('cat TVA am de plata?')).toContain('120,65');
  });
  it('ofera ajutor cand nu intelege', async () => {
    expect(await ask('xyzzy')).toContain('Pot raspunde');
  });
});
