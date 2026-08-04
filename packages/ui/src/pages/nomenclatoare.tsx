import type {
  Firma,
  Gestiune,
  GrupaProdus,
  ListaPret,
  ObiectInventar,
  Partener,
  Personal,
  PlanCont,
  Produs,
  PunctLucru,
  TipConsum,
} from '@gr/core-domain';
import { cuiValid } from '@gr/fiscal-ro';
import { useMemo } from 'react';
import { type Column, EntityGrid, type FieldDef } from '../components/index.js';
import { Badge } from '../components/ui.js';
import { useOptions } from '../hooks/useOptions.js';
import { useData } from '../lib/data-context.js';
import * as fmt from '../lib/format.js';

export function FirmaPage() {
  const repo = useData().firme;
  const columns: Column<Firma>[] = [
    {
      key: 'cod',
      header: 'Cod',
      render: (r) => <span className="font-mono font-medium">{r.cod}</span>,
    },
    { key: 'denumire', header: 'Denumire' },
    {
      key: 'cui',
      header: 'CUI',
      render: (r) =>
        r.cui ? (
          <span className="flex items-center gap-1.5">
            {r.cui}
            {cuiValid(r.cui) ? <Badge tone="success">✓</Badge> : <Badge tone="danger">!</Badge>}
          </span>
        ) : (
          '—'
        ),
    },
    { key: 'localitate', header: 'Localitate' },
    {
      key: 'activa',
      header: 'Activa',
      render: (r) => (
        <Badge tone={r.activa ? 'success' : 'muted'}>{r.activa ? 'Activa' : 'Inactiva'}</Badge>
      ),
    },
  ];
  const fields: FieldDef[] = [
    { name: 'cod', label: 'Cod', type: 'text' },
    { name: 'denumire', label: 'Denumire', type: 'text', full: true },
    { name: 'cui', label: 'CUI', type: 'text' },
    { name: 'registruComert', label: 'Reg. comert', type: 'text' },
    { name: 'adresa', label: 'Adresa', type: 'text', full: true },
    { name: 'judet', label: 'Judet', type: 'text' },
    { name: 'localitate', label: 'Localitate', type: 'text' },
    { name: 'iban', label: 'IBAN', type: 'text' },
    { name: 'banca', label: 'Banca', type: 'text' },
    { name: 'activa', label: 'Activa', type: 'checkbox' },
  ];
  return (
    <EntityGrid<Firma>
      title="Firme"
      subtitle="Firmele (persoane juridice) gestionate din aceasta instalare"
      labelSingular="firma"
      repo={repo}
      columns={columns}
      fields={fields}
      defaults={{
        cod: '',
        denumire: '',
        cui: '',
        registruComert: '',
        adresa: '',
        judet: '',
        localitate: '',
        iban: '',
        banca: '',
        activa: true,
      }}
    />
  );
}

export function ParteneriPage() {
  const repo = useData().parteneri;
  const columns: Column<Partener>[] = [
    { key: 'denumire', header: 'Denumire' },
    {
      key: 'cui',
      header: 'CUI',
      render: (r) =>
        r.cui ? (
          <span className="flex items-center gap-1.5">
            {r.cui}
            {cuiValid(r.cui) ? <Badge tone="success">✓</Badge> : <Badge tone="danger">!</Badge>}
          </span>
        ) : (
          '—'
        ),
    },
    {
      key: 'tip',
      header: 'Tip',
      render: (r) => <Badge tone={r.tip === 'furnizor' ? 'warning' : 'success'}>{r.tip}</Badge>,
    },
    { key: 'cnp', header: 'CNP (persoana fizica)', render: (r) => r.cnp ?? '—' },
    { key: 'localitate', header: 'Localitate' },
    { key: 'telefon', header: 'Telefon' },
    { key: 'activ', header: 'Activ', render: (r) => (r.activ ? 'Da' : 'Nu') },
  ];
  const fields: FieldDef[] = [
    { name: 'denumire', label: 'Denumire', type: 'text', full: true },
    {
      name: 'tip',
      label: 'Tip',
      type: 'select',
      options: [
        { value: 'client', label: 'Client' },
        { value: 'furnizor', label: 'Furnizor' },
        { value: 'ambele', label: 'Ambele' },
      ],
    },
    { name: 'cui', label: 'CUI', type: 'text', nullable: true },
    {
      name: 'cnp',
      label: 'CNP (client persoana fizica, fara CUI — e-Factura B2C)',
      type: 'text',
      nullable: true,
    },
    { name: 'registruComert', label: 'Reg. comert', type: 'text', nullable: true },
    { name: 'adresa', label: 'Adresa', type: 'text', full: true },
    { name: 'judet', label: 'Judet', type: 'text' },
    { name: 'localitate', label: 'Localitate', type: 'text' },
    { name: 'tara', label: 'Tara (cod ISO, ex. RO, DE) — pentru D390', type: 'text' },
    {
      name: 'codTvaIntracomunitar',
      label: 'Cod TVA intracomunitar (doar UE)',
      type: 'text',
      nullable: true,
    },
    { name: 'iban', label: 'IBAN', type: 'text', nullable: true },
    { name: 'banca', label: 'Banca', type: 'text' },
    { name: 'telefon', label: 'Telefon', type: 'text' },
    { name: 'email', label: 'Email', type: 'text', nullable: true },
    { name: 'platitorTva', label: 'Platitor TVA', type: 'checkbox' },
    { name: 'activ', label: 'Activ', type: 'checkbox' },
  ];
  return (
    <EntityGrid
      title="Parteneri"
      subtitle="Furnizori si clienti"
      labelSingular="partener"
      repo={repo}
      columns={columns}
      fields={fields}
      defaults={{
        tip: 'client',
        denumire: '',
        platitorTva: true,
        activ: true,
        adresa: '',
        judet: '',
        localitate: '',
        tara: 'RO',
        codTvaIntracomunitar: null,
        banca: '',
        telefon: '',
      }}
    />
  );
}

export function PuncteLucruPage() {
  const repo = useData().puncteLucru;
  return (
    <EntityGrid<PunctLucru>
      title="Puncte de lucru"
      subtitle="Locatiile firmei"
      labelSingular="punct de lucru"
      repo={repo}
      columns={[
        { key: 'cod', header: 'Cod' },
        { key: 'denumire', header: 'Denumire' },
        { key: 'adresa', header: 'Adresa' },
        { key: 'activ', header: 'Activ', render: (r) => (r.activ ? 'Da' : 'Nu') },
      ]}
      fields={[
        { name: 'cod', label: 'Cod', type: 'text' },
        { name: 'denumire', label: 'Denumire', type: 'text', full: true },
        { name: 'adresa', label: 'Adresa', type: 'text', full: true },
        { name: 'activ', label: 'Activ', type: 'checkbox' },
      ]}
      defaults={{ cod: '', denumire: '', adresa: '', activ: true }}
    />
  );
}

export function GestiuniPage() {
  const repo = useData().gestiuni;
  const puncte = useOptions(useData().puncteLucru, (p) => p.denumire);
  return (
    <EntityGrid<Gestiune>
      title="Gestiuni"
      subtitle="Locuri de stocare si gestionari"
      labelSingular="gestiune"
      repo={repo}
      columns={[
        {
          key: 'cod',
          header: 'Cod',
          render: (r) => <span className="font-mono font-medium">{r.cod}</span>,
        },
        { key: 'denumire', header: 'Denumire' },
        { key: 'gestionar', header: 'Gestionar', render: (r) => r.gestionar || '—' },
        {
          key: 'cont',
          header: 'Cont',
          render: (r) => (
            <span className="font-mono text-fg-muted">
              {r.contSintetic}
              {r.contAnalitic ? ` / ${r.contAnalitic}` : ''}
            </span>
          ),
        },
        {
          key: 'tip',
          header: 'Tip',
          render: (r) => (r.tip === 'global_valorica' ? 'Global-valorica' : 'Cantitativ-valorica'),
        },
        {
          key: 'activ',
          header: 'Status',
          render: (r) => (
            <Badge tone={r.activ ? 'success' : 'muted'}>{r.activ ? 'Activ' : 'Inactiv'}</Badge>
          ),
        },
      ]}
      fields={[
        { name: 'cod', label: 'Cod', type: 'text' },
        { name: 'denumire', label: 'Denumire', type: 'text', full: true },
        { name: 'gestionar', label: 'Gestionar', type: 'text' },
        { name: 'contSintetic', label: 'Cont sintetic', type: 'text' },
        { name: 'contAnalitic', label: 'Cont analitic', type: 'text' },
        {
          name: 'tip',
          label: 'Tip',
          type: 'select',
          options: [
            { value: 'cantitativ_valorica', label: 'Cantitativ-valorica' },
            { value: 'global_valorica', label: 'Global-valorica' },
          ],
        },
        {
          name: 'punctDeLucruId',
          label: 'Punct de lucru',
          type: 'select',
          options: puncte,
          nullable: true,
        },
        { name: 'activ', label: 'Activ', type: 'checkbox' },
      ]}
      defaults={{
        cod: '',
        denumire: '',
        gestionar: '',
        contSintetic: '',
        contAnalitic: '',
        tip: 'cantitativ_valorica',
        activ: true,
      }}
    />
  );
}

function produsFields(grupe: { value: string; label: string }[]): FieldDef[] {
  return [
    { name: 'cod', label: 'Cod', type: 'text' },
    { name: 'denumire', label: 'Denumire', type: 'text', full: true },
    {
      name: 'tip',
      label: 'Tip',
      type: 'select',
      options: [
        { value: 'marfa', label: 'Marfa' },
        { value: 'material', label: 'Material' },
        { value: 'produs_finit', label: 'Produs finit' },
        { value: 'serviciu', label: 'Serviciu' },
        { value: 'obiect_inventar', label: 'Obiect de inventar' },
      ],
    },
    { name: 'unitateMasura', label: 'UM', type: 'text' },
    {
      name: 'codCategorieFiscala',
      label: 'Categorie fiscala (TVA)',
      type: 'select',
      options: [
        { value: 'standard', label: 'Standard (21% de la 08.2025)' },
        { value: 'redus_9', label: 'Redusa (fost 9% → 11%)' },
        { value: 'redus_5', label: 'Redusa (fost 5% → 11%)' },
        { value: 'scutit', label: 'Scutit (0%)' },
        { value: 'necategorizat', label: 'Necategorizat (necesita clasificare)' },
      ],
    },
    { name: 'grupaId', label: 'Grupa', type: 'select', options: grupe, nullable: true },
    { name: 'pretVanzareBani', label: 'Pret vanzare', type: 'money' },
    { name: 'stocMinim', label: 'Stoc minim', type: 'number' },
    { name: 'codBare', label: 'Cod de bare', type: 'text', nullable: true },
    { name: 'activ', label: 'Activ', type: 'checkbox' },
  ];
}

function produsColumns(): Column<Produs>[] {
  return [
    { key: 'cod', header: 'Cod', render: (r) => <span className="font-mono">{r.cod}</span> },
    { key: 'denumire', header: 'Denumire' },
    { key: 'unitateMasura', header: 'UM' },
    {
      key: 'codCategorieFiscala',
      header: 'Categorie TVA',
      render: (r) => r.codCategorieFiscala,
    },
    {
      key: 'pretVanzareBani',
      header: 'Pret vanzare',
      align: 'right',
      render: (r) => fmt.bani(r.pretVanzareBani),
    },
    { key: 'activ', header: 'Activ', render: (r) => (r.activ ? 'Da' : 'Nu') },
  ];
}

export function CatalogMaterialePage() {
  const repo = useData().produse;
  const grupe = useOptions(useData().grupeProduse, (g) => g.denumire);
  return (
    <EntityGrid<Produs>
      title="Catalog de materiale"
      subtitle="Materii prime si materiale"
      labelSingular="material"
      repo={repo}
      filter={(r) => r.tip === 'material' || r.tip === 'produs_finit'}
      columns={produsColumns()}
      fields={produsFields(grupe)}
      defaults={{
        tip: 'material',
        cod: '',
        denumire: '',
        unitateMasura: 'buc',
        codCategorieFiscala: 'standard',
        pretVanzareBani: 0,
        stocMinim: 0,
        activ: true,
      }}
    />
  );
}

export function CatalogMarfuriPage() {
  const repo = useData().produse;
  const grupe = useOptions(useData().grupeProduse, (g) => g.denumire);
  return (
    <EntityGrid<Produs>
      title="Catalog de marfuri"
      subtitle="Marfuri si servicii"
      labelSingular="marfa"
      repo={repo}
      filter={(r) => r.tip === 'marfa' || r.tip === 'serviciu'}
      columns={produsColumns()}
      fields={produsFields(grupe)}
      defaults={{
        tip: 'marfa',
        cod: '',
        denumire: '',
        unitateMasura: 'buc',
        codCategorieFiscala: 'standard',
        pretVanzareBani: 0,
        stocMinim: 0,
        activ: true,
      }}
    />
  );
}

export function GrupeProdusePage() {
  const repo = useData().grupeProduse;
  const grupe = useOptions(useData().grupeProduse, (g) => g.denumire);
  return (
    <EntityGrid<GrupaProdus>
      title="Grupe de produse"
      subtitle="Grupe de marfuri si materiale"
      labelSingular="grupa"
      repo={repo}
      columns={[
        { key: 'cod', header: 'Cod' },
        { key: 'denumire', header: 'Denumire' },
      ]}
      fields={[
        { name: 'cod', label: 'Cod', type: 'text' },
        { name: 'denumire', label: 'Denumire', type: 'text', full: true },
        {
          name: 'parinteId',
          label: 'Grupa parinte',
          type: 'select',
          options: grupe,
          nullable: true,
        },
      ]}
      defaults={{ cod: '', denumire: '', parinteId: null }}
    />
  );
}

export function PlanConturiPage() {
  const repo = useData().planConturi;
  return (
    <EntityGrid<PlanCont>
      title="Planul de conturi"
      subtitle="Conturi contabile"
      labelSingular="cont"
      repo={repo}
      columns={[
        {
          key: 'simbol',
          header: 'Simbol',
          render: (r) => <span className="font-mono font-medium">{r.simbol}</span>,
        },
        { key: 'denumire', header: 'Denumire' },
        { key: 'clasa', header: 'Clasa', align: 'right' },
        { key: 'tip', header: 'Tip' },
      ]}
      fields={[
        { name: 'simbol', label: 'Simbol', type: 'text' },
        { name: 'denumire', label: 'Denumire', type: 'text', full: true },
        { name: 'clasa', label: 'Clasa', type: 'number' },
        {
          name: 'tip',
          label: 'Tip',
          type: 'select',
          options: [
            { value: 'sintetic', label: 'Sintetic' },
            { value: 'analitic', label: 'Analitic' },
          ],
        },
      ]}
      defaults={{ simbol: '', denumire: '', clasa: 3, tip: 'sintetic' }}
    />
  );
}

export function PersonalPage() {
  const repo = useData().personal;
  return (
    <EntityGrid<Personal>
      title="Personal"
      subtitle="Angajati si gestionari"
      labelSingular="angajat"
      repo={repo}
      columns={[
        { key: 'marca', header: 'Marca' },
        { key: 'nume', header: 'Nume' },
        { key: 'functie', header: 'Functie' },
        { key: 'gestionar', header: 'Gestionar', render: (r) => (r.gestionar ? 'Da' : 'Nu') },
        { key: 'activ', header: 'Activ', render: (r) => (r.activ ? 'Da' : 'Nu') },
      ]}
      fields={[
        { name: 'marca', label: 'Marca', type: 'text' },
        { name: 'nume', label: 'Nume', type: 'text', full: true },
        { name: 'functie', label: 'Functie', type: 'text' },
        { name: 'cnp', label: 'CNP', type: 'text', nullable: true },
        { name: 'gestionar', label: 'Gestionar', type: 'checkbox' },
        { name: 'activ', label: 'Activ', type: 'checkbox' },
      ]}
      defaults={{ marca: '', nume: '', functie: '', gestionar: false, activ: true }}
    />
  );
}

export function TipConsumPage() {
  const repo = useData().tipuriConsum;
  return (
    <EntityGrid<TipConsum>
      title="Tip consum"
      subtitle="Tipuri de consum pentru bonuri"
      labelSingular="tip consum"
      repo={repo}
      columns={[
        { key: 'cod', header: 'Cod' },
        { key: 'denumire', header: 'Denumire' },
        { key: 'cont', header: 'Cont' },
      ]}
      fields={[
        { name: 'cod', label: 'Cod', type: 'text' },
        { name: 'denumire', label: 'Denumire', type: 'text', full: true },
        { name: 'cont', label: 'Cont', type: 'text' },
      ]}
      defaults={{ cod: '', denumire: '', cont: '' }}
    />
  );
}

export function ObiecteInventarPage() {
  const repo = useData().obiecteInventar;
  const gestiuni = useOptions(useData().gestiuni, (g) => `${g.cod} · ${g.denumire}`);
  const gMap = useMemo(() => new Map(gestiuni.map((o) => [o.value, o.label])), [gestiuni]);
  return (
    <EntityGrid<ObiectInventar>
      title="Obiecte de inventar"
      subtitle="Evidenta obiectelor de inventar"
      labelSingular="obiect"
      repo={repo}
      columns={[
        { key: 'cod', header: 'Cod' },
        { key: 'denumire', header: 'Denumire' },
        { key: 'cantitate', header: 'Cant.', align: 'right', render: (r) => fmt.cant(r.cantitate) },
        {
          key: 'valoareBani',
          header: 'Valoare',
          align: 'right',
          render: (r) => fmt.bani(r.valoareBani),
        },
        {
          key: 'gestiuneId',
          header: 'Gestiune',
          render: (r) => gMap.get(r.gestiuneId ?? '') ?? '—',
        },
      ]}
      fields={[
        { name: 'cod', label: 'Cod', type: 'text' },
        { name: 'denumire', label: 'Denumire', type: 'text', full: true },
        { name: 'cantitate', label: 'Cantitate', type: 'number' },
        { name: 'valoareBani', label: 'Valoare', type: 'money' },
        {
          name: 'gestiuneId',
          label: 'Gestiune',
          type: 'select',
          options: gestiuni,
          nullable: true,
        },
        { name: 'dataIntrare', label: 'Data intrare', type: 'text', nullable: true },
        { name: 'activ', label: 'Activ', type: 'checkbox' },
      ]}
      defaults={{ cod: '', denumire: '', cantitate: 1, valoareBani: 0, activ: true }}
    />
  );
}

export function ListePreturiPage() {
  const repo = useData().listePreturi;
  const produse = useOptions(useData().produse, (p) => `${p.cod} · ${p.denumire}`);
  const pMap = useMemo(() => new Map(produse.map((o) => [o.value, o.label])), [produse]);
  return (
    <EntityGrid<ListaPret>
      title="Lista de preturi"
      subtitle="Preturi pe produse si liste"
      labelSingular="pret"
      repo={repo}
      columns={[
        { key: 'lista', header: 'Lista' },
        { key: 'produsId', header: 'Produs', render: (r) => pMap.get(r.produsId) ?? r.produsId },
        { key: 'pretBani', header: 'Pret', align: 'right', render: (r) => fmt.bani(r.pretBani) },
        { key: 'valabilDe', header: 'Valabil de', render: (r) => fmt.data(r.valabilDe) },
      ]}
      fields={[
        { name: 'lista', label: 'Lista', type: 'text' },
        { name: 'produsId', label: 'Produs', type: 'select', options: produse },
        { name: 'pretBani', label: 'Pret', type: 'money' },
        { name: 'valabilDe', label: 'Valabil de', type: 'text', nullable: true },
      ]}
      defaults={{ lista: 'standard', produsId: '', pretBani: 0, valabilDe: null }}
    />
  );
}
