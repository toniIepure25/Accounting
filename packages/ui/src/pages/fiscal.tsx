import type { Document, DocumentLinie, Firma, Partener, Produs } from '@gr/core-domain';
import {
  type EFacturaInput,
  type EFacturaParte,
  cuiValid,
  decontTVADetaliat,
  genereazaEFacturaXML,
  genereazaSaftXML,
  sumarD390,
  sumarD394Achizitii,
  sumarD394Livrari,
} from '@gr/fiscal-ro';
import { Download, FileCode2, Printer } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { type Column, DataTable } from '../components/DataTable.js';
import { Field, Modal, Select } from '../components/controls.js';
import { Badge, Button, Card, Input, PageHeader } from '../components/ui.js';
import { useCollection } from '../hooks/useCollection.js';
import { useData } from '../lib/data-context.js';
import { downloadText, printHtml } from '../lib/export.js';
import { useFirma } from '../lib/firma-context.js';
import * as fmt from '../lib/format.js';
import { antetFirmaHtml } from '../lib/print-branding.js';
import { csvField, escapeHtml } from '../lib/safe-output.js';

/**
 * Datele vanzatorului pentru e-Factura/factura tiparita/SAF-T: firma curenta
 * (multi-firma), nu una hardcodata — altfel o factura emisa sub o a doua
 * firma ar aparea gresit cu antetul primei firme configurate.
 */
function firmaCaVanzator(firma: Firma | null): EFacturaParte {
  return {
    nume: firma?.denumire || 'Firma nesetata',
    cui: firma?.cui || null,
    adresa: firma?.adresa ?? '',
    oras: firma?.localitate ?? '',
    judet: firma?.judet ?? '',
  };
}

function facturaHtml(
  doc: Document,
  linii: DocumentLinie[],
  vanzator: EFacturaParte,
  firma: Firma | null,
  buyer?: Partener,
): string {
  const money = (b: number) =>
    (b / 100).toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const randuri = linii
    .map(
      (l, i) => `<tr>
        <td>${i + 1}</td><td>${escapeHtml(l.denumire)}</td><td class="r">${escapeHtml(l.cantitate)} ${escapeHtml(l.unitateMasura)}</td>
        <td class="r">${money(l.pretUnitarBani)}</td><td class="r">${l.cotaTvaProcent}%</td>
        <td class="r">${money(l.netBani)}</td><td class="r">${money(l.brutBani)}</td></tr>`,
    )
    .join('');
  return `<!doctype html><html lang="ro"><head><meta charset="utf-8"><title>${escapeHtml(doc.cod)}</title>
  <style>
    body{font-family:Arial,sans-serif;color:#111;margin:32px;font-size:13px}
    h1{font-size:20px;margin:0 0 4px}
    .row{display:flex;justify-content:space-between;gap:24px;margin-bottom:24px}
    .box{border:1px solid #ccc;border-radius:8px;padding:12px;flex:1}
    table{width:100%;border-collapse:collapse;margin-top:12px}
    th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}
    th{background:#f3f4f6}.r{text-align:right}
    .tot{margin-top:16px;width:280px;margin-left:auto}
    .tot div{display:flex;justify-content:space-between;padding:3px 0}
    .tot .g{font-weight:bold;border-top:2px solid #111;padding-top:6px}
  </style></head><body>
  ${antetFirmaHtml(firma)}
  <h1>FACTURA</h1><div>Seria/Numar: <b>${escapeHtml(doc.cod)}</b> · Data: ${escapeHtml(doc.data)}${doc.scadenta ? ` · Scadenta: ${escapeHtml(doc.scadenta)}` : ''}</div>
  <div class="row" style="margin-top:16px">
    <div class="box"><b>Furnizor</b><br>${escapeHtml(vanzator.nume)}<br>CUI: ${escapeHtml(vanzator.cui ?? '-')}<br>${escapeHtml(vanzator.adresa)}, ${escapeHtml(vanzator.oras)}, jud. ${escapeHtml(vanzator.judet)}</div>
    <div class="box"><b>Client</b><br>${escapeHtml(buyer?.denumire ?? '-')}<br>CUI: ${escapeHtml(buyer?.cui ?? '-')}<br>${escapeHtml(buyer?.adresa ?? '')} ${escapeHtml(buyer?.localitate ?? '')}</div>
  </div>
  <table><thead><tr><th>#</th><th>Denumire</th><th class="r">Cant.</th><th class="r">Pret</th><th class="r">TVA</th><th class="r">Valoare</th><th class="r">Total</th></tr></thead>
  <tbody>${randuri}</tbody></table>
  <div class="tot">
    <div><span>Total fara TVA</span><span>${money(doc.totalNetBani)} lei</span></div>
    <div><span>TVA</span><span>${money(doc.totalTvaBani)} lei</span></div>
    <div class="g"><span>Total de plata</span><span>${money(doc.totalBrutBani)} lei</span></div>
  </div></body></html>`;
}

export function EFacturaPage() {
  const db = useData();
  const { rows } = useCollection(db.documente);
  const { firmaCurenta } = useFirma();
  const vanzator = useMemo(() => firmaCaVanzator(firmaCurenta), [firmaCurenta]);
  const [parteneri, setParteneri] = useState<Partener[]>([]);
  const [linii, setLinii] = useState<DocumentLinie[]>([]);
  useEffect(() => {
    db.parteneri.list().then(setParteneri);
    db.documenteLinii.list().then(setLinii);
  }, [db]);

  const facturi = rows.filter((d) => d.tip === 'factura_vanzare');
  const buyer = (id: string | null) => parteneri.find((p) => p.id === id);
  const liniiDoc = (id: string) => linii.filter((l) => l.documentId === id);

  const [xml, setXml] = useState<{ cod: string; text: string } | null>(null);

  const genereaza = (doc: Document) => {
    const b = buyer(doc.partenerId);
    const input: EFacturaInput = {
      serieNumar: doc.cod,
      dataEmitere: doc.data,
      scadenta: doc.scadenta,
      vanzator,
      cumparator: {
        nume: b?.denumire ?? 'Client',
        cui: b?.cui ?? null,
        cnp: b?.cnp ?? null,
        adresa: b?.adresa ?? '',
        oras: b?.localitate ?? '',
        judet: b?.judet ?? '',
      },
      linii: liniiDoc(doc.id).map((l) => ({
        denumire: l.denumire,
        cantitate: l.cantitate,
        unitateMasura: l.unitateMasura,
        pretUnitarBani: l.pretUnitarBani,
        cotaTvaProcent: l.cotaTvaProcent,
        netBani: l.netBani,
        tvaBani: l.tvaBani,
      })),
      totalNetBani: doc.totalNetBani,
      totalTvaBani: doc.totalTvaBani,
      totalBrutBani: doc.totalBrutBani,
    };
    setXml({ cod: doc.cod, text: genereazaEFacturaXML(input) });
  };

  const columns: Column<Document>[] = [
    { key: 'cod', header: 'Factura', render: (d) => <span className="font-mono">{d.cod}</span> },
    { key: 'data', header: 'Data', render: (d) => fmt.data(d.data) },
    { key: 'client', header: 'Client', render: (d) => buyer(d.partenerId)?.denumire ?? '—' },
    {
      key: 'cui',
      header: 'CUI',
      render: (d) => {
        const c = buyer(d.partenerId)?.cui;
        if (!c) return '—';
        return cuiValid(c) ? (
          <Badge tone="success">{c}</Badge>
        ) : (
          <Badge tone="danger">{c} (invalid)</Badge>
        );
      },
    },
    { key: 'total', header: 'Total', align: 'right', render: (d) => fmt.lei(d.totalBrutBani) },
    {
      key: 'stare',
      header: 'Stare',
      render: (d) => <Badge tone={d.stare === 'validat' ? 'success' : 'warning'}>{d.stare}</Badge>,
    },
  ];

  return (
    <div>
      <PageHeader
        title="e-Factura (ANAF / SPV)"
        subtitle="Generare factura electronica XML (UBL 2.1 / CIUS-RO)"
      />
      <DataTable
        columns={columns}
        rows={facturi}
        getRowKey={(d) => d.id}
        empty="Nicio factura de vanzare. Creeaza una in „Vanzari facturate”."
        actions={(d) => (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => genereaza(d)}
              title="Genereaza e-Factura"
            >
              <FileCode2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                printHtml(
                  facturaHtml(d, liniiDoc(d.id), vanzator, firmaCurenta, buyer(d.partenerId)),
                )
              }
              title="Printeaza / PDF"
            >
              <Printer className="h-4 w-4" />
            </Button>
          </div>
        )}
      />

      <Modal
        open={!!xml}
        onClose={() => setXml(null)}
        wide
        title={`e-Factura ${xml?.cod ?? ''}`}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => navigator.clipboard?.writeText(xml?.text ?? '')}
            >
              Copiaza
            </Button>
            <Button onClick={() => xml && downloadText(`${xml.cod}.xml`, xml.text)}>
              <Download className="h-4 w-4" /> Descarca XML
            </Button>
          </>
        }
      >
        <pre className="max-h-[55vh] overflow-auto rounded-lg bg-muted/50 p-3 text-xs text-fg">
          {xml?.text}
        </pre>
      </Modal>
    </div>
  );
}

function d300Html(d: ReturnType<typeof decontTVADetaliat>, de: string, pana: string): string {
  const money = (b: number) =>
    (b / 100).toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const tabelCota = (randuri: typeof d.colectataPeCota) =>
    randuri
      .map(
        (r) =>
          `<tr><td>${r.cotaProcent}%</td><td class="r">${money(r.bazaBani)}</td><td class="r">${money(r.tvaBani)}</td></tr>`,
      )
      .join('');
  return `<!doctype html><html lang="ro"><head><meta charset="utf-8"><title>Decont TVA (D300)</title><style>
    body{font-family:Arial,sans-serif;color:#111;margin:24px;font-size:13px}
    h1{font-size:18px;margin:0 0 4px} .sub{color:#555;margin-bottom:16px}
    h2{font-size:14px;margin:20px 0 6px}
    table{width:100%;border-collapse:collapse} th,td{border:1px solid #ddd;padding:5px 8px;text-align:left}
    th{background:#f3f4f6}.r{text-align:right}
    .kpi{display:flex;gap:16px;margin-top:16px} .kpi div{border:1px solid #ddd;border-radius:6px;padding:10px 16px;flex:1}
  </style></head><body>
    <h1>DECONT DE TVA — declaratie de lucru (D300)</h1>
    <div class="sub">Perioada: ${escapeHtml(de) || '(inceput)'} — ${escapeHtml(pana) || '(sfarsit)'}</div>
    <div class="kpi">
      <div>TVA colectata<br><b>${money(d.tvaColectataBani)} lei</b></div>
      <div>TVA deductibila<br><b>${money(d.tvaDeductibilaBani)} lei</b></div>
      <div>De plata<br><b>${money(d.dePlataBani)} lei</b></div>
      <div>De recuperat<br><b>${money(d.deRecuperatBani)} lei</b></div>
    </div>
    <h2>TVA colectata pe cota</h2>
    <table><thead><tr><th>Cota</th><th class="r">Baza</th><th class="r">TVA</th></tr></thead><tbody>${tabelCota(d.colectataPeCota)}</tbody></table>
    <h2>TVA deductibila pe cota</h2>
    <table><thead><tr><th>Cota</th><th class="r">Baza</th><th class="r">TVA</th></tr></thead><tbody>${tabelCota(d.deductibilaPeCota)}</tbody></table>
    <p style="margin-top:20px;color:#666">Declaratie de lucru — formatul oficial de depunere (declaratia unica ANAF) se confirma la depunere.</p>
    </body></html>`;
}

export function DecontTvaPage() {
  const db = useData();
  const { rows } = useCollection(db.documente);
  const [linii, setLinii] = useState<DocumentLinie[]>([]);
  const [de, setDe] = useState('');
  const [pana, setPana] = useState('');
  useEffect(() => {
    db.documenteLinii.list().then(setLinii);
  }, [db]);
  const d = useMemo(
    () => decontTVADetaliat(rows, linii, { de: de || undefined, pana: pana || undefined }),
    [rows, linii, de, pana],
  );

  return (
    <div>
      <PageHeader
        title="Decont TVA (D300)"
        subtitle="TVA colectata vs. deductibila, defalcata pe cote, din documentele validate"
        actions={
          <Button variant="secondary" onClick={() => printHtml(d300Html(d, de, pana))}>
            <Printer className="h-4 w-4" /> Printeaza / PDF
          </Button>
        }
      />
      <Card className="mb-6 flex flex-wrap items-end gap-4 p-4">
        <Field label="De la data">
          <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
        </Field>
        <Field label="Pana la data">
          <Input type="date" value={pana} onChange={(e) => setPana(e.target.value)} />
        </Field>
      </Card>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5">
          <div className="text-sm text-fg-muted">TVA colectata</div>
          <div className="mt-1 text-2xl font-semibold text-fg">{fmt.lei(d.tvaColectataBani)}</div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-fg-muted">TVA deductibila</div>
          <div className="mt-1 text-2xl font-semibold text-fg">{fmt.lei(d.tvaDeductibilaBani)}</div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-fg-muted">TVA de plata</div>
          <div className="mt-1 text-2xl font-semibold text-danger">{fmt.lei(d.dePlataBani)}</div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-fg-muted">TVA de recuperat</div>
          <div className="mt-1 text-2xl font-semibold text-success">
            {fmt.lei(d.deRecuperatBani)}
          </div>
        </Card>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-3 font-semibold text-fg">TVA colectata pe cota</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-fg-muted">
                <th className="py-1.5">Cota</th>
                <th className="py-1.5 text-right">Baza</th>
                <th className="py-1.5 text-right">TVA</th>
              </tr>
            </thead>
            <tbody>
              {d.colectataPeCota.map((r) => (
                <tr key={r.cotaProcent} className="border-b border-border/60 last:border-0">
                  <td className="py-1.5 text-fg">{r.cotaProcent}%</td>
                  <td className="py-1.5 text-right text-fg">{fmt.bani(r.bazaBani)}</td>
                  <td className="py-1.5 text-right text-fg">{fmt.bani(r.tvaBani)}</td>
                </tr>
              ))}
              {d.colectataPeCota.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-3 text-center text-fg-muted">
                    —
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
        <Card className="p-5">
          <h3 className="mb-3 font-semibold text-fg">TVA deductibila pe cota</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-fg-muted">
                <th className="py-1.5">Cota</th>
                <th className="py-1.5 text-right">Baza</th>
                <th className="py-1.5 text-right">TVA</th>
              </tr>
            </thead>
            <tbody>
              {d.deductibilaPeCota.map((r) => (
                <tr key={r.cotaProcent} className="border-b border-border/60 last:border-0">
                  <td className="py-1.5 text-fg">{r.cotaProcent}%</td>
                  <td className="py-1.5 text-right text-fg">{fmt.bani(r.bazaBani)}</td>
                  <td className="py-1.5 text-right text-fg">{fmt.bani(r.tvaBani)}</td>
                </tr>
              ))}
              {d.deductibilaPeCota.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-3 text-center text-fg-muted">
                    —
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}

export function D394Page() {
  const db = useData();
  const { rows } = useCollection(db.documente);
  const [parteneri, setParteneri] = useState<Partener[]>([]);
  const [de, setDe] = useState('');
  const [pana, setPana] = useState('');
  useEffect(() => {
    db.parteneri.list().then(setParteneri);
  }, [db]);

  const livrari = useMemo(
    () => sumarD394Livrari(rows, parteneri, { de: de || undefined, pana: pana || undefined }),
    [rows, parteneri, de, pana],
  );
  const achizitii = useMemo(
    () => sumarD394Achizitii(rows, parteneri, { de: de || undefined, pana: pana || undefined }),
    [rows, parteneri, de, pana],
  );

  const columns: Column<(typeof livrari)[number]>[] = [
    { key: 'denumire', header: 'Partener' },
    { key: 'cui', header: 'CUI', render: (r) => r.cui ?? '—' },
    { key: 'nr', header: 'Nr. documente', align: 'right', render: (r) => String(r.nrDocumente) },
    { key: 'baza', header: 'Baza', align: 'right', render: (r) => fmt.bani(r.bazaBani) },
    { key: 'tva', header: 'TVA', align: 'right', render: (r) => fmt.bani(r.tvaBani) },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      render: (r) => <span className="font-medium">{fmt.bani(r.totalBani)}</span>,
    },
  ];

  const exportaCsv = (randuri: typeof livrari, nume: string) => {
    const header = 'Partener,CUI,NrDocumente,Baza,TVA,Total\n';
    const body = randuri
      .map((r) =>
        [
          csvField(r.denumire),
          csvField(r.cui ?? ''),
          r.nrDocumente,
          r.bazaBani / 100,
          r.tvaBani / 100,
          r.totalBani / 100,
        ].join(','),
      )
      .join('\n');
    downloadText(nume, header + body, 'text/csv');
  };

  return (
    <div>
      <PageHeader
        title="D394 — Livrari / achizitii pe partener"
        subtitle="Declaratie de lucru, grupata pe partener cu CUI"
      />
      <Card className="mb-6 flex flex-wrap items-end gap-4 p-4">
        <Field label="De la data">
          <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
        </Field>
        <Field label="Pana la data">
          <Input type="date" value={pana} onChange={(e) => setPana(e.target.value)} />
        </Field>
      </Card>
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-semibold text-fg">Livrari (vanzari)</h3>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => exportaCsv(livrari, 'D394-livrari.csv')}
          >
            <Download className="h-4 w-4" /> CSV
          </Button>
        </div>
        <DataTable
          columns={columns}
          rows={livrari}
          getRowKey={(r) => r.partenerId}
          empty="Fara livrari in perioada."
        />
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-semibold text-fg">Achizitii (cumparari)</h3>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => exportaCsv(achizitii, 'D394-achizitii.csv')}
          >
            <Download className="h-4 w-4" /> CSV
          </Button>
        </div>
        <DataTable
          columns={columns}
          rows={achizitii}
          getRowKey={(r) => r.partenerId}
          empty="Fara achizitii in perioada."
        />
      </div>
    </div>
  );
}

export function D390Page() {
  const db = useData();
  const { rows } = useCollection(db.documente);
  const [parteneri, setParteneri] = useState<Partener[]>([]);
  const [de, setDe] = useState('');
  const [pana, setPana] = useState('');
  useEffect(() => {
    db.parteneri.list().then(setParteneri);
  }, [db]);

  const randuri = useMemo(
    () => sumarD390(rows, parteneri, { de: de || undefined, pana: pana || undefined }),
    [rows, parteneri, de, pana],
  );

  const columns: Column<(typeof randuri)[number]>[] = [
    { key: 'denumire', header: 'Partener' },
    { key: 'tara', header: 'Tara', render: (r) => <Badge>{r.tara}</Badge> },
    { key: 'cod', header: 'Cod TVA intracomunitar', render: (r) => r.codTvaIntracomunitar ?? '—' },
    {
      key: 'operatiune',
      header: 'Operatiune',
      render: (r) => (
        <Badge tone={r.operatiune === 'livrare' ? 'success' : 'warning'}>{r.operatiune}</Badge>
      ),
    },
    { key: 'nr', header: 'Nr. documente', align: 'right', render: (r) => String(r.nrDocumente) },
    {
      key: 'baza',
      header: 'Baza',
      align: 'right',
      render: (r) => <span className="font-medium">{fmt.bani(r.bazaBani)}</span>,
    },
  ];

  const exportaCsv = () => {
    const header = 'Partener,Tara,CodTvaIntracomunitar,Operatiune,NrDocumente,Baza\n';
    const body = randuri
      .map((r) =>
        [
          csvField(r.denumire),
          csvField(r.tara),
          csvField(r.codTvaIntracomunitar ?? ''),
          csvField(r.operatiune),
          r.nrDocumente,
          r.bazaBani / 100,
        ].join(','),
      )
      .join('\n');
    downloadText('D390.csv', header + body, 'text/csv');
  };

  return (
    <div>
      <PageHeader
        title="D390 (VIES) — operatiuni intracomunitare"
        subtitle="Livrari/achizitii catre/de la parteneri din alte state UE"
        actions={
          <Button variant="secondary" onClick={exportaCsv}>
            <Download className="h-4 w-4" /> CSV
          </Button>
        }
      />
      <DataTable
        columns={columns}
        rows={randuri}
        getRowKey={(r) => `${r.partenerId}-${r.operatiune}`}
        empty="Nicio operatiune intracomunitara in perioada."
      />
    </div>
  );
}

export function SaftPage() {
  const db = useData();
  const { firmaCurenta } = useFirma();
  const [luna, setLuna] = useState(String(new Date().getMonth() + 1));
  const [an, setAn] = useState(String(new Date().getFullYear()));

  const genereaza = async () => {
    const [documente, parteneri, produse] = await Promise.all([
      db.documente.list(),
      db.parteneri.list(),
      db.produse.list(),
    ]);
    const xml = genereazaSaftXML({
      companie: {
        nume: firmaCurenta?.denumire || 'Firma nesetata',
        cui: firmaCurenta?.cui ?? '',
        perioadaLuna: Number(luna),
        perioadaAn: Number(an),
      },
      parteneri,
      produse,
      documente,
    });
    downloadText(`SAF-T_D406_${an}_${luna}.xml`, xml);
  };

  return (
    <div>
      <PageHeader title="SAF-T (D406)" subtitle="Fisierul standard de audit fiscal — export XML" />
      <Card className="flex flex-wrap items-end gap-4 p-5">
        <Field label="Luna">
          <Select
            options={Array.from({ length: 12 }, (_, i) => ({
              value: String(i + 1),
              label: String(i + 1),
            }))}
            value={luna}
            onChange={(e) => setLuna(e.target.value)}
          />
        </Field>
        <Field label="An">
          <Input type="number" value={an} onChange={(e) => setAn(e.target.value)} />
        </Field>
        <Button onClick={genereaza}>
          <Download className="h-4 w-4" /> Genereaza D406
        </Button>
      </Card>
      <p className="mt-3 text-sm text-fg-muted">
        Export structural D406 (Header, MasterFiles: clienti/furnizori/produse, SalesInvoices).
        Schema completa se extinde in integrarea ANAF.
      </p>
    </div>
  );
}
