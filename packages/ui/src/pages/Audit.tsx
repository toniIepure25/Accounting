import { type AuditEntry, filtreazaAudit } from '@gr/core-domain';
import { useMemo, useState } from 'react';
import { type Column, DataTable } from '../components/DataTable.js';
import { Field, Select } from '../components/controls.js';
import { Badge, Card, Input, PageHeader } from '../components/ui.js';
import { useCollection } from '../hooks/useCollection.js';
import { useData } from '../lib/data-context.js';

const TON_ACTIUNE = { creare: 'success', actualizare: 'warning', stergere: 'danger' } as const;

export function AuditPage() {
  const { rows } = useCollection(useData().auditLog);
  const [entitate, setEntitate] = useState('');
  const [de, setDe] = useState('');
  const [pana, setPana] = useState('');

  const entitati = useMemo(() => [...new Set(rows.map((r) => r.entitate))].sort(), [rows]);
  const filtrate = useMemo(
    () =>
      filtreazaAudit(rows, {
        entitate: entitate || undefined,
        de: de || undefined,
        pana: pana || undefined,
      }),
    [rows, entitate, de, pana],
  );

  const columns: Column<AuditEntry>[] = [
    { key: 'timp', header: 'Data/ora', render: (r) => new Date(r.timp).toLocaleString('ro-RO') },
    { key: 'utilizator', header: 'Utilizator' },
    { key: 'rol', header: 'Rol' },
    {
      key: 'actiune',
      header: 'Actiune',
      render: (r) => <Badge tone={TON_ACTIUNE[r.actiune]}>{r.actiune}</Badge>,
    },
    { key: 'entitate', header: 'Entitate' },
    {
      key: 'entitateId',
      header: 'ID',
      render: (r) => <span className="font-mono text-xs">{r.entitateId.slice(0, 8)}</span>,
    },
    { key: 'detalii', header: 'Detalii', render: (r) => r.detalii || '—' },
  ];

  return (
    <div>
      <PageHeader
        title="Jurnal de audit"
        subtitle="Toate mutatiile (creare/actualizare/stergere) — vizibil doar administratorului"
      />
      <Card className="mb-4 flex flex-wrap items-end gap-4 p-4">
        <Field label="Entitate">
          <Select
            options={[
              { value: '', label: 'Toate' },
              ...entitati.map((e) => ({ value: e, label: e })),
            ]}
            value={entitate}
            onChange={(e) => setEntitate(e.target.value)}
          />
        </Field>
        <Field label="De la data">
          <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
        </Field>
        <Field label="Pana la data">
          <Input type="date" value={pana} onChange={(e) => setPana(e.target.value)} />
        </Field>
      </Card>
      <DataTable
        columns={columns}
        rows={filtrate}
        getRowKey={(r) => r.id}
        empty="Nicio inregistrare in jurnalul de audit."
      />
      <p className="mt-3 text-sm text-fg-muted">{filtrate.length} inregistrari</p>
    </div>
  );
}
