import {
  type DocumentTip,
  type Partener,
  type Produs,
  REGULI_TVA_RO,
  baniToRon,
  calculLinie,
  celMaiRecentBlocaj,
  documentBlocat,
  formateazaCodDocument,
  procentImplicitProdus,
  procentTvaLaData,
  ronToBani,
} from '@gr/core-domain';
import type { Document } from '@gr/core-domain';
import { CheckCircle2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useCollection } from '../hooks/useCollection.js';
import { useAuth } from '../lib/auth-context.js';
import { useConfirm } from '../lib/confirm.js';
import { useData } from '../lib/data-context.js';
import { useFirma } from '../lib/firma-context.js';
import * as fmt from '../lib/format.js';
import { useToast } from '../lib/toast.js';
import { type Column, DataTable } from './DataTable.js';
import { Field, Modal, Select, Textarea } from './controls.js';
import { Badge, Button, Input, PageHeader } from './ui.js';

export interface DocConfig {
  tip: DocumentTip;
  title: string;
  subtitle?: string;
  prefix: string;
  partenerTip?: 'furnizor' | 'client' | null;
  needsGestiune?: boolean;
  needsDestinatie?: boolean;
  isOrder?: boolean;
  retail?: boolean;
  /**
   * Tipul de document sursa la care se poate lega acest document (ex.
   * `factura_cumparare` se leaga de un `receptie_furnizor`/NIR deja validat,
   * pentru 3-way match). Cand e legata, factura nu mai genereaza a doua nota
   * contabila de achizitie — vezi contabilitate.ts.
   */
  linkSursaTip?: DocumentTip;
  linkSursaLabel?: string;
}

interface LineDraft {
  key: string;
  produsId: string | null;
  denumire: string;
  um: string;
  cantitate: number;
  pretRon: number;
  cota: number;
}

const stariTone = {
  ciorna: 'warning',
  aprobat: 'muted',
  validat: 'success',
  stornat: 'muted',
  anulat: 'danger',
} as const;

export function DocumentEditor(cfg: DocConfig) {
  const db = useData();
  const { areVoie } = useAuth();
  const { firme } = useFirma();
  const toast = useToast();
  const confirmDialog = useConfirm();
  // Inchidere de perioada (vezi Firma.perioadaBlocataPanaLa): se aplica
  // NECONDITIONAT, inclusiv pentru admin — se ridica explicit din Setari.
  const blocajGlobal = useMemo(() => celMaiRecentBlocaj(firme), [firme]);
  const documente = useCollection(db.documente);
  const [parteneri, setParteneri] = useState<Partener[]>([]);
  const [produse, setProduse] = useState<Produs[]>([]);
  const [gestiuni, setGestiuni] = useState<{ id: string; cod: string; denumire: string }[]>([]);

  useEffect(() => {
    db.parteneri.list().then(setParteneri);
    db.produse.list().then((p) => setProduse(p));
    db.gestiuni
      .list()
      .then((g) => setGestiuni(g.map((x) => ({ id: x.id, cod: x.cod, denumire: x.denumire }))));
  }, [db]);

  const docs = useMemo(
    () =>
      documente.rows.filter((d) => d.tip === cfg.tip).sort((a, b) => b.data.localeCompare(a.data)),
    [documente.rows, cfg.tip],
  );

  const partenerOptions = useMemo(() => {
    const list = cfg.partenerTip
      ? parteneri.filter((p) => p.tip === cfg.partenerTip || p.tip === 'ambele')
      : parteneri;
    return [
      { value: '', label: '— selecteaza —' },
      ...list.map((p) => ({ value: p.id, label: p.denumire })),
    ];
  }, [parteneri, cfg.partenerTip]);
  const gestiuneOptions = useMemo(
    () => [
      { value: '', label: '— selecteaza —' },
      ...gestiuni.map((g) => ({ value: g.id, label: `${g.cod} · ${g.denumire}` })),
    ],
    [gestiuni],
  );
  const partenerNume = (id: string | null) => parteneri.find((p) => p.id === id)?.denumire ?? '—';

  // --- formular document ---
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [dataDoc, setDataDoc] = useState('');
  const [partenerId, setPartenerId] = useState('');
  const [gestiuneId, setGestiuneId] = useState('');
  const [gestiuneDestinatieId, setGestiuneDestinatieId] = useState('');
  const [scadenta, setScadenta] = useState('');
  const [observatii, setObservatii] = useState('');
  const [avansRon, setAvansRon] = useState(0);
  const [linii, setLinii] = useState<LineDraft[]>([]);
  const [documentSursaId, setDocumentSursaId] = useState('');
  /** Anul alocarii ORIGINALE (numerotare atomica) — imutabil la editare, ca sa
   * nu amestecam un an nou (din dataDoc schimbata) cu un numar alocat sub anul vechi. */
  const [anOriginal, setAnOriginal] = useState<number | null>(null);

  // documente.rows contine deja TOATE documentele (nu doar cfg.tip) — nicio
  // cerere separata catre server nu e necesara, doar o filtrare locala.
  const documenteSursa = useMemo(
    () =>
      cfg.linkSursaTip
        ? documente.rows.filter((d) => d.tip === cfg.linkSursaTip && d.stare === 'validat')
        : [],
    [cfg.linkSursaTip, documente.rows],
  );

  const reset = () => {
    setEditId(null);
    setAnOriginal(null);
    setDataDoc(new Date().toISOString().slice(0, 10));
    setPartenerId('');
    setGestiuneId(gestiuni[0]?.id ?? '');
    setGestiuneDestinatieId('');
    setScadenta('');
    setObservatii('');
    setAvansRon(0);
    setLinii([]);
    setDocumentSursaId('');
  };

  const openNew = () => {
    reset();
    setOpen(true);
  };

  const openEdit = async (doc: Document) => {
    if (documentBlocat(doc.data, blocajGlobal)) {
      toast.error(
        `Perioada este inchisa pana la ${blocajGlobal} — documentul din ${doc.data} nu mai poate fi editat.`,
      );
      return;
    }
    if (doc.stare === 'validat') {
      if (!areVoie('documente.validare')) {
        toast.error(
          'Documentul e validat. Doar un utilizator cu drept de validare il poate redeschide pentru editare.',
        );
        return;
      }
      const ok = await confirmDialog({
        title: 'Redeschide documentul validat',
        message:
          'Documentul e validat. Il redeschizi ca ciorna pentru editare? Va trebui revalidat dupa.',
        confirmLabel: 'Redeschide',
        danger: true,
      });
      if (!ok) return;
    }
    setEditId(doc.id);
    setAnOriginal(new Date(doc.data).getFullYear());
    setDataDoc(doc.data);
    setPartenerId(doc.partenerId ?? '');
    setGestiuneId(doc.gestiuneId ?? '');
    setGestiuneDestinatieId(doc.gestiuneDestinatieId ?? '');
    setScadenta(doc.scadenta ?? '');
    setObservatii(doc.observatii);
    setAvansRon(baniToRon(doc.avansBani));
    setDocumentSursaId(doc.documentSursaId ?? '');
    const allLines = await db.documenteLinii.list();
    setLinii(
      allLines
        .filter((l) => l.documentId === doc.id)
        .map((l) => ({
          key: l.id,
          produsId: l.produsId,
          denumire: l.denumire,
          um: l.unitateMasura,
          cantitate: l.cantitate,
          pretRon: baniToRon(l.pretUnitarBani),
          cota: l.cotaTvaProcent,
        })),
    );
    setOpen(true);
  };

  const addLine = () =>
    setLinii((ls) => [
      ...ls,
      {
        key: crypto.randomUUID(),
        produsId: null,
        denumire: '',
        um: 'buc',
        cantitate: 1,
        pretRon: 0,
        // Linie manuala noua: cota standard rezolvata la data documentului
        // (21% azi, 19% istoric) — NU un 19% hardcodat.
        cota: cotaStandardImplicita(),
      },
    ]);
  const removeLine = (key: string) => setLinii((ls) => ls.filter((l) => l.key !== key));
  const updateLine = (key: string, patch: Partial<LineDraft>) =>
    setLinii((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  // Data de rezolvare a TVA: data documentului, sau azi daca inca nu e setata.
  const dataRezolvareTva = () =>
    dataDoc && dataDoc.length >= 10 ? dataDoc : new Date().toISOString().slice(0, 10);
  // Cota standard rezolvata la data documentului (21% azi, 19% istoric) — NU un
  // 19% hardcodat. Fallback la 0 doar daca rezolvarea esueaza (nu ar trebui).
  const cotaStandardImplicita = () => {
    try {
      return procentTvaLaData(REGULI_TVA_RO, {
        data: dataRezolvareTva(),
        codCategorieFiscala: 'standard',
      });
    } catch {
      return 0;
    }
  };

  const onPickProdus = (key: string, produsId: string) => {
    const p = produse.find((x) => x.id === produsId);
    if (!p) return updateLine(key, { produsId: null });
    // Cota AUTORITARA: rezolvata din categoria fiscala a produsului + data
    // documentului (motorul temporal). Pentru un produs necategorizat / fara
    // regula, cadem pe indiciul legacy al produsului, apoi pe cota standard.
    let cota: number;
    try {
      cota = procentImplicitProdus(p, dataRezolvareTva());
    } catch {
      cota = p.cotaTvaProcent ?? cotaStandardImplicita();
    }
    updateLine(key, {
      produsId: p.id,
      denumire: p.denumire,
      um: p.unitateMasura,
      cota,
      pretRon: baniToRon(p.pretVanzareBani),
    });
  };

  const calcLine = (l: LineDraft) =>
    calculLinie({
      cantitate: l.cantitate,
      pretUnitarBani: ronToBani(l.pretRon),
      cotaTvaProcent: l.cota,
      pretIncludeTva: Boolean(cfg.retail),
    });
  const totaluri = useMemo(() => {
    return linii.reduce(
      (acc, l) => {
        const r = calculLinie({
          cantitate: l.cantitate,
          pretUnitarBani: ronToBani(l.pretRon),
          cotaTvaProcent: l.cota,
          pretIncludeTva: Boolean(cfg.retail),
        });
        acc.net += r.netBani;
        acc.tva += r.tvaBani;
        acc.brut += r.brutBani;
        return acc;
      },
      { net: 0, tva: 0, brut: 0 },
    );
  }, [linii, cfg.retail]);

  const save = async (valideaza: boolean) => {
    try {
      // Documentul existent (la editare) — pastram campurile pe care acest
      // ecran generic NU le expune in formular (meta, documentSursaId cand nu
      // exista picker), ca sa nu le stergem silentios la fiecare salvare. Ex.:
      // o comanda_mobila are in `meta` configuratia + starea de productie,
      // scrise de Configurator/ProductieMobilaPage — un "Document nou"/"Salveaza"
      // generic de aici nu are cum sa le cunoasca, deci nu trebuie sa le resteze.
      const existent = editId ? docs.find((d) => d.id === editId) : undefined;

      // Documentele noi primesc numarul dintr-un alocator ATOMIC (db.numerotare),
      // nu dintr-un calcul local "maxim existent + 1" — acela ar putea produce
      // duplicate sub concurenta sau coliziuni dupa stergerea unui document.
      let numar: number;
      let cod: string;
      if (editId) {
        // Anul folosit la formatarea codului ramane cel din alocarea ORIGINALA
        // (anOriginal), nu recalculat din dataDoc — altfel schimbarea datei peste
        // un an nou ar produce un cod (ex. FCT-2026-000003) care nu corespunde
        // niciunei alocari atomice reale pentru anul respectiv.
        const an = anOriginal ?? (new Date(dataDoc).getFullYear() || new Date().getFullYear());
        numar = docsNumar(editId);
        cod = formateazaCodDocument({ prefix: cfg.prefix, an, lungimeNumar: 6 }, numar);
      } else {
        const an = new Date(dataDoc).getFullYear() || new Date().getFullYear();
        const alocat = await db.numerotare.next(cfg.tip, an, cfg.prefix, 6);
        numar = alocat.numar;
        cod = alocat.cod;
      }

      const docInput = {
        tip: cfg.tip,
        serie: cfg.prefix,
        numar,
        cod,
        data: dataDoc,
        partenerId: partenerId || null,
        gestiuneId: gestiuneId || null,
        gestiuneDestinatieId: gestiuneDestinatieId || null,
        punctDeLucruId: null,
        documentSursaId: cfg.linkSursaTip
          ? documentSursaId || null
          : (existent?.documentSursaId ?? null),
        scadenta: scadenta || null,
        observatii,
        stare: valideaza ? ('validat' as const) : ('ciorna' as const),
        totalNetBani: totaluri.net,
        totalTvaBani: totaluri.tva,
        totalBrutBani: totaluri.brut,
        avansBani: cfg.isOrder ? ronToBani(avansRon) : 0,
        meta: existent?.meta ?? '{}',
      };

      // Liniile existente (la editare) sunt actualizate pe loc cand cheia lor
      // (l.key = id-ul original) se regaseste inca in formular, in loc de
      // sterge-tot-si-recreeaza — altfel fiecare editare minora ar genera in
      // jurnalul de audit o pereche stergere+creare pentru fiecare linie
      // neschimbata.
      let docId = editId;
      let idLiniiExistente = new Set<string>();
      if (editId) {
        await db.documente.update(editId, docInput);
        const existing = (await db.documenteLinii.list()).filter((l) => l.documentId === editId);
        idLiniiExistente = new Set(existing.map((l) => l.id));
        const cheiCurente = new Set(linii.map((l) => l.key));
        for (const l of existing) if (!cheiCurente.has(l.id)) await db.documenteLinii.remove(l.id);
      } else {
        const created = await db.documente.create(docInput);
        docId = created.id;
      }

      for (const l of linii) {
        const r = calcLine(l);
        const linieInput = {
          documentId: docId!,
          produsId: l.produsId,
          denumire: l.denumire || 'Articol',
          unitateMasura: l.um,
          cantitate: l.cantitate,
          pretUnitarBani: ronToBani(l.pretRon),
          cotaTvaProcent: l.cota,
          pretIncludeTva: Boolean(cfg.retail),
          netBani: r.netBani,
          tvaBani: r.tvaBani,
          brutBani: r.brutBani,
        };
        if (idLiniiExistente.has(l.key)) await db.documenteLinii.update(l.key, linieInput);
        else await db.documenteLinii.create(linieInput);
      }

      setOpen(false);
      documente.reload();
      toast.success(valideaza ? 'Documentul a fost validat.' : 'Ciorna a fost salvata.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Salvarea documentului a esuat.');
    }
  };

  const nextNumar = () => docs.reduce((m, d) => Math.max(m, d.numar), 0) + 1;
  const docsNumar = (id: string) => docs.find((d) => d.id === id)?.numar ?? nextNumar();

  const valideaza = async (doc: Document) => {
    if (!areVoie('documente.validare'))
      return toast.error('Nu ai drept de validare a documentelor.');
    if (documentBlocat(doc.data, blocajGlobal)) {
      return toast.error(
        `Perioada este inchisa pana la ${blocajGlobal} — documentul din ${doc.data} nu mai poate fi validat.`,
      );
    }
    try {
      await db.documente.update(doc.id, { stare: 'validat' });
      documente.reload();
      toast.success(`Documentul ${doc.cod} a fost validat.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Validarea documentului a esuat.');
    }
  };
  const sterge = async (doc: Document) => {
    if (!areVoie('documente.validare'))
      return toast.error('Nu ai drept de stergere a documentelor.');
    if (documentBlocat(doc.data, blocajGlobal)) {
      return toast.error(
        `Perioada este inchisa pana la ${blocajGlobal} — documentul din ${doc.data} nu mai poate fi sters.`,
      );
    }
    const ok = await confirmDialog({
      title: 'Sterge documentul',
      message: `Sigur stergi documentul ${doc.cod || '(ciorna)'}? Actiunea nu poate fi anulata.`,
      confirmLabel: 'Sterge',
      danger: true,
    });
    if (!ok) return;
    try {
      const existing = (await db.documenteLinii.list()).filter((l) => l.documentId === doc.id);
      for (const l of existing) await db.documenteLinii.remove(l.id);
      await db.documente.remove(doc.id);
      documente.reload();
      toast.success(`Documentul ${doc.cod || ''} a fost sters.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Stergerea documentului a esuat.');
    }
  };

  const columns: Column<Document>[] = [
    {
      key: 'cod',
      header: 'Document',
      render: (d) => <span className="font-mono font-medium">{d.cod || '(ciorna)'}</span>,
    },
    { key: 'data', header: 'Data', render: (d) => fmt.data(d.data) },
    { key: 'partener', header: 'Partener', render: (d) => partenerNume(d.partenerId) },
    { key: 'net', header: 'Net', align: 'right', render: (d) => fmt.bani(d.totalNetBani) },
    { key: 'tva', header: 'TVA', align: 'right', render: (d) => fmt.bani(d.totalTvaBani) },
    {
      key: 'brut',
      header: 'Total',
      align: 'right',
      render: (d) => <span className="font-medium">{fmt.bani(d.totalBrutBani)}</span>,
    },
    {
      key: 'stare',
      header: 'Stare',
      render: (d) => <Badge tone={stariTone[d.stare]}>{d.stare}</Badge>,
    },
  ];

  return (
    <div>
      <PageHeader
        title={cfg.title}
        subtitle={cfg.subtitle}
        actions={
          <Button onClick={openNew}>
            <Plus className="h-4 w-4" />
            Document nou
          </Button>
        }
      />

      <DataTable
        columns={columns}
        rows={docs}
        getRowKey={(d) => d.id}
        empty="Niciun document. Creeaza primul document."
        loading={documente.loading}
        actions={(d) => (
          <div className="flex justify-end gap-1">
            {d.stare === 'ciorna' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => valideaza(d)}
                title="Valideaza"
                aria-label="Valideaza documentul"
              >
                <CheckCircle2 className="h-4 w-4 text-success" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openEdit(d)}
              title="Editeaza"
              aria-label="Editeaza documentul"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            {areVoie('documente.validare') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => sterge(d)}
                title="Sterge"
                aria-label="Sterge documentul"
              >
                <Trash2 className="h-4 w-4 text-danger" />
              </Button>
            )}
          </div>
        )}
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        wide
        title={editId ? 'Editeaza document' : cfg.title}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Renunta
            </Button>
            <Button variant="secondary" onClick={() => save(false)}>
              Salveaza ciorna
            </Button>
            <Button onClick={() => save(true)}>Valideaza</Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Data">
            <Input type="date" value={dataDoc} onChange={(e) => setDataDoc(e.target.value)} />
          </Field>
          {cfg.partenerTip !== null && (
            <Field label={cfg.partenerTip === 'furnizor' ? 'Furnizor' : 'Client'}>
              <Select
                options={partenerOptions}
                value={partenerId}
                onChange={(e) => setPartenerId(e.target.value)}
              />
            </Field>
          )}
          {cfg.needsGestiune && (
            <Field label={cfg.needsDestinatie ? 'Gestiune sursa' : 'Gestiune'}>
              <Select
                options={gestiuneOptions}
                value={gestiuneId}
                onChange={(e) => setGestiuneId(e.target.value)}
              />
            </Field>
          )}
          {cfg.linkSursaTip && (
            <Field label={cfg.linkSursaLabel ?? 'Document sursa (NIR)'}>
              <Select
                options={[
                  { value: '', label: '— fara legatura —' },
                  ...documenteSursa.map((d) => ({
                    value: d.id,
                    label: `${d.cod} · ${partenerNume(d.partenerId)}`,
                  })),
                ]}
                value={documentSursaId}
                onChange={(e) => setDocumentSursaId(e.target.value)}
              />
            </Field>
          )}
          {cfg.needsDestinatie && (
            <Field label="Gestiune destinatie">
              <Select
                options={gestiuneOptions}
                value={gestiuneDestinatieId}
                onChange={(e) => setGestiuneDestinatieId(e.target.value)}
              />
            </Field>
          )}
          <Field label="Scadenta">
            <Input type="date" value={scadenta} onChange={(e) => setScadenta(e.target.value)} />
          </Field>
          {cfg.isOrder && (
            <Field label="Avans (RON)">
              <Input
                type="number"
                step="0.01"
                value={avansRon}
                onChange={(e) => setAvansRon(Number(e.target.value))}
              />
            </Field>
          )}
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-fg">Linii document</h3>
            <Button variant="secondary" size="sm" onClick={addLine}>
              <Plus className="h-4 w-4" /> Adauga linie
            </Button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-fg-muted">
                  <th className="px-3 py-2 font-medium">Produs</th>
                  <th className="px-3 py-2 font-medium">UM</th>
                  <th className="px-3 py-2 text-right font-medium">Cant.</th>
                  <th className="px-3 py-2 text-right font-medium">Pret</th>
                  <th className="px-3 py-2 text-right font-medium">TVA%</th>
                  <th className="px-3 py-2 text-right font-medium">Valoare</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {linii.map((l) => {
                  const r = calcLine(l);
                  return (
                    <tr key={l.key} className="border-b border-border/60 last:border-0">
                      <td className="px-3 py-2">
                        <Select
                          className="h-9"
                          options={[
                            { value: '', label: '— produs —' },
                            ...produse.map((p) => ({
                              value: p.id,
                              label: `${p.cod} · ${p.denumire}`,
                            })),
                          ]}
                          value={l.produsId ?? ''}
                          onChange={(e) => onPickProdus(l.key, e.target.value)}
                        />
                      </td>
                      <td className="px-3 py-2 text-fg-muted">{l.um}</td>
                      <td className="px-3 py-2">
                        <Input
                          className="h-9 w-20 text-right"
                          type="number"
                          step="any"
                          value={l.cantitate}
                          onChange={(e) => updateLine(l.key, { cantitate: Number(e.target.value) })}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          className="h-9 w-24 text-right"
                          type="number"
                          step="0.01"
                          value={l.pretRon}
                          onChange={(e) => updateLine(l.key, { pretRon: Number(e.target.value) })}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          className="h-9 w-16 text-right"
                          type="number"
                          value={l.cota}
                          onChange={(e) => updateLine(l.key, { cota: Number(e.target.value) })}
                        />
                      </td>
                      <td className="px-3 py-2 text-right font-medium">{fmt.bani(r.brutBani)}</td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeLine(l.key)}
                          title="Sterge linia"
                          aria-label="Sterge linia"
                        >
                          <Trash2 className="h-4 w-4 text-danger" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {linii.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-fg-muted">
                      Nicio linie. Apasa „Adauga linie".
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex justify-end">
            <div className="w-64 space-y-1 text-sm">
              <Row label="Total net" value={fmt.bani(totaluri.net)} />
              <Row label="Total TVA" value={fmt.bani(totaluri.tva)} />
              <Row label="Total document" value={fmt.lei(totaluri.brut)} strong />
              {cfg.isOrder && (
                <Row
                  label="Rest de plata"
                  value={fmt.lei(Math.max(0, totaluri.brut - ronToBani(avansRon)))}
                />
              )}
            </div>
          </div>
        </div>

        <Field label="Observatii" className="mt-4">
          <Textarea value={observatii} onChange={(e) => setObservatii(e.target.value)} />
        </Field>
      </Modal>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      className={`flex justify-between ${strong ? 'border-t border-border pt-1 font-semibold text-fg' : 'text-fg-muted'}`}
    >
      <span>{label}</span>
      <span className={strong ? 'text-fg' : 'text-fg'}>{value}</span>
    </div>
  );
}
