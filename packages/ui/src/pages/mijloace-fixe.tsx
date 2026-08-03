import { type MijlocFix, calculAmortizareLunara } from '@gr/core-domain';
import { Calculator } from 'lucide-react';
import { useState } from 'react';
import type { Column } from '../components/DataTable.js';
import { EntityGrid, type FieldDef } from '../components/EntityGrid.js';
import { Badge, Button, Card, PageHeader } from '../components/ui.js';
import { useCollection } from '../hooks/useCollection.js';
import { useAuth } from '../lib/auth-context.js';
import { useData } from '../lib/data-context.js';
import * as fmt from '../lib/format.js';

const columns: Column<MijlocFix>[] = [
  { key: 'cod', header: 'Cod' },
  { key: 'denumire', header: 'Denumire' },
  { key: 'categorie', header: 'Categorie' },
  {
    key: 'valoareIntrareBani',
    header: 'Valoare intrare',
    align: 'right',
    render: (r) => fmt.bani(r.valoareIntrareBani),
  },
  {
    key: 'amortizareCumulataBani',
    header: 'Amortizat',
    align: 'right',
    render: (r) => fmt.bani(r.amortizareCumulataBani),
  },
  {
    key: 'ramasa',
    header: 'Ramasa',
    align: 'right',
    render: (r) => fmt.bani(Math.max(0, r.valoareIntrareBani - r.amortizareCumulataBani)),
  },
  { key: 'metodaAmortizare', header: 'Metoda', render: (r) => <Badge>{r.metodaAmortizare}</Badge> },
  {
    key: 'stare',
    header: 'Stare',
    render: (r) =>
      r.casat ? <Badge tone="danger">Casat</Badge> : <Badge tone="success">Activ</Badge>,
  },
];

const fields: FieldDef[] = [
  { name: 'cod', label: 'Cod', type: 'text' },
  { name: 'denumire', label: 'Denumire', type: 'text', full: true },
  { name: 'categorie', label: 'Categorie', type: 'text' },
  { name: 'valoareIntrareBani', label: 'Valoare intrare', type: 'money' },
  { name: 'dataPunereFunctiune', label: 'Data punere in functiune (yyyy-mm-dd)', type: 'text' },
  { name: 'durataNormalaLuni', label: 'Durata normala (luni)', type: 'number' },
  {
    name: 'metodaAmortizare',
    label: 'Metoda amortizare',
    type: 'select',
    options: [
      { value: 'liniara', label: 'Liniara' },
      { value: 'degresiva', label: 'Degresiva' },
    ],
  },
  { name: 'coeficientDegresiv', label: 'Coeficient degresiv (doar la degresiva)', type: 'number' },
  {
    name: 'amortizareCumulataBani',
    label: 'Amortizare cumulata (nu edita manual, se actualizeaza automat)',
    type: 'money',
  },
  { name: 'activ', label: 'Activ', type: 'checkbox' },
  { name: 'casat', label: 'Casat', type: 'checkbox' },
];

const defaults = {
  cod: '',
  denumire: '',
  categorie: '',
  valoareIntrareBani: 0,
  dataPunereFunctiune: new Date().toISOString().slice(0, 10),
  durataNormalaLuni: 60,
  metodaAmortizare: 'liniara',
  coeficientDegresiv: 1,
  amortizareCumulataBani: 0,
  gestiuneId: null,
  activ: true,
  casat: false,
  dataCasare: null,
};

export function MijloaceFixePage() {
  const db = useData();
  const { areVoie } = useAuth();
  const { rows, reload } = useCollection(db.mijloaceFixe);
  const [mesaj, setMesaj] = useState('');
  const [seRuleaza, setSeRuleaza] = useState(false);
  const [gridKey, setGridKey] = useState(0);

  const previzualizare = rows
    .filter((mf) => mf.activ && !mf.casat)
    .map((mf) => ({ mf, cota: calculAmortizareLunara(mf) }))
    .filter((x) => x.cota > 0);
  const totalLuna = previzualizare.reduce((a, x) => a + x.cota, 0);

  const ruleazaAmortizare = async () => {
    setMesaj('');
    if (!areVoie('documente.validare')) {
      setMesaj('Nu ai drept de a rula amortizarea (necesita permisiunea de validare documente).');
      return;
    }
    if (previzualizare.length === 0) return;

    setSeRuleaza(true);
    const data = new Date().toISOString().slice(0, 10);
    const an = new Date().getFullYear();
    const { numar, cod } = await db.numerotare.next('nota_amortizare', an, 'AMZ', 6);
    const doc = await db.documente.create({
      tip: 'nota_amortizare',
      serie: 'AMZ',
      numar,
      cod,
      data,
      partenerId: null,
      gestiuneId: null,
      gestiuneDestinatieId: null,
      punctDeLucruId: null,
      documentSursaId: null,
      scadenta: null,
      observatii: `Amortizare lunara pentru ${previzualizare.length} mijloace fixe`,
      stare: 'validat',
      totalNetBani: totalLuna,
      totalTvaBani: 0,
      totalBrutBani: totalLuna,
      avansBani: 0,
      meta: '{}',
    });
    for (const { mf, cota } of previzualizare) {
      await db.documenteLinii.create({
        documentId: doc.id,
        produsId: null,
        denumire: mf.denumire,
        unitateMasura: 'buc',
        cantitate: 1,
        pretUnitarBani: cota,
        cotaTvaProcent: 0,
        pretIncludeTva: false,
        netBani: cota,
        tvaBani: 0,
        brutBani: cota,
      });
      await db.mijloaceFixe.update(mf.id, {
        amortizareCumulataBani: mf.amortizareCumulataBani + cota,
      });
    }
    setMesaj(
      `Amortizare inregistrata: ${doc.cod}, total ${fmt.lei(totalLuna)}, pentru ${previzualizare.length} mijloace fixe.`,
    );
    setSeRuleaza(false);
    reload();
    setGridKey((k) => k + 1); // forteaza remount-ul EntityGrid ca sa preia valorile actualizate
  };

  return (
    <div>
      <PageHeader title="Mijloace fixe" subtitle="Registru de mijloace fixe si amortizare lunara" />

      <Card className="mb-6 p-5">
        <h3 className="mb-3 flex items-center gap-2 font-semibold text-fg">
          <Calculator className="h-5 w-5 text-primary" /> Amortizare — luna curenta
        </h3>
        {previzualizare.length === 0 ? (
          <p className="text-sm text-fg-muted">
            Niciun mijloc fix activ de amortizat luna aceasta.
          </p>
        ) : (
          <>
            <table className="mb-3 w-full text-sm">
              <tbody>
                {previzualizare.map(({ mf, cota }) => (
                  <tr key={mf.id} className="border-b border-border/60 last:border-0">
                    <td className="py-1.5 text-fg">
                      {mf.cod} · {mf.denumire}
                    </td>
                    <td className="py-1.5 text-right text-fg">{fmt.bani(cota)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mb-3 text-sm font-medium text-fg">Total luna: {fmt.lei(totalLuna)}</p>
          </>
        )}
        <Button onClick={ruleazaAmortizare} disabled={seRuleaza || previzualizare.length === 0}>
          Ruleaza amortizare
        </Button>
        {mesaj && <p className="mt-2 text-sm text-fg-muted">{mesaj}</p>}
      </Card>

      <EntityGrid<MijlocFix>
        key={gridKey}
        title="Registru mijloace fixe"
        subtitle="Active imobilizate corporale"
        labelSingular="mijloc fix"
        repo={db.mijloaceFixe}
        columns={columns}
        fields={fields}
        defaults={defaults}
      />
    </div>
  );
}
