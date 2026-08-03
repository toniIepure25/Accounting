import {
  CONFIGURATIE_MOBILA_GOALA,
  type CombinatieInterzisa,
  type ConfiguratieMobila,
  DEPARTAMENTE_PRODUCTIE,
  type Document,
  type DocumentLinie,
  ETICHETE_DEPARTAMENT,
  type Firma,
  type OptiuneConfigurator,
  type Partener,
  type Plasare,
  type Produs,
  type ProfilConfigurator,
  type StareProductie,
  calculCantMl,
  calculPretConfiguratie,
  listaDebitare,
  necesarConsumStoc,
  necesarFeronerie,
  optimizeazaDebitare,
  panouriCaPiese,
  panouriPentruLot,
  parseConfiguratieMobila,
  randuriCroire,
  restDePlata,
  ronToBani,
  toateDepartamenteleFinalizate,
  urmatorulDepartament,
  verificaConfiguratie,
} from '@gr/core-domain';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  Download,
  FileText,
  Plus,
  Sofa,
  Truck,
  Wrench,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { type Column, DataTable } from '../components/DataTable.js';
import { DocumentEditor } from '../components/DocumentEditor.js';
import { EntityGrid } from '../components/EntityGrid.js';
import { Field, Select } from '../components/controls.js';
import { Badge, Button, Card, Input, PageHeader } from '../components/ui.js';
import { useCollection } from '../hooks/useCollection.js';
import { useStoc } from '../hooks/useStoc.js';
import { useAuth } from '../lib/auth-context.js';
import { useData } from '../lib/data-context.js';
import { downloadText, printHtml } from '../lib/export.js';
import { useFirma } from '../lib/firma-context.js';
import * as fmt from '../lib/format.js';
import { antetFirmaHtml } from '../lib/print-branding.js';
import { csvField, escapeHtml } from '../lib/safe-output.js';

const STARI: StareProductie[] = [
  'oferta',
  'confirmata',
  'in_productie',
  'finalizata',
  'livrata',
  'facturata',
];
const ETICHETE: Record<StareProductie, string> = {
  oferta: 'Oferta',
  confirmata: 'Confirmata',
  in_productie: 'In productie',
  finalizata: 'Finalizata',
  livrata: 'Livrata',
  facturata: 'Facturata',
};

/** Diagrama de taiere pentru o singura placa (reutilizata la previzualizarea din Configurator si la sarja de debitare). */
function DiagramaPlaca({
  placa,
  plasari,
  index = 1,
}: {
  placa: { latimeMm: number; inaltimeMm: number };
  plasari: readonly Plasare[];
  index?: number;
}) {
  return (
    <svg
      viewBox={`0 0 ${placa.latimeMm} ${placa.inaltimeMm}`}
      className="w-full rounded-lg border border-border bg-muted/30"
      role="img"
      aria-label={`Diagrama de taiere placa ${index}`}
    >
      {plasari.map((p, i) => (
        <g key={`${p.eticheta}-${i}`}>
          <rect
            x={p.x}
            y={p.y}
            width={p.latimeMm}
            height={p.inaltimeMm}
            fill="hsl(211 100% 60% / 0.18)"
            stroke="hsl(211 100% 60%)"
            strokeWidth={4}
          />
          <text x={p.x + 20} y={p.y + 90} fontSize={64} fill="hsl(211 100% 45%)">
            {p.eticheta}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function OptiuniMobilaPage() {
  const db = useData();
  const repo = db.optiuniMobila;
  const [produse, setProduse] = useState<Produs[]>([]);
  useEffect(() => {
    db.produse.list().then(setProduse);
  }, [db]);
  const produsNume = (id: string | null) => produse.find((p) => p.id === id)?.denumire ?? '—';

  return (
    <EntityGrid<OptiuneConfigurator>
      title="Optiuni configurator"
      subtitle="Materiale, finisaje si accesorii pentru configurator"
      labelSingular="optiune"
      repo={repo}
      columns={[
        { key: 'tip', header: 'Tip', render: (r) => <Badge>{r.tip}</Badge> },
        { key: 'cod', header: 'Cod' },
        { key: 'denumire', header: 'Denumire' },
        {
          key: 'pretBani',
          header: 'Pret fix',
          align: 'right',
          render: (r) => fmt.bani(r.pretBani),
        },
        {
          key: 'pretPeMpBani',
          header: 'Pret / mp',
          align: 'right',
          render: (r) => fmt.bani(r.pretPeMpBani),
        },
        {
          key: 'produsId',
          header: 'Produs (consum stoc)',
          render: (r) => (r.produsId ? produsNume(r.produsId) : '—'),
        },
      ]}
      fields={[
        {
          name: 'tip',
          label: 'Tip',
          type: 'select',
          options: [
            { value: 'material', label: 'Material' },
            { value: 'finisaj', label: 'Finisaj' },
            { value: 'accesoriu', label: 'Accesoriu' },
          ],
        },
        { name: 'cod', label: 'Cod', type: 'text' },
        { name: 'denumire', label: 'Denumire', type: 'text', full: true },
        { name: 'pretBani', label: 'Pret fix', type: 'money' },
        { name: 'pretPeMpBani', label: 'Pret pe mp', type: 'money' },
        {
          name: 'produsId',
          label: 'Produs legat (pentru consum real de stoc la productie)',
          type: 'select',
          nullable: true,
          full: true,
          options: produse.map((p) => ({
            value: p.id,
            label: `${p.cod} · ${p.denumire} (${p.unitateMasura})`,
          })),
        },
        { name: 'activ', label: 'Activ', type: 'checkbox' },
      ]}
      defaults={{
        tip: 'material',
        cod: '',
        denumire: '',
        pretBani: 0,
        pretPeMpBani: 0,
        produsId: null,
        activ: true,
      }}
    />
  );
}

function numOrNull(v: string): number | null {
  return v === '' ? null : Number(v);
}

/**
 * Reguli de validare pentru configurator: profil de dimensiuni min/max (un
 * singur rand — se editeaza randul existent in loc sa se permita mai multe,
 * ca sa nu existe ambiguitate care profil se aplica) + combinatii material x
 * finisaj interzise (lista, editabila cu EntityGrid). Fara acest ecran,
 * `verificaConfiguratie` din core-domain (deja testata) nu are de unde sa
 * citeasca regulile reale — Configuratorul le foloseste mai jos.
 */
export function ReguliConfiguratorPage() {
  const db = useData();
  const { rows: profile, create, update, reload } = useCollection(db.profilConfigurator);
  const [optiuni, setOptiuni] = useState<OptiuneConfigurator[]>([]);
  useEffect(() => {
    db.optiuniMobila.list().then(setOptiuni);
  }, [db]);
  const materiale = optiuni.filter((o) => o.tip === 'material');
  const finisaje = optiuni.filter((o) => o.tip === 'finisaj');
  const optiuneNume = (id: string) => optiuni.find((o) => o.id === id)?.denumire ?? id;

  const profil = profile[0] ?? null;
  const [form, setForm] = useState({
    latimeMinMm: '',
    latimeMaxMm: '',
    inaltimeMinMm: '',
    inaltimeMaxMm: '',
    adancimeMinMm: '',
    adancimeMaxMm: '',
  });
  useEffect(() => {
    setForm({
      latimeMinMm: profil?.latimeMinMm?.toString() ?? '',
      latimeMaxMm: profil?.latimeMaxMm?.toString() ?? '',
      inaltimeMinMm: profil?.inaltimeMinMm?.toString() ?? '',
      inaltimeMaxMm: profil?.inaltimeMaxMm?.toString() ?? '',
      adancimeMinMm: profil?.adancimeMinMm?.toString() ?? '',
      adancimeMaxMm: profil?.adancimeMaxMm?.toString() ?? '',
    });
  }, [profil]);

  const salveaza = async () => {
    const patch = {
      latimeMinMm: numOrNull(form.latimeMinMm),
      latimeMaxMm: numOrNull(form.latimeMaxMm),
      inaltimeMinMm: numOrNull(form.inaltimeMinMm),
      inaltimeMaxMm: numOrNull(form.inaltimeMaxMm),
      adancimeMinMm: numOrNull(form.adancimeMinMm),
      adancimeMaxMm: numOrNull(form.adancimeMaxMm),
    };
    if (profil) await update(profil.id, patch);
    else await create(patch);
  };

  return (
    <div>
      <PageHeader
        title="Reguli configurator"
        subtitle="Dimensiuni admise si combinatii material x finisaj interzise, aplicate live in Configurator"
      />
      <Card className="mb-6 p-5">
        <h3 className="mb-4 font-semibold text-fg">Dimensiuni admise (mm)</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label="Latime minima">
            <Input
              type="number"
              value={form.latimeMinMm}
              onChange={(e) => setForm((f) => ({ ...f, latimeMinMm: e.target.value }))}
            />
          </Field>
          <Field label="Latime maxima">
            <Input
              type="number"
              value={form.latimeMaxMm}
              onChange={(e) => setForm((f) => ({ ...f, latimeMaxMm: e.target.value }))}
            />
          </Field>
          <Field label="Inaltime minima">
            <Input
              type="number"
              value={form.inaltimeMinMm}
              onChange={(e) => setForm((f) => ({ ...f, inaltimeMinMm: e.target.value }))}
            />
          </Field>
          <Field label="Inaltime maxima">
            <Input
              type="number"
              value={form.inaltimeMaxMm}
              onChange={(e) => setForm((f) => ({ ...f, inaltimeMaxMm: e.target.value }))}
            />
          </Field>
          <Field label="Adancime minima">
            <Input
              type="number"
              value={form.adancimeMinMm}
              onChange={(e) => setForm((f) => ({ ...f, adancimeMinMm: e.target.value }))}
            />
          </Field>
          <Field label="Adancime maxima">
            <Input
              type="number"
              value={form.adancimeMaxMm}
              onChange={(e) => setForm((f) => ({ ...f, adancimeMaxMm: e.target.value }))}
            />
          </Field>
        </div>
        <Button
          className="mt-4"
          onClick={async () => {
            await salveaza();
            reload();
          }}
        >
          Salveaza
        </Button>
      </Card>

      <EntityGrid<CombinatieInterzisa>
        title="Combinatii material x finisaj interzise"
        labelSingular="combinatie"
        repo={db.combinatiiInterzise}
        columns={[
          { key: 'materialId', header: 'Material', render: (r) => optiuneNume(r.materialId) },
          { key: 'finisajId', header: 'Finisaj', render: (r) => optiuneNume(r.finisajId) },
        ]}
        fields={[
          {
            name: 'materialId',
            label: 'Material',
            type: 'select',
            options: materiale.map((m) => ({ value: m.id, label: m.denumire })),
          },
          {
            name: 'finisajId',
            label: 'Finisaj',
            type: 'select',
            options: finisaje.map((f) => ({ value: f.id, label: f.denumire })),
          },
        ]}
        defaults={{ materialId: materiale[0]?.id ?? '', finisajId: finisaje[0]?.id ?? '' }}
        searchable={false}
      />
    </div>
  );
}

/** Construieste obiectul ReguliConfigurator (core-domain) din profilul si combinatiile persistate. */
function reguliDin(
  profil: ProfilConfigurator | undefined,
  combinatii: readonly CombinatieInterzisa[],
) {
  return {
    latimeMinMm: profil?.latimeMinMm ?? undefined,
    latimeMaxMm: profil?.latimeMaxMm ?? undefined,
    inaltimeMinMm: profil?.inaltimeMinMm ?? undefined,
    inaltimeMaxMm: profil?.inaltimeMaxMm ?? undefined,
    adancimeMinMm: profil?.adancimeMinMm ?? undefined,
    adancimeMaxMm: profil?.adancimeMaxMm ?? undefined,
    combinatiiInterzise: combinatii.map((c) => ({
      materialId: c.materialId,
      finisajId: c.finisajId,
    })),
  };
}

export function ConfiguratorPage() {
  const db = useData();
  const { areVoie } = useAuth();
  const poateCrea = areVoie('documente.creare');
  const [optiuni, setOptiuni] = useState<OptiuneConfigurator[]>([]);
  const [parteneri, setParteneri] = useState<Partener[]>([]);
  const [profilRows, setProfilRows] = useState<ProfilConfigurator[]>([]);
  const [combinatii, setCombinatii] = useState<CombinatieInterzisa[]>([]);
  useEffect(() => {
    db.optiuniMobila.list().then(setOptiuni);
    db.parteneri
      .list()
      .then((p) => setParteneri(p.filter((x) => x.tip === 'client' || x.tip === 'ambele')));
    db.profilConfigurator.list().then(setProfilRows);
    db.combinatiiInterzise.list().then(setCombinatii);
  }, [db]);

  const materiale = optiuni.filter((o) => o.tip === 'material');
  const finisaje = optiuni.filter((o) => o.tip === 'finisaj');
  const accesorii = optiuni.filter((o) => o.tip === 'accesoriu');
  const reguli = useMemo(() => reguliDin(profilRows[0], combinatii), [profilRows, combinatii]);

  const [bazaRon, setBazaRon] = useState(500);
  const [manoperaRon, setManoperaRon] = useState(150);
  const [cfg, setCfg] = useState<ConfiguratieMobila>({
    ...CONFIGURATIE_MOBILA_GOALA,
    latimeMm: 1000,
    inaltimeMm: 2000,
    adancimeMm: 600,
  });
  const [clientId, setClientId] = useState('');
  const [mesaj, setMesaj] = useState('');

  const pret = useMemo(
    () => calculPretConfiguratie(ronToBani(bazaRon), cfg, optiuni),
    [bazaRon, cfg, optiuni],
  );
  const suprafata = ((cfg.latimeMm * cfg.inaltimeMm) / 1_000_000).toFixed(2);
  const debitare = useMemo(() => listaDebitare(cfg), [cfg]);
  const PLACA = { latimeMm: 2800, inaltimeMm: 2070 };
  const nesting = useMemo(
    () => optimizeazaDebitare(panouriCaPiese(debitare.panouri), PLACA),
    [debitare],
  );
  const cantMl = useMemo(() => calculCantMl(debitare.panouri, 4), [debitare]);
  const feronerie = useMemo(() => necesarFeronerie(cfg, optiuni), [cfg, optiuni]);
  const erori = useMemo(() => verificaConfiguratie(cfg, reguli), [cfg, reguli]);

  const toggleAccesoriu = (id: string) =>
    setCfg((c) => ({
      ...c,
      accesoriiIds: c.accesoriiIds.includes(id)
        ? c.accesoriiIds.filter((x) => x !== id)
        : [...c.accesoriiIds, id],
    }));

  const creeazaComanda = async () => {
    // Fara verificarea asta, orice utilizator autentificat putea crea o
    // comanda din configurator, indiferent de rol — spre deosebire de orice
    // alt ecran de documente din aplicatie (DocumentEditor.tsx face aceeasi
    // verificare). Butonul de mai jos e si el dezactivat, dar verificam din
    // nou aici ca sa nu depindem doar de UI.
    if (!poateCrea || erori.length > 0) return;
    // Alocator atomic (nu numarare locala) — evita duplicate/coliziuni de numar.
    const an = new Date().getFullYear();
    const { numar, cod } = await db.numerotare.next('comanda_mobila', an, 'CMD', 6);
    const cfgFinal: ConfiguratieMobila = { ...cfg, costManoperaBani: ronToBani(manoperaRon) };
    const doc = await db.documente.create({
      tip: 'comanda_mobila',
      serie: 'CMD',
      numar,
      cod,
      data: new Date().toISOString().slice(0, 10),
      partenerId: clientId || null,
      gestiuneId: null,
      gestiuneDestinatieId: null,
      punctDeLucruId: null,
      documentSursaId: null,
      scadenta: null,
      observatii: `Configuratie: ${cfg.latimeMm}x${cfg.inaltimeMm}x${cfg.adancimeMm} mm`,
      stare: 'validat',
      totalNetBani: pret,
      totalTvaBani: Math.round(pret * 0.19),
      totalBrutBani: pret + Math.round(pret * 0.19),
      avansBani: 0,
      meta: JSON.stringify(cfgFinal),
    });
    await db.documenteLinii.create({
      documentId: doc.id,
      produsId: null,
      denumire: 'Mobila la comanda (configurata)',
      unitateMasura: 'buc',
      cantitate: 1,
      pretUnitarBani: pret,
      cotaTvaProcent: 19,
      pretIncludeTva: false,
      netBani: pret,
      tvaBani: Math.round(pret * 0.19),
      brutBani: pret + Math.round(pret * 0.19),
    });
    setMesaj(`Comanda ${doc.cod} a fost creata.`);
  };

  return (
    <div>
      <PageHeader
        title="Configurator mobila"
        subtitle="Configureaza un produs la comanda si obtine pretul instant"
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h3 className="mb-4 flex items-center gap-2 font-semibold text-fg">
            <Sofa className="h-5 w-5 text-primary" /> Dimensiuni si materiale
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Latime (mm)">
              <Input
                type="number"
                value={cfg.latimeMm}
                onChange={(e) => setCfg({ ...cfg, latimeMm: Number(e.target.value) })}
              />
            </Field>
            <Field label="Inaltime (mm)">
              <Input
                type="number"
                value={cfg.inaltimeMm}
                onChange={(e) => setCfg({ ...cfg, inaltimeMm: Number(e.target.value) })}
              />
            </Field>
            <Field label="Adancime (mm)">
              <Input
                type="number"
                value={cfg.adancimeMm}
                onChange={(e) => setCfg({ ...cfg, adancimeMm: Number(e.target.value) })}
              />
            </Field>
            <Field label="Pret de baza (RON)">
              <Input
                type="number"
                step="0.01"
                value={bazaRon}
                onChange={(e) => setBazaRon(Number(e.target.value))}
              />
            </Field>
            <Field label="Cost manopera estimat (RON)">
              <Input
                type="number"
                step="0.01"
                value={manoperaRon}
                onChange={(e) => setManoperaRon(Number(e.target.value))}
              />
            </Field>
            <Field label="Material">
              <Select
                options={[
                  { value: '', label: '— fara —' },
                  ...materiale.map((m) => ({ value: m.id, label: m.denumire })),
                ]}
                value={cfg.materialId ?? ''}
                onChange={(e) => setCfg({ ...cfg, materialId: e.target.value || null })}
              />
            </Field>
            <Field label="Finisaj">
              <Select
                options={[
                  { value: '', label: '— fara —' },
                  ...finisaje.map((m) => ({ value: m.id, label: m.denumire })),
                ]}
                value={cfg.finisajId ?? ''}
                onChange={(e) => setCfg({ ...cfg, finisajId: e.target.value || null })}
              />
            </Field>
          </div>

          <div className="mt-4">
            <span className="mb-2 block text-sm font-medium text-fg">Accesorii</span>
            <div className="flex flex-wrap gap-2">
              {accesorii.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => toggleAccesoriu(a.id)}
                  className={`rounded-lg border px-3 py-1.5 text-sm ${
                    cfg.accesoriiIds.includes(a.id)
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-fg-muted hover:bg-muted'
                  }`}
                >
                  {a.denumire} · {fmt.bani(a.pretBani)}
                </button>
              ))}
              {accesorii.length === 0 && (
                <span className="text-sm text-fg-muted">Fara accesorii definite.</span>
              )}
            </div>
          </div>
        </Card>

        <Card className="flex flex-col p-5">
          <h3 className="mb-4 font-semibold text-fg">Rezultat</h3>
          <div className="space-y-2 text-sm text-fg-muted">
            <div className="flex justify-between">
              <span>Suprafata frontala</span>
              <b className="text-fg">{suprafata} mp</b>
            </div>
            <div className="flex justify-between">
              <span>Pret de baza</span>
              <b className="text-fg">{fmt.bani(ronToBani(bazaRon))}</b>
            </div>
          </div>
          <div className="mt-4 rounded-xl bg-primary/10 p-4 text-center">
            <div className="text-sm text-fg-muted">Pret configuratie (fara TVA)</div>
            <div className="mt-1 text-3xl font-bold text-primary">{fmt.bani(pret)}</div>
            <div className="mt-1 text-xs text-fg-muted">
              cu TVA: {fmt.lei(pret + Math.round(pret * 0.19))}
            </div>
          </div>
          <Field label="Client" className="mt-4">
            <Select
              options={[
                { value: '', label: '— selecteaza —' },
                ...parteneri.map((p) => ({ value: p.id, label: p.denumire })),
              ]}
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            />
          </Field>
          {erori.length > 0 && (
            <div className="mt-3 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
              <div className="mb-1 flex items-center gap-1.5 font-medium">
                <AlertTriangle className="h-4 w-4" /> Configuratie invalida
              </div>
              <ul className="list-inside list-disc space-y-0.5">
                {erori.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          {!poateCrea && (
            <p className="mt-3 text-center text-xs text-fg-muted">
              Rolul tau nu are dreptul de a crea documente.
            </p>
          )}
          <Button
            className="mt-3"
            onClick={creeazaComanda}
            disabled={!poateCrea || erori.length > 0}
          >
            <Plus className="h-4 w-4" /> Creeaza comanda
          </Button>
          {mesaj && <p className="mt-2 text-center text-sm text-success">{mesaj}</p>}
        </Card>
      </div>

      <Card className="mt-6 p-5">
        <h3 className="mb-3 font-semibold text-fg">Lista de debitare (productie)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-fg-muted">
                <th className="py-2 pr-4 font-medium">Reper</th>
                <th className="py-2 pr-4 text-right font-medium">Latime (mm)</th>
                <th className="py-2 pr-4 text-right font-medium">Inaltime (mm)</th>
                <th className="py-2 pr-4 text-right font-medium">Bucati</th>
              </tr>
            </thead>
            <tbody>
              {debitare.panouri.map((p) => (
                <tr key={p.denumire} className="border-b border-border/60 last:border-0">
                  <td className="py-2 pr-4 text-fg">{p.denumire}</td>
                  <td className="py-2 pr-4 text-right text-fg">{p.latimeMm}</td>
                  <td className="py-2 pr-4 text-right text-fg">{p.inaltimeMm}</td>
                  <td className="py-2 pr-4 text-right text-fg">{p.bucati}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-fg-muted">
          Suprafata totala de debitat: <b className="text-fg">{debitare.suprafataMp} mp</b>
        </p>

        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div>
            <h4 className="mb-2 text-sm font-semibold text-fg">
              Optimizare debitare (placa 2800×2070)
            </h4>
            <div className="flex flex-wrap gap-4 text-sm text-fg-muted">
              <span>
                Placi necesare: <b className="text-fg">{nesting.nrPlaci}</b>
              </span>
              <span>
                Pierdere material: <b className="text-fg">{nesting.procentPierdere}%</b>
              </span>
              <span>
                Cant total: <b className="text-fg">{cantMl} ml</b>
              </span>
            </div>
            {nesting.placi[0] && (
              <div className="mt-3">
                <DiagramaPlaca placa={PLACA} plasari={nesting.placi[0].plasari} />
              </div>
            )}
          </div>

          <div>
            <h4 className="mb-2 text-sm font-semibold text-fg">Feronerie necesara</h4>
            {feronerie.length === 0 ? (
              <p className="text-sm text-fg-muted">Niciun accesoriu selectat.</p>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {feronerie.map((f) => (
                    <tr key={f.denumire} className="border-b border-border/60 last:border-0">
                      <td className="py-1.5 text-fg">{f.denumire}</td>
                      <td className="py-1.5 text-right text-fg">{f.bucati} buc</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

export const ComenziMobilaPage = () => (
  <DocumentEditor
    tip="comanda_mobila"
    title="Comenzi mobila"
    subtitle="Comenzi la comanda cu avans si termen de livrare"
    prefix="CMD"
    partenerTip="client"
    needsGestiune
    isOrder
  />
);

function parseStare(meta: string): StareProductie {
  return parseConfiguratieMobila(meta).stareProductie;
}

function devizHtml(
  doc: Document,
  cfg: ConfiguratieMobila,
  optiuni: OptiuneConfigurator[],
  firma: Firma | null,
  buyer?: Partener,
): string {
  const money = (b: number) =>
    (b / 100).toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const byId = new Map(optiuni.map((o) => [o.id, o]));
  const materialNume = cfg.materialId ? (byId.get(cfg.materialId)?.denumire ?? '—') : '—';
  const finisajNume = cfg.finisajId ? (byId.get(cfg.finisajId)?.denumire ?? '—') : '—';
  const accesoriiNume =
    cfg.accesoriiIds.map((id) => byId.get(id)?.denumire ?? id).join(', ') || '—';
  return `<!doctype html><html lang="ro"><head><meta charset="utf-8"><title>Deviz ${escapeHtml(doc.cod)}</title>
  <style>
    body{font-family:Arial,sans-serif;color:#111;margin:32px;font-size:13px}
    h1{font-size:20px;margin:0 0 4px}
    table{width:100%;border-collapse:collapse;margin-top:16px}
    th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}
    th{background:#f3f4f6;width:220px}
    .tot{margin-top:16px;width:280px;margin-left:auto}
    .tot div{display:flex;justify-content:space-between;padding:3px 0}
    .tot .g{font-weight:bold;border-top:2px solid #111;padding-top:6px}
  </style></head><body>
  ${antetFirmaHtml(firma)}
  <h1>DEVIZ — Mobila la comanda</h1>
  <div>Comanda: <b>${escapeHtml(doc.cod)}</b> · Data: ${escapeHtml(doc.data)}${doc.scadenta ? ` · Termen livrare: ${escapeHtml(doc.scadenta)}` : ''}</div>
  <div style="margin-top:8px">Client: <b>${escapeHtml(buyer?.denumire ?? '—')}</b>${buyer?.cui ? ` · CUI: ${escapeHtml(buyer.cui)}` : ''}</div>
  <table>
    <tbody>
      <tr><th>Dimensiuni (L×H×A)</th><td>${cfg.latimeMm} × ${cfg.inaltimeMm} × ${cfg.adancimeMm} mm</td></tr>
      <tr><th>Material</th><td>${escapeHtml(materialNume)}</td></tr>
      <tr><th>Finisaj</th><td>${escapeHtml(finisajNume)}</td></tr>
      <tr><th>Accesorii</th><td>${escapeHtml(accesoriiNume)}</td></tr>
    </tbody>
  </table>
  <div class="tot">
    <div><span>Total fara TVA</span><span>${money(doc.totalNetBani)} lei</span></div>
    <div><span>TVA</span><span>${money(doc.totalTvaBani)} lei</span></div>
    <div class="g"><span>Total deviz</span><span>${money(doc.totalBrutBani)} lei</span></div>
    ${doc.avansBani > 0 ? `<div><span>Avans</span><span>${money(doc.avansBani)} lei</span></div>` : ''}
  </div>
  <p style="margin-top:24px;color:#666">Deviz orientativ, nu are valoare de document fiscal.</p>
  </body></html>`;
}

const PLACA_STANDARD = { latimeMm: 2800, inaltimeMm: 2070 };

/**
 * Optimizarea de debitare din Configurator arata doar previzualizarea unei
 * SINGURE comenzi, in timpul configurarii — nu se aplica niciodata comenzilor
 * reale aflate in productie. Aici se combina piesele mai multor comenzi reale
 * pe aceleasi placi (economia de material vine din combinare, nu din
 * optimizarea fiecarei comenzi separat) si se exporta lista de croire pentru
 * CNC.
 */
export function SarjaDebitarePage() {
  const db = useData();
  const { rows: documente } = useCollection(db.documente);
  const [parteneri, setParteneri] = useState<Partener[]>([]);
  useEffect(() => {
    db.parteneri.list().then(setParteneri);
  }, [db]);
  const partenerNume = (id: string | null) => parteneri.find((p) => p.id === id)?.denumire ?? '—';

  const eligibile = useMemo(
    () =>
      documente
        .filter(
          (d) =>
            d.tip === 'comanda_mobila' &&
            (parseStare(d.meta) === 'confirmata' || parseStare(d.meta) === 'in_productie'),
        )
        .sort((a, b) => a.cod.localeCompare(b.cod)),
    [documente],
  );

  const [selectate, setSelectate] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setSelectate((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const comenziSelectate = useMemo(
    () =>
      eligibile
        .filter((d) => selectate.has(d.id))
        .map((d) => ({ cod: d.cod, cfg: parseConfiguratieMobila(d.meta) })),
    [eligibile, selectate],
  );
  const piese = useMemo(() => panouriPentruLot(comenziSelectate), [comenziSelectate]);
  const nesting = useMemo(
    () => (piese.length > 0 ? optimizeazaDebitare(piese, PLACA_STANDARD) : null),
    [piese],
  );

  const exportaCsv = () => {
    if (!nesting) return;
    const randuri = randuriCroire(nesting);
    const antet = 'Placa,Piesa,X (mm),Y (mm),Latime (mm),Inaltime (mm),Rotit\n';
    const corp = randuri
      .map(
        (r) =>
          `${r.placaIndex},${csvField(r.eticheta)},${r.xMm},${r.yMm},${r.latimeMm},${r.inaltimeMm},${r.rotit ? 'da' : 'nu'}`,
      )
      .join('\n');
    downloadText(
      `sarja-debitare-${new Date().toISOString().slice(0, 10)}.csv`,
      antet + corp,
      'text/csv',
    );
  };

  return (
    <div>
      <PageHeader
        title="Sarja de debitare"
        subtitle="Combina piesele mai multor comenzi pe aceleasi placi — aici e economia reala de material, nu in preview-ul din Configurator"
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-5">
          <h3 className="mb-3 font-semibold text-fg">Comenzi eligibile</h3>
          <p className="mb-3 text-xs text-fg-muted">Confirmate sau in productie.</p>
          <div className="space-y-2">
            {eligibile.map((d) => (
              <label
                key={d.id}
                className="flex items-center gap-2 rounded-lg border border-border p-2 text-sm"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={selectate.has(d.id)}
                  onChange={() => toggle(d.id)}
                />
                <span className="font-mono text-xs">{d.cod}</span>
                <span className="truncate text-fg-muted">{partenerNume(d.partenerId)}</span>
              </label>
            ))}
            {eligibile.length === 0 && (
              <p className="text-sm text-fg-muted">Nicio comanda confirmata sau in productie.</p>
            )}
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-fg">
              Rezultat sarja ({comenziSelectate.length} comenzi)
            </h3>
            <Button variant="secondary" size="sm" onClick={exportaCsv} disabled={!nesting}>
              <Download className="h-4 w-4" /> Export CNC (CSV)
            </Button>
          </div>
          {nesting ? (
            <>
              <div className="mb-4 flex flex-wrap gap-4 text-sm text-fg-muted">
                <span>
                  Placi necesare: <b className="text-fg">{nesting.nrPlaci}</b>
                </span>
                <span>
                  Pierdere material: <b className="text-fg">{nesting.procentPierdere}%</b>
                </span>
                <span>
                  Piese totale: <b className="text-fg">{piese.reduce((a, p) => a + p.bucati, 0)}</b>
                </span>
              </div>
              <div className="space-y-4">
                {nesting.placi.map((pl) => (
                  <div key={pl.index}>
                    <p className="mb-1 text-xs text-fg-muted">Placa {pl.index + 1}</p>
                    <DiagramaPlaca
                      placa={PLACA_STANDARD}
                      plasari={pl.plasari}
                      index={pl.index + 1}
                    />
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-fg-muted">
              Selecteaza cel putin o comanda pentru a calcula sarja de debitare.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}

export function ProductieMobilaPage() {
  const db = useData();
  const { areVoie } = useAuth();
  const poateAvansa = areVoie('documente.validare');
  const { firmaCurenta } = useFirma();
  const { rows, reload } = useCollection(db.documente);
  const { solduri, miscari, reload: reloadStoc } = useStoc();
  const [parteneri, setParteneri] = useState<Partener[]>([]);
  const [produse, setProduse] = useState<Produs[]>([]);
  const [optiuni, setOptiuni] = useState<OptiuneConfigurator[]>([]);
  const [linii, setLinii] = useState<DocumentLinie[]>([]);
  const [eroare, setEroare] = useState('');
  useEffect(() => {
    db.parteneri.list().then(setParteneri);
    db.produse.list().then(setProduse);
    db.optiuniMobila.list().then(setOptiuni);
    db.documenteLinii.list().then(setLinii);
  }, [db]);

  const comenzi = rows.filter((d) => d.tip === 'comanda_mobila');
  const partenerNume = (id: string | null) => parteneri.find((p) => p.id === id)?.denumire ?? '—';
  const produsById = new Map(produse.map((p) => [p.id, p]));

  /** Bonul de consum generat automat pentru o comanda (legat prin documentSursaId). */
  const bonConsumAl = (comandaId: string) =>
    rows.find((d) => d.tip === 'bon_consum' && d.documentSursaId === comandaId);

  /**
   * Costul real al comenzii: costul CMP al iesirii de stoc generate de bonul
   * de consum (NU totalul nominal al bonului, care poate fi calculat la pret
   * de vanzare — acelasi motiv pentru care contabilitate.ts foloseste costul
   * CMP si nu totalNetBani la notele de consum) + costul de manopera.
   */
  const costComanda = (doc: Document) => {
    const cfg = parseConfiguratieMobila(doc.meta);
    const bon = bonConsumAl(doc.id);
    const costMaterial = bon
      ? miscari
          .filter((m) => m.documentId === bon.id && m.cantitate < 0)
          .reduce((a, m) => a - m.valoareBani, 0)
      : 0;
    return costMaterial + cfg.costManoperaBani;
  };

  const avanseaza = async (doc: Document) => {
    setEroare('');
    const cur = parseStare(doc.meta);
    const idx = STARI.indexOf(cur);
    const next = STARI[Math.min(idx + 1, STARI.length - 1)]!;
    const cfg = parseConfiguratieMobila(doc.meta);

    // O comanda nu poate trece din productie in "finalizata" cat timp mai are
    // departamente neterminate (debitare→cant→CNC→vopsitorie→montaj) — altfel
    // starea de productie ar deveni doar decorativa.
    if (
      cur === 'in_productie' &&
      next === 'finalizata' &&
      !toateDepartamenteleFinalizate(cfg.departamenteFinalizate)
    ) {
      const urm = urmatorulDepartament(cfg.departamenteFinalizate);
      setEroare(
        `Comanda ${doc.cod}: departamentul "${urm ? ETICHETE_DEPARTAMENT[urm] : ''}" nu e finalizat inca.`,
      );
      return;
    }

    // Confirmare: incaseaza avansul (daca exista) — operatiune de casa reala.
    if (next === 'confirmata' && doc.avansBani > 0) {
      await db.operatiuniCasa.create({
        data: new Date().toISOString().slice(0, 10),
        tip: 'incasare',
        sumaBani: doc.avansBani,
        partenerId: doc.partenerId,
        document: doc.cod,
        explicatie: `Avans comanda mobila ${doc.cod}`,
        punctDeLucruId: doc.punctDeLucruId,
      });
    }

    // Intrare in productie: genereaza bonul de consum REAL (BOM -> stoc), legat de comanda.
    // Blocheaza tranzitia daca stocul disponibil e insuficient sau daca nu exista o gestiune sursa.
    if (next === 'in_productie') {
      if (!doc.gestiuneId) {
        setEroare(
          `Comanda ${doc.cod}: seteaza o gestiune sursa (editeaza comanda) inainte de a intra in productie.`,
        );
        return;
      }
      const debitare = listaDebitare(cfg);
      const necesar = necesarConsumStoc(cfg, optiuni, debitare.suprafataMp);
      const insuficient = necesar.filter((n) => {
        const sold = solduri.find(
          (s) => s.gestiuneId === doc.gestiuneId && s.produsId === n.produsId,
        );
        return (sold?.cantitate ?? 0) < n.cantitate;
      });
      if (insuficient.length > 0) {
        const nume = insuficient
          .map((n) => produsById.get(n.produsId)?.denumire ?? n.produsId)
          .join(', ');
        setEroare(
          `Comanda ${doc.cod}: stoc insuficient pentru: ${nume}. Receptioneaza materiale sau ajusteaza configuratia.`,
        );
        return;
      }
      if (necesar.length > 0) {
        const an = new Date().getFullYear();
        const { numar, cod } = await db.numerotare.next('bon_consum', an, 'BC', 6);
        const liniiConsum = necesar.map((n) => {
          const p = produsById.get(n.produsId);
          const pretUnitarBani = p?.pretVanzareBani ?? 0;
          const netBani = Math.round(n.cantitate * pretUnitarBani);
          return {
            produsId: n.produsId,
            denumire: p?.denumire ?? n.produsId,
            unitateMasura: p?.unitateMasura ?? 'buc',
            cantitate: n.cantitate,
            pretUnitarBani,
            cotaTvaProcent: p?.cotaTvaProcent ?? 0,
            pretIncludeTva: false,
            netBani,
            tvaBani: 0,
            brutBani: netBani,
          };
        });
        const totalNet = liniiConsum.reduce((a, l) => a + l.netBani, 0);
        const bon = await db.documente.create({
          tip: 'bon_consum',
          serie: 'BC',
          numar,
          cod,
          data: new Date().toISOString().slice(0, 10),
          partenerId: null,
          gestiuneId: doc.gestiuneId,
          gestiuneDestinatieId: null,
          punctDeLucruId: doc.punctDeLucruId,
          documentSursaId: doc.id,
          scadenta: null,
          observatii: `Consum productie pentru comanda ${doc.cod}`,
          stare: 'validat',
          totalNetBani: totalNet,
          totalTvaBani: 0,
          totalBrutBani: totalNet,
          avansBani: 0,
          meta: '{}',
        });
        for (const l of liniiConsum) await db.documenteLinii.create({ documentId: bon.id, ...l });
      }
    }

    // Livrare: genereaza avizul de insotire legat de comanda.
    if (next === 'livrata') {
      const an = new Date().getFullYear();
      const { numar, cod } = await db.numerotare.next('aviz', an, 'AV', 6);
      await db.documente.create({
        tip: 'aviz',
        serie: 'AV',
        numar,
        cod,
        data: new Date().toISOString().slice(0, 10),
        partenerId: doc.partenerId,
        gestiuneId: doc.gestiuneId,
        gestiuneDestinatieId: null,
        punctDeLucruId: doc.punctDeLucruId,
        documentSursaId: doc.id,
        scadenta: null,
        observatii: `Livrare comanda ${doc.cod}`,
        stare: 'validat',
        totalNetBani: doc.totalNetBani,
        totalTvaBani: doc.totalTvaBani,
        totalBrutBani: doc.totalBrutBani,
        avansBani: 0,
        meta: '{}',
      });
    }

    // Facturare: genereaza factura de vanzare finala, cu liniile comenzii, legata de comanda.
    if (next === 'facturata') {
      const an = new Date().getFullYear();
      const { numar, cod } = await db.numerotare.next('factura_vanzare', an, 'FCT', 6);
      const factura = await db.documente.create({
        tip: 'factura_vanzare',
        serie: 'FCT',
        numar,
        cod,
        data: new Date().toISOString().slice(0, 10),
        partenerId: doc.partenerId,
        gestiuneId: doc.gestiuneId,
        gestiuneDestinatieId: null,
        punctDeLucruId: doc.punctDeLucruId,
        documentSursaId: doc.id,
        scadenta: null,
        observatii: `Factura pentru comanda ${doc.cod}`,
        stare: 'validat',
        totalNetBani: doc.totalNetBani,
        totalTvaBani: doc.totalTvaBani,
        totalBrutBani: doc.totalBrutBani,
        avansBani: 0,
        meta: '{}',
      });
      const liniiComanda = linii.filter((l) => l.documentId === doc.id);
      for (const l of liniiComanda) {
        await db.documenteLinii.create({
          documentId: factura.id,
          produsId: l.produsId,
          denumire: l.denumire,
          unitateMasura: l.unitateMasura,
          cantitate: l.cantitate,
          pretUnitarBani: l.pretUnitarBani,
          cotaTvaProcent: l.cotaTvaProcent,
          pretIncludeTva: l.pretIncludeTva,
          netBani: l.netBani,
          tvaBani: l.tvaBani,
          brutBani: l.brutBani,
        });
      }
    }

    const metaFinal: ConfiguratieMobila = { ...cfg, stareProductie: next };
    await db.documente.update(doc.id, { meta: JSON.stringify(metaFinal) });
    reload();
    // Reincarca si stocul (miscari/solduri), altfel costul/marja afisate ar
    // ramane cu valoarea veche (0 cost material) pana la un remount al
    // paginii — hook-ul useStoc() nu se resincronizeaza singur cu documentele
    // create in acest handler (bon_consum/aviz/factura).
    reloadStoc();
  };

  /** Marcheaza urmatorul departament neterminat ca finalizat, pentru o comanda in productie. */
  const finalizeazaDepartament = async (doc: Document) => {
    const cfg = parseConfiguratieMobila(doc.meta);
    const urm = urmatorulDepartament(cfg.departamenteFinalizate);
    if (!urm) return;
    const metaFinal: ConfiguratieMobila = {
      ...cfg,
      departamenteFinalizate: [...cfg.departamenteFinalizate, urm],
    };
    await db.documente.update(doc.id, { meta: JSON.stringify(metaFinal) });
    reload();
  };

  const comenziInProductie = comenzi.filter((d) => parseStare(d.meta) === 'in_productie');
  const capacitatePeDepartament = DEPARTAMENTE_PRODUCTIE.map((dep) => ({
    departament: dep,
    comenzi: comenziInProductie.filter(
      (d) => urmatorulDepartament(parseConfiguratieMobila(d.meta).departamenteFinalizate) === dep,
    ).length,
  }));

  return (
    <div>
      <PageHeader title="Productie mobila" subtitle="Fluxul comenzilor pe stari de productie" />
      {comenziInProductie.length > 0 && (
        <Card className="mb-4 p-4">
          <h3 className="mb-3 text-sm font-semibold text-fg">
            Capacitate productie (comenzi in lucru pe departament)
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {capacitatePeDepartament.map(({ departament, comenzi: nr }) => (
              <div key={departament} className="rounded-lg border border-border p-3 text-center">
                <div className="text-2xl font-semibold text-fg">{nr}</div>
                <div className="text-xs text-fg-muted">{ETICHETE_DEPARTAMENT[departament]}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
      {eroare && (
        <div className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-4 py-2.5 text-sm text-danger">
          {eroare}
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {STARI.map((stare) => {
          const list = comenzi.filter((d) => parseStare(d.meta) === stare);
          return (
            <div key={stare} className="rounded-xl border border-border bg-surface">
              <div className="border-b border-border px-3 py-2 text-sm font-medium text-fg">
                {ETICHETE[stare]} <span className="text-fg-muted">({list.length})</span>
              </div>
              <div className="space-y-2 p-2">
                {list.map((d) => {
                  const cost = costComanda(d);
                  const marja = d.totalNetBani - cost;
                  const cfgCard = parseConfiguratieMobila(d.meta);
                  const urmDep =
                    stare === 'in_productie'
                      ? urmatorulDepartament(cfgCard.departamenteFinalizate)
                      : null;
                  return (
                    <div key={d.id} className="rounded-lg border border-border bg-bg p-2.5 text-sm">
                      <div className="font-mono text-xs text-fg-muted">{d.cod}</div>
                      <div className="font-medium text-fg">{partenerNume(d.partenerId)}</div>
                      <div className="text-fg-muted">{fmt.lei(d.totalBrutBani)}</div>
                      {cost > 0 && (
                        <div className={`text-xs ${marja >= 0 ? 'text-success' : 'text-danger'}`}>
                          Marja: {fmt.bani(marja)} (
                          {d.totalNetBani > 0 ? Math.round((marja / d.totalNetBani) * 100) : 0}%)
                        </div>
                      )}
                      {stare === 'in_productie' && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {DEPARTAMENTE_PRODUCTIE.map((dep) => {
                            const done = cfgCard.departamenteFinalizate.includes(dep);
                            return (
                              <span
                                key={dep}
                                className={`rounded px-1.5 py-0.5 text-[10px] ${
                                  done ? 'bg-success/15 text-success' : 'bg-muted text-fg-muted'
                                }`}
                              >
                                {ETICHETE_DEPARTAMENT[dep]}
                              </span>
                            );
                          })}
                        </div>
                      )}
                      <div className="mt-1 flex flex-wrap items-center gap-3">
                        {stare === 'oferta' && (
                          <button
                            type="button"
                            onClick={() =>
                              printHtml(
                                devizHtml(
                                  d,
                                  parseConfiguratieMobila(d.meta),
                                  optiuni,
                                  firmaCurenta,
                                  parteneri.find((p) => p.id === d.partenerId),
                                ),
                              )
                            }
                            className="flex items-center gap-1 text-xs text-fg-muted hover:underline"
                          >
                            <FileText className="h-3 w-3" /> Deviz PDF
                          </button>
                        )}
                        {urmDep && poateAvansa && (
                          <button
                            type="button"
                            onClick={() => finalizeazaDepartament(d)}
                            className="flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            Finalizeaza {ETICHETE_DEPARTAMENT[urmDep]}
                          </button>
                        )}
                        {stare !== 'facturata' && poateAvansa && (
                          <button
                            type="button"
                            onClick={() => avanseaza(d)}
                            className="flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            Avanseaza <ArrowRight className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {list.length === 0 && <p className="px-1 py-2 text-xs text-fg-muted">—</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const ZILE_SAPTAMANA = ['Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sam', 'Dum'];

function isoZi(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function inceputLuna(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function adaugaLuni(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

/** Camp editabil inline (curier/AWB/data montaj) — salveaza doar la blur, ca sa nu piarda focusul la fiecare litera tastata. */
function CampLivrareEditabil({
  value,
  onSave,
  type = 'text',
  placeholder,
}: {
  value: string;
  onSave: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <input
      type={type}
      value={v}
      placeholder={placeholder}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        if (v !== value) onSave(v);
      }}
      className="h-8 w-full min-w-[7rem] rounded border border-border bg-surface px-2 text-xs text-fg"
    />
  );
}

export function LivrariMobilaPage() {
  const db = useData();
  const { rows, reload } = useCollection(db.documente);
  const [parteneri, setParteneri] = useState<Partener[]>([]);
  useEffect(() => {
    db.parteneri.list().then(setParteneri);
  }, [db]);
  const partenerNume = (id: string | null) => parteneri.find((p) => p.id === id)?.denumire ?? '—';
  const comenzi = rows
    .filter((d) => d.tip === 'comanda_mobila' && d.scadenta)
    .sort((a, b) => (a.scadenta ?? '').localeCompare(b.scadenta ?? ''));

  // Citeste documentul PROASPAT (nu cel din closure-ul randului) inainte de
  // fuziune — altfel doua campuri editate rapid unul dupa altul (ex. curier
  // apoi AWB, la blur pe fiecare) s-ar suprascrie reciproc: al doilea salvat
  // ar porni de la un `doc.meta` vechi, capturat inainte ca primul sa se fi
  // aplicat, si i-ar sterge modificarea la re-salvare.
  const actualizeazaLivrare = async (doc: Document, patch: Partial<ConfiguratieMobila>) => {
    const actual = (await db.documente.getById(doc.id)) ?? doc;
    const cfg = parseConfiguratieMobila(actual.meta);
    await db.documente.update(doc.id, { meta: JSON.stringify({ ...cfg, ...patch }) });
    reload();
  };

  const [luna, setLuna] = useState(() => inceputLuna(new Date()));
  const zileLuna = useMemo(() => {
    const start = luna;
    const ultimaZi = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    const inceputSaptamana = (start.getDay() + 6) % 7; // 0 = luni
    const zile: (Date | null)[] = Array.from({ length: inceputSaptamana }, () => null);
    for (let zi = 1; zi <= ultimaZi; zi++)
      zile.push(new Date(start.getFullYear(), start.getMonth(), zi));
    return zile;
  }, [luna]);

  const evenimentePeZi = (zi: Date) => {
    const iso = isoZi(zi);
    return comenzi
      .map((d) => ({ doc: d, cfg: parseConfiguratieMobila(d.meta) }))
      .filter(({ doc, cfg }) => doc.scadenta === iso || cfg.dataMontaj === iso);
  };

  const columns: Column<Document>[] = [
    {
      key: 'scadenta',
      header: 'Termen livrare',
      render: (d) => (
        <span className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-fg-muted" />
          {fmt.data(d.scadenta)}
        </span>
      ),
    },
    { key: 'cod', header: 'Comanda', render: (d) => <span className="font-mono">{d.cod}</span> },
    { key: 'client', header: 'Client', render: (d) => partenerNume(d.partenerId) },
    { key: 'stare', header: 'Stare', render: (d) => <Badge>{ETICHETE[parseStare(d.meta)]}</Badge> },
    {
      key: 'dataMontaj',
      header: 'Data montaj',
      render: (d) => (
        <CampLivrareEditabil
          type="date"
          value={parseConfiguratieMobila(d.meta).dataMontaj ?? ''}
          onSave={(v) => actualizeazaLivrare(d, { dataMontaj: v || null })}
        />
      ),
    },
    {
      key: 'curier',
      header: 'Curier',
      render: (d) => (
        <CampLivrareEditabil
          value={parseConfiguratieMobila(d.meta).curier}
          placeholder="ex. Fan Courier"
          onSave={(v) => actualizeazaLivrare(d, { curier: v })}
        />
      ),
    },
    {
      key: 'awb',
      header: 'AWB',
      render: (d) => (
        <CampLivrareEditabil
          value={parseConfiguratieMobila(d.meta).awb}
          placeholder="Nr. AWB"
          onSave={(v) => actualizeazaLivrare(d, { awb: v })}
        />
      ),
    },
    { key: 'total', header: 'Total', align: 'right', render: (d) => fmt.bani(d.totalBrutBani) },
    {
      key: 'rest',
      header: 'Rest de plata',
      align: 'right',
      render: (d) => (
        <span className="font-medium">{fmt.bani(restDePlata(d.totalBrutBani, d.avansBani))}</span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Planificare livrari"
        subtitle="Comenzi mobila dupa termenul de livrare si montaj"
      />
      <Card className="mb-4 p-4">
        <div className="mb-3 flex items-center justify-between">
          <Button variant="secondary" size="sm" onClick={() => setLuna((l) => adaugaLuni(l, -1))}>
            ←
          </Button>
          <h3 className="font-semibold capitalize text-fg">
            {luna.toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' })}
          </h3>
          <Button variant="secondary" size="sm" onClick={() => setLuna((l) => adaugaLuni(l, 1))}>
            →
          </Button>
        </div>
        <div className="mb-1 grid grid-cols-7 gap-1 text-center text-xs font-medium text-fg-muted">
          {ZILE_SAPTAMANA.map((z) => (
            <div key={z}>{z}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {zileLuna.map((zi, i) =>
            zi ? (
              <div
                key={isoZi(zi)}
                className="min-h-[68px] rounded-lg border border-border p-1 text-xs"
              >
                <div className="mb-1 text-fg-muted">{zi.getDate()}</div>
                {evenimentePeZi(zi).map(({ doc, cfg }) => {
                  const iso = isoZi(zi);
                  const esteLivrare = doc.scadenta === iso;
                  return (
                    <div
                      key={`${doc.id}-${esteLivrare ? 'livrare' : 'montaj'}`}
                      title={`${doc.cod} · ${partenerNume(doc.partenerId)}${cfg.curier ? ` · ${cfg.curier}` : ''}`}
                      className={`mb-0.5 flex items-center gap-1 truncate rounded px-1 py-0.5 ${
                        esteLivrare ? 'bg-primary/10 text-primary' : 'bg-warning/15 text-warning'
                      }`}
                    >
                      {esteLivrare ? (
                        <Truck className="h-3 w-3 shrink-0" />
                      ) : (
                        <Wrench className="h-3 w-3 shrink-0" />
                      )}
                      <span className="truncate">{doc.cod}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              // biome-ignore lint/suspicious/noArrayIndexKey: celule goale de umplutura la inceputul lunii, fara identitate proprie.
              <div key={`gol-${i}`} />
            ),
          )}
        </div>
        <div className="mt-3 flex gap-4 text-xs text-fg-muted">
          <span className="flex items-center gap-1">
            <Truck className="h-3 w-3 text-primary" /> Livrare
          </span>
          <span className="flex items-center gap-1">
            <Wrench className="h-3 w-3 text-warning" /> Montaj
          </span>
        </div>
      </Card>
      <DataTable
        columns={columns}
        rows={comenzi}
        getRowKey={(d) => d.id}
        empty="Nicio livrare planificata."
      />
    </div>
  );
}
