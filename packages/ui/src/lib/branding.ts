import type { Firma } from '@gr/core-domain';
import { useEffect } from 'react';

const NUME_APLICATIE_IMPLICIT = 'Gestiune & Contabilitate';

/** Converteste "#2563eb" in tripletul HSL (fara functia hsl()) folosit de tokenii CSS din styles.css. `null` daca hex-ul e invalid. */
export function hexToHslTriplet(hex: string): string | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = Number.parseInt(m[1]!, 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  const d = max - min;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/**
 * Aplica brandingul firmei curente la nivel de aplicatie: culoarea primara
 * (peste tokenul CSS --primary, care altfel vine din tema light/dark) si
 * titlul paginii/tab-ului. Stilul inline are prioritate fata de regulile din
 * `.dark`/`:root` din styles.css — o culoare de brand ramane deci aceeasi in
 * ambele teme (simplificare deliberata pentru v1: adaptarea de contrast per
 * tema ar necesita generarea unei a doua nuante, lasata pentru o runda
 * ulterioara daca un client chiar are nevoie de asta).
 */
export function useAplicaBranding(firma: Firma | null): void {
  useEffect(() => {
    const root = document.documentElement;
    const hsl = firma?.culoarePrimara ? hexToHslTriplet(firma.culoarePrimara) : null;
    if (hsl) root.style.setProperty('--primary', hsl);
    else root.style.removeProperty('--primary');
    return () => {
      root.style.removeProperty('--primary');
    };
  }, [firma?.culoarePrimara]);

  useEffect(() => {
    document.title = firma?.numeAplicatie || NUME_APLICATIE_IMPLICIT;
  }, [firma?.numeAplicatie]);
}
