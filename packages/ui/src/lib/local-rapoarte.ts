import {
  genereazaD390,
  genereazaD394,
  genereazaDecontDinRegistre,
  genereazaSaftDinRegistre,
} from '@gr/application';
import {
  type ClientRapoarte,
  type SqlExecutor,
  interogheazaDocumente,
  listeazaMiscariStocPersistate,
  listeazaNoteContabilePersistate,
  listeazaSolduriStoc,
  withExecutor,
} from '@gr/data';

/**
 * Rapoartele modului `local-sqlite`, citite din REGISTRELE persistate ale bazei
 * SQLite-WASM din browser (jurnal / stoc / evenimente fiscale) — exact aceleasi
 * functii ca serverul, dar pe executorul local. Astfel, dupa ce postarea locala
 * (WIRING-13) scrie registrele, contabilitatea / stocul / D300 / SAF-T / D394 /
 * D390 le CITESC, in loc sa recalculeze din documente. `firmaId` e citit LIVE
 * (firma curenta se poate schimba), ca peste tot.
 */
export function createLocalReportsClient(
  exec: SqlExecutor,
  firmaId: () => string | null,
): ClientRapoarte {
  const deps = { exec, actor: 'local' };
  return {
    noteContabile: () => listeazaNoteContabilePersistate(exec, firmaId()),
    stoc: async () => ({
      miscari: await listeazaMiscariStocPersistate(exec, firmaId()),
      solduri: await listeazaSolduriStoc(exec, firmaId()),
    }),
    decont: (interval = {}) =>
      genereazaDecontDinRegistre(deps, {
        de: interval.de,
        pana: interval.pana,
        firmaId: firmaId(),
      }),
    documente: (filtru = {}, paginare = {}) =>
      interogheazaDocumente(exec, { ...filtru, firmaId: firmaId() }, paginare),
    saft: async ({ an, luna }) => {
      const f = firmaId();
      const firma = f ? await withExecutor(exec).firme.getById(f) : null;
      const ll = String(luna).padStart(2, '0');
      const de = `${an}-${ll}-01`;
      const pana = `${an}-${ll}-${String(new Date(an, luna, 0).getDate()).padStart(2, '0')}`;
      return genereazaSaftDinRegistre(deps, {
        companie: {
          nume: firma?.denumire || 'Firma nesetata',
          cui: firma?.cui || '',
          perioadaLuna: luna,
          perioadaAn: an,
        },
        de,
        pana,
        firmaId: f,
      });
    },
    d394: (interval = {}) =>
      genereazaD394(deps, { de: interval.de, pana: interval.pana, firmaId: firmaId() }),
    d390: (interval = {}) =>
      genereazaD390(deps, { de: interval.de, pana: interval.pana, firmaId: firmaId() }),
  };
}
