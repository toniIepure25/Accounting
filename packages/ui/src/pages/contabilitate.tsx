import { type NotaContabila, balantaVerificare, fisaCont, numeCont } from '@gr/core-domain';
import { Printer } from 'lucide-react';
import { useMemo, useState } from 'react';
import { type Column, DataTable } from '../components/DataTable.js';
import { Field, Select } from '../components/controls.js';
import { Badge, Button, Card, PageHeader } from '../components/ui.js';
import { useContabilitate } from '../hooks/useContabilitate.js';
import { printHtml } from '../lib/export.js';
import * as fmt from '../lib/format.js';
import { escapeHtml } from '../lib/safe-output.js';

const STIL_REGISTRU = `
  body{font-family:Arial,sans-serif;color:#111;margin:24px;font-size:12px}
  h1{font-size:18px;margin:0 0 4px} .sub{color:#555;margin-bottom:16px}
  table{width:100%;border-collapse:collapse;margin-top:8px}
  th,td{border:1px solid #ddd;padding:4px 6px;text-align:left}
  th{background:#f3f4f6}.r{text-align:right}
  .acct{margin-top:28px;page-break-inside:avoid}
  .acct h2{font-size:14px;border-bottom:2px solid #111;padding-bottom:3px}
  .tot{font-weight:bold}
`;

function registruJurnalHtml(note: NotaContabila[]): string {
  const money = (b: number) =>
    (b / 100).toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  let nr = 0;
  let totalD = 0;
  let totalC = 0;
  const randuri = note
    .flatMap((n) => n.postari.map((p) => ({ n, p })))
    .map(({ n, p }) => {
      nr++;
      totalD += p.debitBani;
      totalC += p.creditBani;
      return `<tr><td>${nr}</td><td>${escapeHtml(n.data)}</td><td>${escapeHtml(n.documentCod)}</td><td>${escapeHtml(n.explicatie)}</td><td>${escapeHtml(p.cont)}</td><td class="r">${p.debitBani ? money(p.debitBani) : ''}</td><td class="r">${p.creditBani ? money(p.creditBani) : ''}</td></tr>`;
    })
    .join('');
  return `<!doctype html><html lang="ro"><head><meta charset="utf-8"><title>Registru-jurnal</title><style>${STIL_REGISTRU}</style></head><body>
    <h1>REGISTRU-JURNAL</h1><div class="sub">Generat la ${new Date().toISOString().slice(0, 10)}</div>
    <table><thead><tr><th>Nr.</th><th>Data</th><th>Document</th><th>Explicatie</th><th>Cont</th><th class="r">Debit</th><th class="r">Credit</th></tr></thead>
    <tbody>${randuri}</tbody>
    <tfoot><tr class="tot"><td colspan="5">TOTAL</td><td class="r">${money(totalD)}</td><td class="r">${money(totalC)}</td></tr></tfoot></table>
    </body></html>`;
}

function carteaMareHtml(note: NotaContabila[]): string {
  const money = (b: number) =>
    (b / 100).toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const balanta = balantaVerificare(note);
  const sectiuni = balanta
    .map((r) => {
      const randuri = fisaCont(note, r.cont)
        .map(
          (f) =>
            `<tr><td>${escapeHtml(f.data)}</td><td>${escapeHtml(f.documentCod)}</td><td>${escapeHtml(f.explicatie)}</td><td class="r">${f.debitBani ? money(f.debitBani) : ''}</td><td class="r">${f.creditBani ? money(f.creditBani) : ''}</td><td class="r">${money(f.soldBani)}</td></tr>`,
        )
        .join('');
      return `<div class="acct"><h2>${escapeHtml(r.cont)} — ${escapeHtml(r.nume)}</h2>
        <table><thead><tr><th>Data</th><th>Document</th><th>Explicatie</th><th class="r">Debit</th><th class="r">Credit</th><th class="r">Sold</th></tr></thead>
        <tbody>${randuri}</tbody></table></div>`;
    })
    .join('');
  return `<!doctype html><html lang="ro"><head><meta charset="utf-8"><title>Cartea mare</title><style>${STIL_REGISTRU}</style></head><body>
    <h1>CARTEA MARE</h1><div class="sub">Generat la ${new Date().toISOString().slice(0, 10)}</div>
    ${sectiuni}
    </body></html>`;
}

export function RegistruJurnalPage() {
  const { note } = useContabilitate();
  const randuri = useMemo(
    () =>
      note.flatMap((n, ni) =>
        n.postari.map((p, pi) => ({
          key: `${ni}-${pi}`,
          data: n.data,
          doc: n.documentCod,
          explicatie: n.explicatie,
          cont: p.cont,
          debit: p.debitBani,
          credit: p.creditBani,
        })),
      ),
    [note],
  );
  const totalD = randuri.reduce((s, r) => s + r.debit, 0);
  const totalC = randuri.reduce((s, r) => s + r.credit, 0);

  const columns: Column<(typeof randuri)[number]>[] = [
    { key: 'data', header: 'Data', render: (r) => fmt.data(r.data) },
    { key: 'doc', header: 'Document', render: (r) => <span className="font-mono">{r.doc}</span> },
    {
      key: 'cont',
      header: 'Cont',
      render: (r) => <span className="font-mono font-medium">{r.cont}</span>,
    },
    { key: 'explicatie', header: 'Explicatie' },
    {
      key: 'debit',
      header: 'Debit',
      align: 'right',
      render: (r) => (r.debit ? fmt.bani(r.debit) : ''),
    },
    {
      key: 'credit',
      header: 'Credit',
      align: 'right',
      render: (r) => (r.credit ? fmt.bani(r.credit) : ''),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Registru-jurnal"
        subtitle="Note contabile generate automat din documente (partida dubla)"
        actions={
          <Button variant="secondary" onClick={() => printHtml(registruJurnalHtml(note))}>
            <Printer className="h-4 w-4" /> Printeaza / PDF
          </Button>
        }
      />
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <DataTable
          columns={columns}
          rows={randuri}
          getRowKey={(r) => r.key}
          empty="Nicio inregistrare contabila."
        />
        <div className="flex justify-end gap-8 border-t border-border p-4 text-sm">
          <span className="text-fg-muted">
            Total debit: <b className="text-fg">{fmt.bani(totalD)}</b>
          </span>
          <span className="text-fg-muted">
            Total credit: <b className="text-fg">{fmt.bani(totalC)}</b>
          </span>
          <Badge tone={totalD === totalC ? 'success' : 'danger'}>
            {totalD === totalC ? 'Echilibrat' : 'Dezechilibru'}
          </Badge>
        </div>
      </div>
    </div>
  );
}

export function CarteaMarePage() {
  const { note } = useContabilitate();
  const balanta = useMemo(() => balantaVerificare(note), [note]);

  return (
    <div>
      <PageHeader
        title="Cartea mare"
        subtitle="Fisa fiecarui cont folosit, cu sold rulant"
        actions={
          <Button variant="secondary" onClick={() => printHtml(carteaMareHtml(note))}>
            <Printer className="h-4 w-4" /> Printeaza / PDF
          </Button>
        }
      />
      <div className="space-y-6">
        {balanta.map((r) => {
          const randuri = fisaCont(note, r.cont);
          const columns: Column<(typeof randuri)[number]>[] = [
            { key: 'data', header: 'Data', render: (x) => fmt.data(x.data) },
            {
              key: 'doc',
              header: 'Document',
              render: (x) => <span className="font-mono">{x.documentCod}</span>,
            },
            { key: 'explicatie', header: 'Explicatie' },
            {
              key: 'debit',
              header: 'Debit',
              align: 'right',
              render: (x) => (x.debitBani ? fmt.bani(x.debitBani) : ''),
            },
            {
              key: 'credit',
              header: 'Credit',
              align: 'right',
              render: (x) => (x.creditBani ? fmt.bani(x.creditBani) : ''),
            },
            {
              key: 'sold',
              header: 'Sold',
              align: 'right',
              render: (x) => <span className="font-medium">{fmt.bani(x.soldBani)}</span>,
            },
          ];
          return (
            <div key={r.cont}>
              <h3 className="mb-2 font-mono font-semibold text-fg">
                {r.cont} — {r.nume}
              </h3>
              <DataTable
                columns={columns}
                rows={randuri}
                getRowKey={(x) => `${x.data}-${x.documentCod}-${x.soldBani}`}
                empty="Fara miscari."
              />
            </div>
          );
        })}
        {balanta.length === 0 && <p className="text-sm text-fg-muted">Fara conturi cu miscari.</p>}
      </div>
    </div>
  );
}

export function BalantaVerificarePage() {
  const { note } = useContabilitate();
  const balanta = useMemo(() => balantaVerificare(note), [note]);
  const t = balanta.reduce(
    (acc, r) => ({
      d: acc.d + r.totalDebitBani,
      c: acc.c + r.totalCreditBani,
      sd: acc.sd + r.soldDebitorBani,
      sc: acc.sc + r.soldCreditorBani,
    }),
    { d: 0, c: 0, sd: 0, sc: 0 },
  );

  const columns: Column<(typeof balanta)[number]>[] = [
    {
      key: 'cont',
      header: 'Cont',
      render: (r) => <span className="font-mono font-medium">{r.cont}</span>,
    },
    { key: 'nume', header: 'Denumire' },
    { key: 'td', header: 'Rulaj debit', align: 'right', render: (r) => fmt.bani(r.totalDebitBani) },
    {
      key: 'tc',
      header: 'Rulaj credit',
      align: 'right',
      render: (r) => fmt.bani(r.totalCreditBani),
    },
    {
      key: 'sd',
      header: 'Sold debitor',
      align: 'right',
      render: (r) => (r.soldDebitorBani ? fmt.bani(r.soldDebitorBani) : ''),
    },
    {
      key: 'sc',
      header: 'Sold creditor',
      align: 'right',
      render: (r) => (r.soldCreditorBani ? fmt.bani(r.soldCreditorBani) : ''),
    },
  ];

  return (
    <div>
      <PageHeader title="Balanta de verificare" subtitle="Rulaje si solduri pe conturi" />
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <DataTable
          columns={columns}
          rows={balanta}
          getRowKey={(r) => r.cont}
          empty="Fara inregistrari."
        />
        <div className="flex flex-wrap justify-end gap-6 border-t border-border p-4 text-sm text-fg-muted">
          <span>
            Total rulaje D/C: <b className="text-fg">{fmt.bani(t.d)}</b> /{' '}
            <b className="text-fg">{fmt.bani(t.c)}</b>
          </span>
          <span>
            Total solduri D/C: <b className="text-fg">{fmt.bani(t.sd)}</b> /{' '}
            <b className="text-fg">{fmt.bani(t.sc)}</b>
          </span>
          <Badge tone={t.d === t.c && t.sd === t.sc ? 'success' : 'danger'}>
            {t.d === t.c && t.sd === t.sc ? 'Balanta echilibrata' : 'Dezechilibru'}
          </Badge>
        </div>
      </div>
    </div>
  );
}

export function FisaContPage() {
  const { note } = useContabilitate();
  const balanta = useMemo(() => balantaVerificare(note), [note]);
  const [cont, setCont] = useState('');
  const conturi = balanta.map((r) => ({ value: r.cont, label: `${r.cont} · ${r.nume}` }));
  const rows = useMemo(() => (cont ? fisaCont(note, cont) : []), [note, cont]);

  const columns: Column<(typeof rows)[number]>[] = [
    { key: 'data', header: 'Data', render: (r) => fmt.data(r.data) },
    {
      key: 'doc',
      header: 'Document',
      render: (r) => <span className="font-mono">{r.documentCod}</span>,
    },
    { key: 'explicatie', header: 'Explicatie' },
    {
      key: 'debit',
      header: 'Debit',
      align: 'right',
      render: (r) => (r.debitBani ? fmt.bani(r.debitBani) : ''),
    },
    {
      key: 'credit',
      header: 'Credit',
      align: 'right',
      render: (r) => (r.creditBani ? fmt.bani(r.creditBani) : ''),
    },
    {
      key: 'sold',
      header: 'Sold',
      align: 'right',
      render: (r) => <span className="font-medium">{fmt.bani(r.soldBani)}</span>,
    },
  ];

  return (
    <div>
      <PageHeader title="Fisa de cont" subtitle="Miscarile si soldul rulant al unui cont" />
      <Card className="mb-4 max-w-sm p-4">
        <Field label="Cont">
          <Select
            options={[{ value: '', label: '— selecteaza cont —' }, ...conturi]}
            value={cont}
            onChange={(e) => setCont(e.target.value)}
          />
        </Field>
      </Card>
      {cont && (
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(_r) => `${_r.documentCod}-${_r.soldBani}-${_r.debitBani}-${_r.creditBani}`}
          empty={`Cont ${cont} (${numeCont(cont)}) — fara miscari.`}
        />
      )}
    </div>
  );
}
