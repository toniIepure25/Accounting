import { render, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AuthProvider } from './auth-context.js';
import { DataProviderContext } from './data-context.js';
import { FirmaProvider, LS_FIRMA, useFirma } from './firma-context.js';
import { LicenseProvider } from './license-context.js';

// Firma demo implicita (F_TITAN, prima din demoSeed.firme) — vezi packages/data/src/demo-seed.ts.
const F_TITAN_ID = 'a0000000-0000-4000-8000-000000000000';

function Sonda() {
  const { firmaCurenta } = useFirma();
  return <div data-testid="firma">{firmaCurenta?.denumire ?? '—'}</div>;
}

describe('FirmaProvider', () => {
  it('persista firma din fallback (firme[0]) in localStorage, chiar fara selectie explicita — ' +
    'altfel data-context.tsx (care citeste LS_FIRMA direct, ca sa evite o dependinta circulara) ' +
    'ar vedea mereu null si nu ar scopa documentele noi pe firma curenta', async () => {
    localStorage.clear();
    expect(localStorage.getItem(LS_FIRMA)).toBeNull();

    render(
      // LicenseProvider e obligatoriu de cand DataProviderContext aplica garda
      // de licenta pe scrieri (withLicentaGuard) si citeste `poateScrie`.
      <LicenseProvider>
        <AuthProvider>
          <DataProviderContext>
            <FirmaProvider>
              <Sonda />
            </FirmaProvider>
          </DataProviderContext>
        </AuthProvider>
      </LicenseProvider>,
    );

    await waitFor(() => expect(localStorage.getItem(LS_FIRMA)).toBe(F_TITAN_ID));
  });
});
