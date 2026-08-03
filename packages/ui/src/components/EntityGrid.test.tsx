import { type Repository, createMemoryRepository } from '@gr/data';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { ConfirmProvider } from '../lib/confirm.js';
import { ToastProvider } from '../lib/toast.js';
import { EntityGrid } from './EntityGrid.js';

function ProvideCele({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <ConfirmProvider>{children}</ConfirmProvider>
    </ToastProvider>
  );
}

interface Gestiune {
  id: string;
  cod: string;
  denumire: string;
}

function makeRepo(seed: Gestiune[] = []): Repository<Gestiune, Partial<Gestiune>> {
  return createMemoryRepository<Gestiune, Partial<Gestiune>>(
    (input, id) => ({
      id,
      cod: (input.cod as string) ?? '',
      denumire: (input.denumire as string) ?? '',
    }),
    seed,
  );
}

const columns = [
  { key: 'cod', header: 'Cod' },
  { key: 'denumire', header: 'Denumire' },
];
const fields = [
  { name: 'cod', label: 'Cod', type: 'text' as const, required: true },
  { name: 'denumire', label: 'Denumire', type: 'text' as const, required: true },
];

describe('EntityGrid', () => {
  it('afiseaza randurile existente din repository', async () => {
    const repo = makeRepo([{ id: '1', cod: 'GST01', denumire: 'Depozit central' }]);
    render(
      <ProvideCele>
        <EntityGrid
          title="Gestiuni"
          repo={repo}
          columns={columns}
          fields={fields}
          defaults={{ cod: '', denumire: '' }}
        />
      </ProvideCele>,
    );
    expect(await screen.findByText('GST01')).toBeInTheDocument();
    expect(screen.getByText('Depozit central')).toBeInTheDocument();
  });

  it('adauga o inregistrare noua prin modalul de creare', async () => {
    const user = userEvent.setup();
    const repo = makeRepo();
    render(
      <ProvideCele>
        <EntityGrid
          title="Gestiuni"
          repo={repo}
          columns={columns}
          fields={fields}
          defaults={{ cod: '', denumire: '' }}
        />
      </ProvideCele>,
    );

    await user.click(screen.getByRole('button', { name: /adauga/i }));
    const dialogTitle = await screen.findByText('Adauga inregistrare');
    const modal = dialogTitle.closest('div')?.parentElement as HTMLElement;

    await user.type(within(modal).getByLabelText('Cod'), 'GST02');
    await user.type(within(modal).getByLabelText('Denumire'), 'Depozit secundar');
    await user.click(within(modal).getByRole('button', { name: /salveaza/i }));

    expect(await screen.findByText('GST02')).toBeInTheDocument();
    await waitFor(async () => expect((await repo.list()).length).toBe(1));
  });

  it('sterge o inregistrare dupa confirmare in dialogul stilizat', async () => {
    const user = userEvent.setup();
    const repo = makeRepo([{ id: '1', cod: 'GST01', denumire: 'Depozit central' }]);
    render(
      <ProvideCele>
        <EntityGrid
          title="Gestiuni"
          repo={repo}
          columns={columns}
          fields={fields}
          defaults={{ cod: '', denumire: '' }}
        />
      </ProvideCele>,
    );

    expect(await screen.findByText('GST01')).toBeInTheDocument();
    const row = screen.getByText('GST01').closest('tr') as HTMLElement;
    const deleteBtn = within(row).getByRole('button', { name: /sterge/i });
    await user.click(deleteBtn);

    // Confirmarea nu mai e window.confirm() nativ, ci un modal din design system —
    // stergerea nu are efect pana nu se apasa explicit butonul de confirmare.
    const dialogTitle = await screen.findByText('Sterge inregistrare');
    const dialog = dialogTitle.closest('[role="dialog"]') as HTMLElement;
    await user.click(within(dialog).getByRole('button', { name: /^sterge$/i }));

    await waitFor(() => expect(screen.queryByText('GST01')).not.toBeInTheDocument());
    expect(await repo.list()).toHaveLength(0);
  });

  it('filtreaza randurile dupa textul din campul de cautare', async () => {
    const user = userEvent.setup();
    const repo = makeRepo([
      { id: '1', cod: 'GST01', denumire: 'Depozit central' },
      { id: '2', cod: 'GST02', denumire: 'Magazin nord' },
    ]);
    render(
      <ProvideCele>
        <EntityGrid
          title="Gestiuni"
          repo={repo}
          columns={columns}
          fields={fields}
          defaults={{ cod: '', denumire: '' }}
        />
      </ProvideCele>,
    );

    expect(await screen.findByText('GST01')).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText('Cauta...'), 'nord');

    expect(screen.queryByText('GST01')).not.toBeInTheDocument();
    expect(screen.getByText('GST02')).toBeInTheDocument();
  });
});
