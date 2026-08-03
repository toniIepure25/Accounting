import { type OperatiuneCasa, type Partener, registruCasa, ronToBani } from '@gr/core-domain';
import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { type Column, DataTable } from '../components/DataTable.js';
import { Field, Modal, Select } from '../components/controls.js';
import { Badge, Button, Card, Input, PageHeader } from '../components/ui.js';
import { useCollection } from '../hooks/useCollection.js';
import { useConfirm } from '../lib/confirm.js';
import { useData } from '../lib/data-context.js';
import * as fmt from '../lib/format.js';
import { useToast } from '../lib/toast.js';

type Rand = OperatiuneCasa & { soldBani: number };

export function CasaPage() {
  const db = useData();
  const { rows, loading, create, remove } = useCollection(db.operatiuniCasa);
  const toast = useToast();
  const confirmDialog = useConfirm();
  const [parteneri, setParteneri] = useState<Partener[]>([]);
  useEffect(() => {
    db.parteneri.list().then(setParteneri);
  }, [db]);

  const { operatiuni, soldFinalBani } = useMemo(() => registruCasa(rows, 0), [rows]);
  const totalIncasari = rows
    .filter((o) => o.tip === 'incasare')
    .reduce((s, o) => s + o.sumaBani, 0);
  const totalPlati = rows.filter((o) => o.tip === 'plata').reduce((s, o) => s + o.sumaBani, 0);
  const partenerNume = (id: string | null) => parteneri.find((p) => p.id === id)?.denumire ?? '—';

  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    data: '',
    tip: 'incasare',
    sumaRon: 0,
    partenerId: '',
    document: '',
    explicatie: '',
  });
  const openNew = () => {
    setF({
      data: new Date().toISOString().slice(0, 10),
      tip: 'incasare',
      sumaRon: 0,
      partenerId: '',
      document: '',
      explicatie: '',
    });
    setOpen(true);
  };
  const save = async () => {
    try {
      await create({
        data: f.data,
        tip: f.tip as 'incasare' | 'plata',
        sumaBani: ronToBani(Number(f.sumaRon) || 0),
        partenerId: f.partenerId || null,
        document: f.document,
        explicatie: f.explicatie,
        punctDeLucruId: null,
      });
      setOpen(false);
      toast.success('Operatiunea de casa a fost salvata.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Salvarea operatiunii a esuat.');
    }
  };

  const sterge = async (o: Rand) => {
    const ok = await confirmDialog({
      title: 'Sterge operatiunea',
      message: 'Sigur stergi aceasta operatiune de casa? Actiunea nu poate fi anulata.',
      confirmLabel: 'Sterge',
      danger: true,
    });
    if (!ok) return;
    try {
      await remove(o.id);
      toast.success('Operatiunea a fost stearsa.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Stergerea operatiunii a esuat.');
    }
  };

  const columns: Column<Rand>[] = [
    { key: 'data', header: 'Data', render: (o) => fmt.data(o.data) },
    {
      key: 'tip',
      header: 'Tip',
      render: (o) => <Badge tone={o.tip === 'incasare' ? 'success' : 'warning'}>{o.tip}</Badge>,
    },
    { key: 'partener', header: 'Partener', render: (o) => partenerNume(o.partenerId) },
    { key: 'document', header: 'Document', render: (o) => o.document || '—' },
    { key: 'explicatie', header: 'Explicatie', render: (o) => o.explicatie || '—' },
    {
      key: 'suma',
      header: 'Suma',
      align: 'right',
      render: (o) => (o.tip === 'incasare' ? '+' : '−') + fmt.bani(o.sumaBani),
    },
    {
      key: 'sold',
      header: 'Sold',
      align: 'right',
      render: (o) => <span className="font-medium">{fmt.bani(o.soldBani)}</span>,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Registru de casa"
        subtitle="Incasari si plati in numerar"
        actions={
          <Button onClick={openNew}>
            <Plus className="h-4 w-4" /> Operatiune
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <div className="text-sm text-fg-muted">Total incasari</div>
          <div className="mt-1 text-2xl font-semibold text-success">{fmt.lei(totalIncasari)}</div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-fg-muted">Total plati</div>
          <div className="mt-1 text-2xl font-semibold text-warning">{fmt.lei(totalPlati)}</div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-fg-muted">Sold casa</div>
          <div className="mt-1 text-2xl font-semibold text-fg">{fmt.lei(soldFinalBani)}</div>
        </Card>
      </div>

      <DataTable
        columns={columns}
        rows={operatiuni}
        getRowKey={(o) => o.id}
        empty="Nicio operatiune de casa."
        loading={loading}
        actions={(o) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => sterge(o)}
            title="Sterge"
            aria-label="Sterge operatiunea"
          >
            <Trash2 className="h-4 w-4 text-danger" />
          </Button>
        )}
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Operatiune de casa"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Renunta
            </Button>
            <Button onClick={save}>Salveaza</Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Data">
            <Input
              type="date"
              value={f.data}
              onChange={(e) => setF({ ...f, data: e.target.value })}
            />
          </Field>
          <Field label="Tip">
            <Select
              options={[
                { value: 'incasare', label: 'Incasare' },
                { value: 'plata', label: 'Plata' },
              ]}
              value={f.tip}
              onChange={(e) => setF({ ...f, tip: e.target.value })}
            />
          </Field>
          <Field label="Suma (RON)">
            <Input
              type="number"
              step="0.01"
              value={f.sumaRon}
              onChange={(e) => setF({ ...f, sumaRon: Number(e.target.value) })}
            />
          </Field>
          <Field label="Partener">
            <Select
              options={[
                { value: '', label: '— fara —' },
                ...parteneri.map((p) => ({ value: p.id, label: p.denumire })),
              ]}
              value={f.partenerId}
              onChange={(e) => setF({ ...f, partenerId: e.target.value })}
            />
          </Field>
          <Field label="Document">
            <Input value={f.document} onChange={(e) => setF({ ...f, document: e.target.value })} />
          </Field>
          <Field label="Explicatie">
            <Input
              value={f.explicatie}
              onChange={(e) => setF({ ...f, explicatie: e.target.value })}
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
