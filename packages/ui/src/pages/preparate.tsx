import type { Preparat, RetetaLinie } from '@gr/core-domain';
import { useMemo } from 'react';
import { type Column, EntityGrid, type FieldDef } from '../components/index.js';
import { useOptions } from '../hooks/useOptions.js';
import { useData } from '../lib/data-context.js';
import * as fmt from '../lib/format.js';

export function PreparatePage() {
  const repo = useData().preparate;
  const grupe = useOptions(useData().grupeProduse, (g) => g.denumire);
  const columns: Column<Preparat>[] = [
    { key: 'cod', header: 'Cod' },
    { key: 'denumire', header: 'Denumire' },
    { key: 'unitateMasura', header: 'UM' },
    {
      key: 'pretVanzareBani',
      header: 'Pret',
      align: 'right',
      render: (r) => fmt.bani(r.pretVanzareBani),
    },
    {
      key: 'cotaTvaProcent',
      header: 'TVA%',
      align: 'right',
      render: (r) => `${r.cotaTvaProcent}%`,
    },
  ];
  const fields: FieldDef[] = [
    { name: 'cod', label: 'Cod', type: 'text' },
    { name: 'denumire', label: 'Denumire', type: 'text', full: true },
    { name: 'grupaId', label: 'Grupa', type: 'select', options: grupe, nullable: true },
    { name: 'unitateMasura', label: 'UM', type: 'text' },
    { name: 'pretVanzareBani', label: 'Pret vanzare', type: 'money' },
    { name: 'cotaTvaProcent', label: 'Cota TVA %', type: 'number' },
    { name: 'activ', label: 'Activ', type: 'checkbox' },
  ];
  return (
    <EntityGrid<Preparat>
      title="Preparate bucatarie"
      subtitle="Preparate si semipreparate"
      labelSingular="preparat"
      repo={repo}
      columns={columns}
      fields={fields}
      defaults={{
        cod: '',
        denumire: '',
        unitateMasura: 'portie',
        pretVanzareBani: 0,
        cotaTvaProcent: 9,
        activ: true,
      }}
    />
  );
}

export function RetetePage() {
  const repo = useData().reteteLinii;
  const preparate = useOptions(useData().preparate, (p) => p.denumire);
  const produse = useOptions(useData().produse, (p) => `${p.cod} · ${p.denumire}`);
  const prepMap = useMemo(() => new Map(preparate.map((o) => [o.value, o.label])), [preparate]);
  const prodMap = useMemo(() => new Map(produse.map((o) => [o.value, o.label])), [produse]);
  return (
    <EntityGrid<RetetaLinie>
      title="Retete"
      subtitle="Componente (materii prime) pe preparat"
      labelSingular="componenta"
      repo={repo}
      columns={[
        {
          key: 'preparatId',
          header: 'Preparat',
          render: (r) => prepMap.get(r.preparatId) ?? r.preparatId,
        },
        {
          key: 'produsId',
          header: 'Materie prima',
          render: (r) => prodMap.get(r.produsId) ?? r.produsId,
        },
        {
          key: 'cantitate',
          header: 'Cantitate',
          align: 'right',
          render: (r) => `${fmt.cant(r.cantitate)} ${r.unitateMasura}`,
        },
      ]}
      fields={[
        { name: 'preparatId', label: 'Preparat', type: 'select', options: preparate },
        { name: 'produsId', label: 'Materie prima', type: 'select', options: produse },
        { name: 'cantitate', label: 'Cantitate', type: 'number' },
        { name: 'unitateMasura', label: 'UM', type: 'text' },
      ]}
      defaults={{ preparatId: '', produsId: '', cantitate: 0, unitateMasura: 'kg' }}
    />
  );
}
