import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TvaReguliPage } from './TvaReguli.js';

describe('TvaReguliPage (registru read-only)', () => {
  it('afiseaza cotele standard 19% (istorica) si 21% (in vigoare)', () => {
    render(<TvaReguliPage />);
    expect(screen.getByText('19%')).toBeInTheDocument();
    expect(screen.getByText('21%')).toBeInTheDocument();
    // Azi (2026) e dupa tranzitie: exista cel putin o regula "In vigoare" si una "Istorica".
    expect(screen.getAllByText('In vigoare').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Istorica').length).toBeGreaterThan(0);
  });

  it('afiseaza referinta legala a tranzitiei 2025', () => {
    render(<TvaReguliPage />);
    expect(screen.getAllByText(/Legea 141\/2025/).length).toBeGreaterThan(0);
  });

  it('arata categoriile fiscale reduse (redus_9, redus_5) si scutit', () => {
    render(<TvaReguliPage />);
    expect(screen.getAllByText('redus_9').length).toBeGreaterThan(0);
    expect(screen.getAllByText('redus_5').length).toBeGreaterThan(0);
    expect(screen.getByText('scutit')).toBeInTheDocument();
  });
});
