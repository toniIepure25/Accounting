import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Gated } from './Gated.js';

const { areModulMock, areVoieMock } = vi.hoisted(() => ({
  areModulMock: vi.fn(),
  areVoieMock: vi.fn(),
}));

vi.mock('../lib/license-context.js', () => ({
  useLicense: () => ({ areModul: areModulMock }),
}));
vi.mock('../lib/auth-context.js', () => ({
  useAuth: () => ({ areVoie: areVoieMock }),
}));

describe('Gated', () => {
  it('randeaza copiii cand modulul e activ si nicio permisiune nu e ceruta', () => {
    areModulMock.mockReturnValue(true);
    areVoieMock.mockReturnValue(false);
    render(
      <Gated moduleId="mobila">
        <p>Continut protejat</p>
      </Gated>,
    );
    expect(screen.getByText('Continut protejat')).toBeInTheDocument();
  });

  it('blocheaza cu "Modul indisponibil" cand licenta nu include modulul', () => {
    areModulMock.mockReturnValue(false);
    areVoieMock.mockReturnValue(true);
    render(
      <Gated moduleId="mobila">
        <p>Continut protejat</p>
      </Gated>,
    );
    expect(screen.getByText('Modul indisponibil')).toBeInTheDocument();
    expect(screen.queryByText('Continut protejat')).not.toBeInTheDocument();
  });

  it('blocheaza cu "Acces restrictionat" cand modulul e activ dar lipseste permisiunea', () => {
    areModulMock.mockReturnValue(true);
    areVoieMock.mockReturnValue(false);
    render(
      <Gated moduleId="mobila" permisiune="documente.validare">
        <p>Continut protejat</p>
      </Gated>,
    );
    expect(screen.getByText('Acces restrictionat')).toBeInTheDocument();
    expect(screen.queryByText('Continut protejat')).not.toBeInTheDocument();
  });

  it('randeaza copiii cand modulul e activ si permisiunea e detinuta', () => {
    areModulMock.mockReturnValue(true);
    areVoieMock.mockReturnValue(true);
    render(
      <Gated moduleId="mobila" permisiune="documente.validare">
        <p>Continut protejat</p>
      </Gated>,
    );
    expect(screen.getByText('Continut protejat')).toBeInTheDocument();
  });
});
