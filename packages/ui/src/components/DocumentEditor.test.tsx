import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuthProvider } from '../lib/auth-context.js';
import { ConfirmProvider } from '../lib/confirm.js';
import { DataProviderContext } from '../lib/data-context.js';
import { FirmaProvider } from '../lib/firma-context.js';
import { LicenseProvider } from '../lib/license-context.js';
import { ToastProvider } from '../lib/toast.js';
import { DocumentEditor } from './DocumentEditor.js';

function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <ConfirmProvider>
        {/* LicenseProvider e obligatoriu de cand DataProviderContext aplica
            garda de licenta pe scrieri (withLicentaGuard). */}
        <LicenseProvider>
          <AuthProvider>
            <DataProviderContext>
              <FirmaProvider>{children}</FirmaProvider>
            </DataProviderContext>
          </AuthProvider>
        </LicenseProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}

describe('DocumentEditor', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('creeaza un document nou (ciorna) cu o linie de produs si il afiseaza in tabel', async () => {
    const user = userEvent.setup();
    render(
      <Providers>
        <DocumentEditor
          tip="proforma"
          title="Proforme"
          subtitle="Facturi proforma"
          prefix="PRO"
          partenerTip="client"
        />
      </Providers>,
    );

    await user.click(await screen.findByRole('button', { name: /document nou/i }));

    const clientSelect = await screen.findByLabelText('Client');
    await waitFor(() =>
      expect(within(clientSelect).getAllByRole('option').length).toBeGreaterThan(1),
    );
    await user.selectOptions(clientSelect, 'Restaurant Boema SRL');

    await user.click(screen.getByRole('button', { name: /adauga linie/i }));

    const comboboxes = screen.getAllByRole('combobox');
    const produsSelect = comboboxes[comboboxes.length - 1] as HTMLSelectElement;
    await waitFor(() =>
      expect(within(produsSelect).getAllByRole('option').length).toBeGreaterThan(1),
    );
    await user.selectOptions(produsSelect, 'DULAP · Dulap clasic (la comanda)');

    await user.click(screen.getByRole('button', { name: /salveaza ciorna/i }));

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /salveaza ciorna/i })).not.toBeInTheDocument(),
    );

    const partenerCell = await screen.findByText('Restaurant Boema SRL');
    const row = partenerCell.closest('tr') as HTMLElement;
    expect(within(row).getByText('595,00')).toBeInTheDocument();
    expect(within(row).getByText('ciorna')).toBeInTheDocument();
    expect(within(row).getByText(/^PRO-\d{4}-\d{6}$/)).toBeInTheDocument();
  });
});
