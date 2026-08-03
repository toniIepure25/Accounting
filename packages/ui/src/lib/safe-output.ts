/**
 * Codificare de ieșire pentru date introduse de utilizator (nume parteneri,
 * observații, explicații, denumiri de produse/conturi) atunci când ajung în
 * HTML generat pentru printare (`document.write`, via `printHtml`) sau în
 * CSV descărcat. Fără asta, un nume de partener ca `<script>...</script>`
 * ar rula în fereastra de print (XSS stocat, cu acces la `window.opener` —
 * adică la sesiunea aplicației), iar un nume ca `=cmd|'/c calc'!A1` ar fi
 * interpretat ca formulă la deschiderea CSV-ului în Excel/LibreOffice
 * ("CSV injection", CWE-1236).
 */

const ENTITATI_HTML: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Scapă caracterele speciale HTML — de aplicat pe orice valoare introdusă de utilizator interpolată în HTML generat pentru printare. */
export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ENTITATI_HTML[c]!);
}

/**
 * Formatează o valoare ca un câmp CSV sigur: o pune între ghilimele (dublând
 * ghilimelele interne) dacă valoarea conține virgulă/ghilimele/linie nouă —
 * altfel o virgulă dintr-un nume de partener ar sparge structura pe coloane.
 * Dacă valoarea începe cu `= + - @` (semn de formulă recunoscut de Excel/
 * LibreOffice), i se antepune un apostrof, ca celula să rămână text simplu.
 */
export function csvField(value: unknown): string {
  let s = String(value ?? '');
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}
