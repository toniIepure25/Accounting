import { describe, expect, it } from 'vitest';
import type { ClientComenzi, CorpComanda, NumeComandaDocument } from './api-comenzi.js';
import {
  ComandaInCoadaError,
  type StareCoada,
  createOfflineCommandClient,
  esteInCoada,
  stocatorMemorie,
} from './offline-comenzi.js';

/** Client de comenzi fals: inregistreaza apelurile si poate simula esecuri. */
function clientFals(opt?: {
  esecRetea?: () => boolean;
  esecBusiness?: (nume: string, corp: CorpComanda) => string | null;
}) {
  const apeluri: { nume: NumeComandaDocument; corp: CorpComanda }[] = [];
  const client: ClientComenzi = {
    ruleaza: async (nume, corp) => {
      apeluri.push({ nume, corp });
      if (opt?.esecRetea?.()) {
        const e = new TypeError('Failed to fetch');
        throw e;
      }
      const msg = opt?.esecBusiness?.(nume, corp);
      if (msg) throw new Error(msg);
      return { ok: true, nume, documentId: corp.documentId };
    },
    posteaza: (documentId, expectedVersion) =>
      client.ruleaza('post-document', { documentId, expectedVersion }),
    storneaza: (documentId, o = {}) => client.ruleaza('reverse-document', { documentId, ...o }),
  };
  return { client, apeluri };
}

describe('createOfflineCommandClient — coada de comenzi rezilienta la deconectare', () => {
  it('online: executa direct si nu pune nimic in coada', async () => {
    const { client, apeluri } = clientFals();
    const off = createOfflineCommandClient(client, {
      stocator: stocatorMemorie(),
      esteOnline: () => true,
    });

    const rez = (await off.posteaza('doc-1', 3)) as { ok: boolean };
    expect(rez.ok).toBe(true);
    expect(apeluri).toHaveLength(1);
    expect(off.inAsteptare()).toHaveLength(0);
  });

  it('offline: pune comanda in coada si ridica ComandaInCoadaError (fara apel de retea)', async () => {
    const { client, apeluri } = clientFals();
    const stocator = stocatorMemorie();
    const off = createOfflineCommandClient(client, { stocator, esteOnline: () => false });

    await expect(off.posteaza('doc-1', 2)).rejects.toBeInstanceOf(ComandaInCoadaError);
    expect(apeluri).toHaveLength(0); // nu s-a atins reteaua
    const coada = off.inAsteptare();
    expect(coada).toHaveLength(1);
    expect(coada[0]!.documentId).toBe('doc-1');
    expect(esteInCoada(new ComandaInCoadaError('k'))).toBe(true);
  });

  it('cadere de retea la trimitere: comanda ajunge in coada (server inaccesibil)', async () => {
    let online = true;
    const { client } = clientFals({ esecRetea: () => true });
    const off = createOfflineCommandClient(client, {
      stocator: stocatorMemorie(),
      esteOnline: () => online,
    });

    online = true; // suntem „online" dar serverul pica (TypeError la fetch)
    await expect(off.storneaza('doc-9')).rejects.toBeInstanceOf(ComandaInCoadaError);
    expect(off.inAsteptare().map((c) => c.documentId)).toEqual(['doc-9']);
  });

  it('eroarea de BUSINESS (4xx) NU se pune in coada — se propaga', async () => {
    const { client } = clientFals({ esecBusiness: () => 'tranzitie nepermisa' });
    const off = createOfflineCommandClient(client, {
      stocator: stocatorMemorie(),
      esteOnline: () => true,
    });

    await expect(off.posteaza('doc-1')).rejects.toThrow('tranzitie nepermisa');
    expect(off.inAsteptare()).toHaveLength(0);
  });

  it('enqueue idempotent: aceeasi comanda in coada o singura data', async () => {
    const { client } = clientFals();
    const stocator = stocatorMemorie();
    const off = createOfflineCommandClient(client, { stocator, esteOnline: () => false });

    await expect(off.posteaza('doc-1', 5)).rejects.toBeInstanceOf(ComandaInCoadaError);
    await expect(off.posteaza('doc-1', 5)).rejects.toBeInstanceOf(ComandaInCoadaError);
    expect(off.inAsteptare()).toHaveLength(1); // aceeasi cheie -> o singura intrare
  });

  it('la reconectare, sincronizeaza reda comenzile o singura data si goleste coada', async () => {
    let online = false;
    const { client, apeluri } = clientFals();
    const stocator = stocatorMemorie();
    const off = createOfflineCommandClient(client, { stocator, esteOnline: () => online });

    // Doua comenzi puse in coada cat timp offline.
    await expect(off.posteaza('doc-1', 1)).rejects.toBeInstanceOf(ComandaInCoadaError);
    await expect(off.storneaza('doc-2')).rejects.toBeInstanceOf(ComandaInCoadaError);
    expect(off.inAsteptare()).toHaveLength(2);
    expect(apeluri).toHaveLength(0);

    online = true;
    const rez = await off.sincronizeaza();
    expect(rez.redate).toBe(2);
    expect(rez.ramase).toBe(0);
    expect(apeluri.map((a) => a.nume)).toEqual(['post-document', 'reverse-document']);

    // O a doua sincronizare nu re-executa nimic (cheile sunt marcate executate).
    const rez2 = await off.sincronizeaza();
    expect(rez2.redate).toBe(0);
    expect(apeluri).toHaveLength(2);
  });

  it('redare cu esec de business: comanda se consuma (nu ramane blocata) si e raportata', async () => {
    let online = false;
    const { client } = clientFals({
      esecBusiness: (_n, corp) => (corp.documentId === 'doc-rau' ? 'deja postat' : null),
    });
    const stocator = stocatorMemorie();
    const off = createOfflineCommandClient(client, { stocator, esteOnline: () => online });

    await expect(off.posteaza('doc-rau', 1)).rejects.toBeInstanceOf(ComandaInCoadaError);
    await expect(off.posteaza('doc-bun', 1)).rejects.toBeInstanceOf(ComandaInCoadaError);

    online = true;
    const rez = await off.sincronizeaza();
    expect(rez.redate).toBe(1); // doar doc-bun
    expect(rez.esuate).toHaveLength(1);
    expect(rez.esuate[0]!.mesaj).toBe('deja postat');
    expect(rez.ramase).toBe(0); // ambele au fost consumate din coada
  });

  it('coada persista prin stocator (supravietuieste reconstruirii clientului)', async () => {
    // Un singur stocator partajat, ca localStorage-ul dintre doua monturi.
    let salvat: StareCoada = { coada: [], executate: [] };
    const partajat = {
      citeste: () => ({ coada: [...salvat.coada], executate: [...salvat.executate] }),
      scrie: (s: StareCoada) => {
        salvat = { coada: [...s.coada], executate: [...s.executate] };
      },
    };

    const off1 = createOfflineCommandClient(clientFals().client, {
      stocator: partajat,
      esteOnline: () => false,
    });
    await expect(off1.posteaza('doc-1', 1)).rejects.toBeInstanceOf(ComandaInCoadaError);

    // Un client NOU peste acelasi stocator vede coada.
    const off2 = createOfflineCommandClient(clientFals().client, {
      stocator: partajat,
      esteOnline: () => false,
    });
    expect(off2.inAsteptare()).toHaveLength(1);
  });
});
