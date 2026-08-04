import { REGULI_TVA_RO, type RegulaTva } from '@gr/core-domain';
import { useMemo } from 'react';
import { type Column, DataTable } from '../components/DataTable.js';
import { Badge, Card, PageHeader } from '../components/ui.js';

/**
 * Registru READ-ONLY al regulilor de TVA cu efectivitate temporala (A8).
 *
 * Nivel sigur suportat de arhitectura actuala: afiseaza regulile efective
 * (aceleasi care seed-eaza tabela `tax_rules`), cu perioada de valabilitate,
 * referinta legala si starea in timp (istorica / curenta / viitoare). Regulile
 * aprobate sunt IMUTABILE — nu exista editare in loc. Fluxul de scriere cu
 * aprobare (versiuni noi, comenzi tranzactionale) tine de stratul de comenzi din
 * Faza 3 si nu e expus aici ca CRUD generic.
 */

type StareRegula = 'istorica' | 'curenta' | 'viitoare';

function stareLaData(r: RegulaTva, azi: string): StareRegula {
  const zi = (s: string) => Number(s.slice(0, 10).replace(/-/g, ''));
  if (zi(r.validDeLa) > zi(azi)) return 'viitoare';
  if (r.validPanaLa !== null && zi(r.validPanaLa) <= zi(azi)) return 'istorica';
  return 'curenta';
}

const TON: Record<StareRegula, 'success' | 'muted' | 'warning'> = {
  curenta: 'success',
  istorica: 'muted',
  viitoare: 'warning',
};
const ETICHETA: Record<StareRegula, string> = {
  curenta: 'In vigoare',
  istorica: 'Istorica',
  viitoare: 'Viitoare',
};

export function TvaReguliPage() {
  const azi = new Date().toISOString().slice(0, 10);
  const randuri = useMemo(
    () =>
      [...REGULI_TVA_RO].sort(
        (a, b) =>
          a.codCategorieFiscala.localeCompare(b.codCategorieFiscala) ||
          a.validDeLa.localeCompare(b.validDeLa),
      ),
    [],
  );

  const columns: Column<RegulaTva>[] = [
    { key: 'codCategorieFiscala', header: 'Categorie fiscala' },
    {
      key: 'procent',
      header: 'Cota',
      align: 'right',
      render: (r) => `${r.procent}%`,
    },
    { key: 'validDeLa', header: 'Valabil de la' },
    { key: 'validPanaLa', header: 'Pana la (excl.)', render: (r) => r.validPanaLa ?? '—' },
    {
      key: 'id',
      header: 'Stare',
      render: (r) => {
        const s = stareLaData(r, azi);
        return <Badge tone={TON[s]}>{ETICHETA[s]}</Badge>;
      },
    },
    { key: 'referintaLegala', header: 'Referinta legala' },
  ];

  return (
    <div>
      <PageHeader
        title="Reguli de TVA"
        subtitle="Cote cu efectivitate temporala — registru (doar citire)"
      />
      <Card className="mb-4 p-4 text-sm text-fg-muted">
        Cota aplicata unui document se rezolva automat dupa <strong>data documentului</strong> si
        categoria fiscala a produsului. Regulile aprobate sunt imutabile; o modificare legislativa
        se introduce ca o regula noua cu alta data de intrare in vigoare. Sursa cotelor din 2025:
        Legea 141/2025 (Monitorul Oficial 699/25.07.2025), in vigoare de la 1 august 2025.
      </Card>
      <Card className="p-1">
        <DataTable rows={randuri} columns={columns} getRowKey={(r) => r.id} />
      </Card>
    </div>
  );
}
