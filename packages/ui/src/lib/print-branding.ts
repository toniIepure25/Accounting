import type { Firma } from '@gr/core-domain';
import { escapeHtml } from './safe-output.js';

/**
 * Antet HTML cu brandingul firmei curente (logo + denumire) — reutilizat pe
 * documentele client-facing tiparite (factura, deviz Mobila). Documentele
 * legale interne (registru-jurnal, cartea mare, D300/D394/D390,
 * registru-inventar) raman neutre, fara logo — formatul lor e standardizat,
 * nu de reprezentare a marcii.
 */
export function antetFirmaHtml(firma: Firma | null): string {
  if (!firma) return '';
  const logo = firma.logoDataUrl
    ? `<img src="${escapeHtml(firma.logoDataUrl)}" alt="" style="height:44px;max-width:150px;object-fit:contain" />`
    : '';
  return `<div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
    ${logo}
    <div style="font-size:15px;font-weight:bold">${escapeHtml(firma.denumire)}</div>
  </div>`;
}
