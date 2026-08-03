import { describe, expect, it } from 'vitest';
import { exportDate, importDate } from './backup.js';
import { createMemoryProvider } from './provider.js';

describe('backup — export/import round-trip', () => {
  it('exporta si reimporta datele, pastrand relatiile (documentId)', async () => {
    const sursa = createMemoryProvider();
    const gestiune = await sursa.gestiuni.create({
      cod: 'BAR',
      denumire: 'Bar',
      gestionar: '',
      contSintetic: '371',
      contAnalitic: '',
      tip: 'global_valorica',
      punctDeLucruId: null,
      activ: true,
    });
    const doc = await sursa.documente.create({
      tip: 'receptie_furnizor',
      serie: 'NIR',
      numar: 1,
      cod: 'NIR-2026-000001',
      data: '2026-01-01',
      partenerId: null,
      gestiuneId: gestiune.id,
      gestiuneDestinatieId: null,
      punctDeLucruId: null,
      scadenta: null,
      observatii: '',
      stare: 'validat',
      totalNetBani: 1000,
      totalTvaBani: 190,
      totalBrutBani: 1190,
      avansBani: 0,
      meta: '{}',
    });
    await sursa.documenteLinii.create({
      documentId: doc.id,
      produsId: null,
      denumire: 'X',
      unitateMasura: 'buc',
      cantitate: 1,
      pretUnitarBani: 1000,
      cotaTvaProcent: 19,
      pretIncludeTva: false,
      netBani: 1000,
      tvaBani: 190,
      brutBani: 1190,
    });

    const snapshot = await exportDate(sursa);
    expect(snapshot.tabele.gestiuni).toHaveLength(1);
    expect(snapshot.tabele.documente).toHaveLength(1);
    expect(snapshot.tabele.documenteLinii).toHaveLength(1);

    // provider NOU, gol — restaureaza din instantaneu
    const destinatie = createMemoryProvider();
    const rezultat = await importDate(destinatie, snapshot, 'inlocuieste');
    expect(rezultat.inregistrariRestaurate).toBe(3);

    const gestiuniRestaurate = await destinatie.gestiuni.list();
    const docsRestaurate = await destinatie.documente.list();
    const liniiRestaurate = await destinatie.documenteLinii.list();
    expect(gestiuniRestaurate[0]!.id).toBe(gestiune.id); // ID pastrat
    expect(docsRestaurate[0]!.gestiuneId).toBe(gestiune.id); // relatia pastrata
    expect(liniiRestaurate[0]!.documentId).toBe(doc.id); // relatia pastrata
  });

  it('modul "inlocuieste" sterge datele existente inainte de restaurare', async () => {
    const destinatie = createMemoryProvider();
    await destinatie.gestiuni.create({
      cod: 'VECHI',
      denumire: 'Va fi stearsa',
      gestionar: '',
      contSintetic: '',
      contAnalitic: '',
      tip: 'cantitativ_valorica',
      punctDeLucruId: null,
      activ: true,
    });

    const gol = await exportDate(createMemoryProvider());
    await importDate(destinatie, gol, 'inlocuieste');

    expect(await destinatie.gestiuni.list()).toHaveLength(0);
  });

  it('modul "adauga" pastreaza datele existente (upsert)', async () => {
    const sursa = createMemoryProvider();
    await sursa.gestiuni.create({
      cod: 'NOU',
      denumire: 'Din backup',
      gestionar: '',
      contSintetic: '',
      contAnalitic: '',
      tip: 'cantitativ_valorica',
      punctDeLucruId: null,
      activ: true,
    });
    const snapshot = await exportDate(sursa);

    const destinatie = createMemoryProvider();
    await destinatie.gestiuni.create({
      cod: 'EXISTENTA',
      denumire: 'Ramane',
      gestionar: '',
      contSintetic: '',
      contAnalitic: '',
      tip: 'cantitativ_valorica',
      punctDeLucruId: null,
      activ: true,
    });

    await importDate(destinatie, snapshot, 'adauga');
    const toate = await destinatie.gestiuni.list();
    expect(toate).toHaveLength(2);
    expect(toate.some((g) => g.cod === 'EXISTENTA')).toBe(true);
    expect(toate.some((g) => g.cod === 'NOU')).toBe(true);
  });
});
