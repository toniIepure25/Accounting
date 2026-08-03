import {
  type Document,
  type DocumentTip,
  type MijlocFix,
  type OperatiuneCasa,
  type Partener,
  type SoldPartener,
  balantaParteneri,
  jurnal,
  registruCasa,
  registruInventar,
} from '@gr/core-domain';
import { Printer } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { type Column, DataTable } from '../components/DataTable.js';
import { Button, Card, PageHeader } from '../components/ui.js';
import { useStoc } from '../hooks/useStoc.js';
import { useData } from '../lib/data-context.js';
import { printHtml } from '../lib/export.js';
import * as fmt from '../lib/format.js';
import { escapeHtml } from '../lib/safe-output.js';

function useReportData() {
  const db = useData();
  const [documente, setDocumente] = useState<Document[]>([]);
  const [parteneri, setParteneri] = useState<Partener[]>([]);
  const [casa, setCasa] = useState<OperatiuneCasa[]>([]);
  useEffect(() => {
    db.documente.list().then(setDocumente);
    db.parteneri.list().then(setParteneri);
    db.operatiuniCasa.list().then(setCasa);
  }, [db]);
  const partenerNume = (id: string | null) => parteneri.find((p) => p.id === id)?.denumire ?? '—';
  return { documente, parteneri, casa, partenerNume };
}

function TotaluriBar({ net, tva, brut }: { net: number; tva: number; brut: number }) {
  return (
    <div className="flex flex-wrap gap-6 border-t border-border p-4 text-sm">
      <span className="text-fg-muted">
        Total net: <b className="text-fg">{fmt.bani(net)}</b>
      </span>
      <span className="text-fg-muted">
        Total TVA: <b className="text-fg">{fmt.bani(tva)}</b>
      </span>
      <span className="text-fg-muted">
        Total: <b className="text-fg">{fmt.lei(brut)}</b>
      </span>
    </div>
  );
}

function JurnalView({
  title,
  subtitle,
  tipuri,
}: { title: string; subtitle: string; tipuri: DocumentTip[] }) {
  const { documente, partenerNume } = useReportData();
  const j = useMemo(() => jurnal(documente, tipuri), [documente, tipuri]);
  const columns: Column<(typeof j.randuri)[number]>[] = [
    { key: 'cod', header: 'Document', render: (r) => <span className="font-mono">{r.cod}</span> },
    { key: 'data', header: 'Data', render: (r) => fmt.data(r.data) },
    { key: 'partener', header: 'Partener', render: (r) => partenerNume(r.partenerId) },
    { key: 'net', header: 'Net', align: 'right', render: (r) => fmt.bani(r.totalNetBani) },
    { key: 'tva', header: 'TVA', align: 'right', render: (r) => fmt.bani(r.totalTvaBani) },
    { key: 'brut', header: 'Total', align: 'right', render: (r) => fmt.bani(r.totalBrutBani) },
  ];
  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} />
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <DataTable
          columns={columns}
          rows={j.randuri}
          getRowKey={(r) => r.cod}
          empty="Niciun document validat."
        />
        <TotaluriBar net={j.total.netBani} tva={j.total.tvaBani} brut={j.total.brutBani} />
      </div>
    </div>
  );
}

export const JurnalIntrariPage = () => (
  <JurnalView
    title="Jurnal de intrari"
    subtitle="Receptii, transferuri, plusuri/minusuri"
    tipuri={['receptie_furnizor', 'receptie_transfer', 'plus_minus']}
  />
);
export const JurnalIesiriPage = () => (
  <JurnalView title="Jurnal de iesiri" subtitle="Bonuri de consum" tipuri={['bon_consum']} />
);
export const JurnalCumparariPage = () => (
  <JurnalView
    title="Jurnal de cumparari"
    subtitle="Facturi de la furnizori"
    tipuri={['factura_cumparare', 'receptie_furnizor']}
  />
);
export const JurnalVanzariPage = () => (
  <JurnalView
    title="Jurnal de vanzari"
    subtitle="Facturi si vanzari cu amanuntul"
    tipuri={['factura_vanzare', 'vanzare_amanunt']}
  />
);

function BalantaParteneriView({
  title,
  subtitle,
  tipuri,
  tipCasa,
}: {
  title: string;
  subtitle: string;
  tipuri: DocumentTip[];
  tipCasa: 'incasare' | 'plata';
}) {
  const { documente, casa, partenerNume } = useReportData();
  const balanta = useMemo(
    () =>
      balantaParteneri(documente, casa, tipuri, tipCasa).filter((b) => b.debitBani || b.creditBani),
    [documente, casa, tipuri, tipCasa],
  );
  const total = balanta.reduce((s, b) => s + b.soldBani, 0);
  const columns: Column<SoldPartener>[] = [
    { key: 'partener', header: 'Partener', render: (b) => partenerNume(b.partenerId) },
    { key: 'debit', header: 'Facturat', align: 'right', render: (b) => fmt.bani(b.debitBani) },
    {
      key: 'credit',
      header: tipCasa === 'incasare' ? 'Incasat' : 'Platit',
      align: 'right',
      render: (b) => fmt.bani(b.creditBani),
    },
    {
      key: 'sold',
      header: 'Sold',
      align: 'right',
      render: (b) => <span className="font-medium">{fmt.bani(b.soldBani)}</span>,
    },
  ];
  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} />
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <DataTable
          columns={columns}
          rows={balanta}
          getRowKey={(b) => b.partenerId}
          empty="Fara solduri."
        />
        <div className="border-t border-border p-4 text-sm text-fg-muted">
          Sold total: <b className="text-fg">{fmt.lei(total)}</b>
        </div>
      </div>
    </div>
  );
}

export const BalantaFurnizoriPage = () => (
  <BalantaParteneriView
    title="Balanta furnizorilor"
    subtitle="Solduri furnizori (facturat - platit)"
    tipuri={['receptie_furnizor', 'factura_cumparare']}
    tipCasa="plata"
  />
);
export const BalantaClientiPage = () => (
  <BalantaParteneriView
    title="Balanta clientilor"
    subtitle="Solduri clienti (facturat - incasat)"
    tipuri={['factura_vanzare', 'vanzare_amanunt']}
    tipCasa="incasare"
  />
);

export function StocuriPage() {
  const { solduri, produsById, gestiuneById, loading } = useStoc();
  const rows = solduri.filter((s) => Math.abs(s.cantitate) > 1e-9);
  const columns = [
    {
      key: 'gestiune',
      header: 'Gestiune',
      render: (s: (typeof rows)[number]) => gestiuneById.get(s.gestiuneId)?.cod ?? '—',
    },
    {
      key: 'produs',
      header: 'Produs',
      render: (s: (typeof rows)[number]) => produsById.get(s.produsId)?.denumire ?? s.produsId,
    },
    {
      key: 'cant',
      header: 'Cantitate',
      align: 'right' as const,
      render: (s: (typeof rows)[number]) => fmt.cant(s.cantitate),
    },
    {
      key: 'pmp',
      header: 'PMP',
      align: 'right' as const,
      render: (s: (typeof rows)[number]) => fmt.bani(s.pmpBani),
    },
    {
      key: 'val',
      header: 'Valoare',
      align: 'right' as const,
      render: (s: (typeof rows)[number]) => (
        <span className="font-medium">{fmt.bani(s.valoareBani)}</span>
      ),
    },
  ];
  const totalVal = rows.reduce((a, s) => a + s.valoareBani, 0);
  return (
    <div>
      <PageHeader
        title="Balanta stocurilor"
        subtitle="Stocuri curente evaluate la pret mediu ponderat (CMP)"
      />
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(s) => `${s.gestiuneId}-${s.produsId}`}
          empty={loading ? 'Se incarca...' : 'Fara stoc.'}
        />
        <div className="border-t border-border p-4 text-sm text-fg-muted">
          Valoare totala stoc: <b className="text-fg">{fmt.lei(totalVal)}</b>
        </div>
      </div>
    </div>
  );
}

export function FiseMagaziePage() {
  const { miscari, produsById, gestiuneById, loading } = useStoc();
  const rows = [...miscari].sort((a, b) => a.data.localeCompare(b.data));
  const columns = [
    { key: 'data', header: 'Data', render: (m: (typeof rows)[number]) => fmt.data(m.data) },
    {
      key: 'doc',
      header: 'Document',
      render: (m: (typeof rows)[number]) => <span className="font-mono">{m.documentCod}</span>,
    },
    {
      key: 'gest',
      header: 'Gestiune',
      render: (m: (typeof rows)[number]) => gestiuneById.get(m.gestiuneId)?.cod ?? '—',
    },
    {
      key: 'prod',
      header: 'Produs',
      render: (m: (typeof rows)[number]) => produsById.get(m.produsId)?.denumire ?? m.produsId,
    },
    {
      key: 'sens',
      header: 'Sens',
      render: (m: (typeof rows)[number]) => (m.cantitate >= 0 ? 'Intrare' : 'Iesire'),
    },
    {
      key: 'cant',
      header: 'Cantitate',
      align: 'right' as const,
      render: (m: (typeof rows)[number]) => fmt.cant(m.cantitate),
    },
    {
      key: 'val',
      header: 'Valoare',
      align: 'right' as const,
      render: (m: (typeof rows)[number]) => fmt.bani(m.valoareBani),
    },
  ];
  return (
    <div>
      <PageHeader
        title="Fise de magazie"
        subtitle="Toate miscarile de stoc generate din documentele validate"
      />
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(m) => m.id}
        empty={loading ? 'Se incarca...' : 'Nicio miscare.'}
      />
    </div>
  );
}

export function RulajePage() {
  const { miscari, produsById } = useStoc();
  const rulaje = useMemo(() => {
    const map = new Map<
      string,
      {
        produsId: string;
        intrariCant: number;
        intrariVal: number;
        iesiriCant: number;
        iesiriVal: number;
      }
    >();
    for (const m of miscari) {
      const r = map.get(m.produsId) ?? {
        produsId: m.produsId,
        intrariCant: 0,
        intrariVal: 0,
        iesiriCant: 0,
        iesiriVal: 0,
      };
      if (m.cantitate >= 0) {
        r.intrariCant += m.cantitate;
        r.intrariVal += m.valoareBani;
      } else {
        r.iesiriCant += -m.cantitate;
        r.iesiriVal += -m.valoareBani;
      }
      map.set(m.produsId, r);
    }
    return [...map.values()];
  }, [miscari]);
  const columns = [
    {
      key: 'prod',
      header: 'Produs',
      render: (r: (typeof rulaje)[number]) => produsById.get(r.produsId)?.denumire ?? r.produsId,
    },
    {
      key: 'ic',
      header: 'Intrari cant.',
      align: 'right' as const,
      render: (r: (typeof rulaje)[number]) => fmt.cant(r.intrariCant),
    },
    {
      key: 'iv',
      header: 'Intrari val.',
      align: 'right' as const,
      render: (r: (typeof rulaje)[number]) => fmt.bani(r.intrariVal),
    },
    {
      key: 'ec',
      header: 'Iesiri cant.',
      align: 'right' as const,
      render: (r: (typeof rulaje)[number]) => fmt.cant(r.iesiriCant),
    },
    {
      key: 'ev',
      header: 'Iesiri val.',
      align: 'right' as const,
      render: (r: (typeof rulaje)[number]) => fmt.bani(r.iesiriVal),
    },
  ];
  return (
    <div>
      <PageHeader title="Rulaje" subtitle="Intrari si iesiri cumulate pe produs" />
      <DataTable
        columns={columns}
        rows={rulaje}
        getRowKey={(r) => r.produsId}
        empty="Fara rulaje."
      />
    </div>
  );
}

export function ReevaluareStocPage() {
  const { solduri, produsById, gestiuneById } = useStoc();
  const rows = solduri.filter((s) => Math.abs(s.cantitate) > 1e-9);
  const columns = [
    {
      key: 'gest',
      header: 'Gestiune',
      render: (s: (typeof rows)[number]) => gestiuneById.get(s.gestiuneId)?.cod ?? '—',
    },
    {
      key: 'prod',
      header: 'Produs',
      render: (s: (typeof rows)[number]) => produsById.get(s.produsId)?.denumire ?? s.produsId,
    },
    {
      key: 'cant',
      header: 'Cantitate',
      align: 'right' as const,
      render: (s: (typeof rows)[number]) => fmt.cant(s.cantitate),
    },
    {
      key: 'pmp',
      header: 'PMP actual',
      align: 'right' as const,
      render: (s: (typeof rows)[number]) => fmt.bani(s.pmpBani),
    },
    {
      key: 'val',
      header: 'Valoare reevaluata',
      align: 'right' as const,
      render: (s: (typeof rows)[number]) => fmt.bani(s.valoareBani),
    },
  ];
  return (
    <div>
      <PageHeader
        title="Reevaluare stoc"
        subtitle="Verificare valoare stoc la pretul mediu ponderat curent"
      />
      <Card className="mb-4 p-4 text-sm text-fg-muted">
        Reevaluarea recalculeaza valoarea stocului la PMP-ul curent rezultat din toate miscarile
        validate.
      </Card>
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(s) => `${s.gestiuneId}-${s.produsId}`}
        empty="Fara stoc."
      />
    </div>
  );
}

function inventarHtml(r: ReturnType<typeof registruInventar>): string {
  const money = (b: number) =>
    (b / 100).toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const categorii = [...new Set(r.randuri.map((x) => x.categorie))];
  const sectiuni = categorii
    .map((cat) => {
      const randuri = r.randuri
        .filter((x) => x.categorie === cat)
        .map(
          (x) =>
            `<tr><td>${escapeHtml(x.denumire)}</td><td class="r">${money(x.valoareBani)}</td></tr>`,
        )
        .join('');
      const subtotal = r.randuri
        .filter((x) => x.categorie === cat)
        .reduce((a, x) => a + x.valoareBani, 0);
      return `<h2>${escapeHtml(cat)}</h2><table><tbody>${randuri}</tbody><tfoot><tr class="tot"><td>Subtotal</td><td class="r">${money(subtotal)}</td></tr></tfoot></table>`;
    })
    .join('');
  return `<!doctype html><html lang="ro"><head><meta charset="utf-8"><title>Registru-inventar</title><style>
    body{font-family:Arial,sans-serif;color:#111;margin:24px;font-size:12px}
    h1{font-size:18px;margin:0 0 4px} .sub{color:#555;margin-bottom:16px}
    h2{font-size:13px;margin:20px 0 4px;border-bottom:1px solid #ccc}
    table{width:100%;border-collapse:collapse}
    th,td{border:1px solid #ddd;padding:4px 6px;text-align:left}
    .r{text-align:right}.tot{font-weight:bold}
    .total-general{margin-top:24px;font-size:15px;font-weight:bold;text-align:right}
  </style></head><body>
    <h1>REGISTRU-INVENTAR</h1><div class="sub">La data ${escapeHtml(r.data)}</div>
    ${sectiuni}
    <div class="total-general">TOTAL GENERAL: ${money(r.totalGeneralBani)} lei</div>
    </body></html>`;
}

export function RegistruInventarPage() {
  const { documente, casa, partenerNume } = useReportData();
  const { solduri, produsById } = useStoc();
  const [mijloaceFixe, setMijloaceFixe] = useState<MijlocFix[]>([]);
  const db = useData();
  useEffect(() => {
    db.mijloaceFixe.list().then(setMijloaceFixe);
  }, [db]);

  const inventar = useMemo(() => {
    const stocuri = solduri
      .filter((s) => Math.abs(s.cantitate) > 1e-9)
      .map((s) => ({
        denumire: produsById.get(s.produsId)?.denumire ?? s.produsId,
        valoareBani: s.valoareBani,
      }));

    const mf = mijloaceFixe
      .filter((m) => m.activ && !m.casat)
      .map((m) => ({
        denumire: `${m.cod} · ${m.denumire}`,
        valoareBani: Math.max(0, m.valoareIntrareBani - m.amortizareCumulataBani),
      }));

    const creante = balantaParteneri(
      documente,
      casa,
      ['factura_vanzare', 'vanzare_amanunt'],
      'incasare',
    )
      .filter((b) => b.soldBani > 0)
      .map((b) => ({ denumire: partenerNume(b.partenerId), valoareBani: b.soldBani }));

    const datorii = balantaParteneri(
      documente,
      casa,
      ['receptie_furnizor', 'factura_cumparare'],
      'plata',
    )
      .filter((b) => b.soldBani > 0)
      .map((b) => ({ denumire: partenerNume(b.partenerId), valoareBani: -b.soldBani }));

    const disponibil = registruCasa(casa).soldFinalBani;

    return registruInventar(new Date().toISOString().slice(0, 10), [
      { categorie: 'Stocuri (materii prime, marfuri)', randuri: stocuri },
      { categorie: 'Mijloace fixe (valoare ramasa)', randuri: mf },
      { categorie: 'Creante (clienti)', randuri: creante },
      { categorie: 'Datorii (furnizori) — se scad', randuri: datorii },
      {
        categorie: 'Disponibilitati banesti (casa)',
        randuri: [{ denumire: 'Sold casa', valoareBani: disponibil }],
      },
    ]);
  }, [solduri, produsById, mijloaceFixe, documente, casa, partenerNume]);

  const categorii = [...new Set(inventar.randuri.map((r) => r.categorie))];

  return (
    <div>
      <PageHeader
        title="Registru-inventar"
        subtitle="Toate elementele patrimoniale evaluate la data curenta (stocuri, mijloace fixe, creante, datorii, disponibil)"
        actions={
          <Button variant="secondary" onClick={() => printHtml(inventarHtml(inventar))}>
            <Printer className="h-4 w-4" /> Printeaza / PDF
          </Button>
        }
      />
      <div className="space-y-6">
        {categorii.map((cat) => {
          const randuri = inventar.randuri.filter((r) => r.categorie === cat);
          const subtotal = randuri.reduce((a, r) => a + r.valoareBani, 0);
          return (
            <div key={cat}>
              <h3 className="mb-2 font-semibold text-fg">{cat}</h3>
              <div className="overflow-hidden rounded-xl border border-border bg-surface">
                <table className="w-full text-sm">
                  <tbody>
                    {randuri.map((r, i) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: randuri fara id unic propriu, ordinea e stabila in acest render
                      <tr key={i} className="border-b border-border/60 last:border-0">
                        <td className="px-3 py-2 text-fg">{r.denumire}</td>
                        <td className="px-3 py-2 text-right text-fg">{fmt.bani(r.valoareBani)}</td>
                      </tr>
                    ))}
                    {randuri.length === 0 && (
                      <tr>
                        <td className="px-3 py-4 text-center text-fg-muted" colSpan={2}>
                          —
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <div className="border-t border-border p-2.5 text-right text-sm font-medium text-fg">
                  Subtotal: {fmt.bani(subtotal)}
                </div>
              </div>
            </div>
          );
        })}
        <div className="rounded-xl border border-border bg-primary/10 p-4 text-right text-lg font-bold text-primary">
          TOTAL GENERAL: {fmt.lei(inventar.totalGeneralBani)}
        </div>
      </div>
    </div>
  );
}
