import { type OperatiuneBancara, parseExtrasCsv, reconciliazaAutomat } from '@gr/core-domain';
import { RefreshCw, Upload } from 'lucide-react';
import { useRef } from 'react';
import { type Column, DataTable } from '../components/DataTable.js';
import { Select } from '../components/controls.js';
import { Badge, Button, Card, PageHeader } from '../components/ui.js';
import { useCollection } from '../hooks/useCollection.js';
import { useData } from '../lib/data-context.js';
import * as fmt from '../lib/format.js';
import { useToast } from '../lib/toast.js';

export function BancaPage() {
  const db = useData();
  const { rows: bancare, loading, reload: reloadBancare } = useCollection(db.operatiuniBancare);
  const { rows: casa } = useCollection(db.operatiuniCasa);
  const fisierRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const casaDenumire = (id: string | null) => {
    const c = casa.find((x) => x.id === id);
    if (!c) return '—';
    return `${c.tip === 'incasare' ? 'Incasare' : 'Plata'} ${c.document || ''} (${fmt.data(c.data)})`.trim();
  };

  const importaCsv = async (fisier: File) => {
    const text = await fisier.text();
    const randuri = parseExtrasCsv(text);
    if (randuri.length === 0) {
      toast.error('Fisierul nu contine randuri valide (asteptat: data,suma,descriere).');
      return;
    }
    try {
      for (const r of randuri) {
        await db.operatiuniBancare.create({
          data: r.data,
          sumaBani: r.sumaBani,
          referinta: r.referinta,
          partenerId: null,
          reconciliata: false,
          operatiuneCasaId: null,
        });
      }
      toast.success(`Importate ${randuri.length} operatiuni din extras.`);
      reloadBancare();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Importul extrasului a esuat.');
    }
  };

  const reconciliazaToate = async () => {
    // Casa deja folosita de o operatiune bancara reconciliata anterior nu mai
    // poate fi re-potrivita cu alta — ca rularea repetata sa fie sigura (idempotenta).
    const casaFolosita = new Set(
      bancare
        .filter((b) => b.reconciliata && b.operatiuneCasaId)
        .map((b) => b.operatiuneCasaId as string),
    );
    const casaDisponibila = casa.filter((c) => !casaFolosita.has(c.id));
    const nereconciliate = bancare.filter((b) => !b.reconciliata);
    const potriviri = reconciliazaAutomat(nereconciliate, casaDisponibila, 3);

    for (const p of potriviri) {
      await db.operatiuniBancare.update(p.operatiuneBancaraId, {
        reconciliata: true,
        operatiuneCasaId: p.operatiuneCasaId,
      });
    }
    toast[potriviri.length > 0 ? 'success' : 'info'](
      `Reconciliate automat: ${potriviri.length} din ${nereconciliate.length} operatiuni nereconciliate.`,
    );
    reloadBancare();
  };

  const leagaManual = async (bancaraId: string, operatiuneCasaId: string) => {
    if (!operatiuneCasaId) return;
    await db.operatiuniBancare.update(bancaraId, { reconciliata: true, operatiuneCasaId });
    reloadBancare();
  };

  const anuleazaReconciliere = async (bancaraId: string) => {
    await db.operatiuniBancare.update(bancaraId, { reconciliata: false, operatiuneCasaId: null });
    reloadBancare();
  };

  const casaFolosita = new Set(
    bancare
      .filter((b) => b.reconciliata && b.operatiuneCasaId)
      .map((b) => b.operatiuneCasaId as string),
  );
  const casaOptiuni = casa
    .filter((c) => !casaFolosita.has(c.id))
    .map((c) => ({ value: c.id, label: casaDenumire(c.id) }));

  const columns: Column<OperatiuneBancara>[] = [
    { key: 'data', header: 'Data', render: (r) => fmt.data(r.data) },
    {
      key: 'suma',
      header: 'Suma',
      align: 'right',
      render: (r) => (
        <span className={r.sumaBani >= 0 ? 'text-success' : 'text-danger'}>
          {r.sumaBani >= 0 ? '+' : ''}
          {fmt.bani(r.sumaBani)}
        </span>
      ),
    },
    { key: 'referinta', header: 'Referinta (din extras)' },
    {
      key: 'stare',
      header: 'Reconciliere',
      render: (r) =>
        r.reconciliata ? (
          <div className="flex items-center gap-2">
            <Badge tone="success">Reconciliata</Badge>
            <span className="text-xs text-fg-muted">{casaDenumire(r.operatiuneCasaId)}</span>
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={() => anuleazaReconciliere(r.id)}
            >
              Anuleaza
            </button>
          </div>
        ) : (
          <Select
            options={[
              { value: '', label: '— leaga manual de o operatiune de casa —' },
              ...casaOptiuni,
            ]}
            value=""
            onChange={(e) => leagaManual(r.id, e.target.value)}
          />
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Banca — extras si reconciliere"
        subtitle="Import extras de cont (CSV) si potrivire cu registrul de casa"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => fisierRef.current?.click()}>
              <Upload className="h-4 w-4" /> Importa CSV
            </Button>
            <Button onClick={reconciliazaToate}>
              <RefreshCw className="h-4 w-4" /> Reconciliaza automat
            </Button>
            <input
              ref={fisierRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importaCsv(f);
                e.target.value = '';
              }}
            />
          </div>
        }
      />
      <Card className="mb-4 p-4 text-sm text-fg-muted">
        Format CSV asteptat: <code>data,suma,descriere</code> (o linie de antet, apoi randuri — data
        yyyy-mm-dd, suma cu semn: pozitiv = incasare, negativ = plata). Import nativ MT940/CAMT.053
        — planificat pentru o runda ulterioara.
      </Card>
      <DataTable
        columns={columns}
        rows={bancare}
        getRowKey={(r) => r.id}
        empty="Niciun extras importat."
        loading={loading}
      />
    </div>
  );
}
