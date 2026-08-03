import { randomUUID } from 'node:crypto';

/**
 * Logging structurat pentru server. Inainte, serverul folosea `console.log`
 * ad-hoc, cu mesaje in text liber — greu de filtrat, de corelat pe cerere sau
 * de trimis intr-un sistem de agregare (Loki, CloudWatch, ELK). Aici emitem
 * JSON pe o singura linie: usor de interogat, cu nivel, timp, request-id si
 * campuri arbitrare.
 *
 * `LOG_FORMAT=text` pastreaza formatul lizibil pentru dezvoltare locala;
 * implicit (sau `LOG_FORMAT=json`) e formatul de productie.
 */

export type NivelLog = 'debug' | 'info' | 'warn' | 'error';

const NIVELURI: Record<NivelLog, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const NIVEL_MINIM = NIVELURI[(process.env.LOG_LEVEL as NivelLog) ?? 'info'] ?? NIVELURI.info;
const FORMAT_TEXT = process.env.LOG_FORMAT === 'text';

function emite(nivel: NivelLog, mesaj: string, campuri?: Record<string, unknown>): void {
  if (NIVELURI[nivel] < NIVEL_MINIM) return;
  const timp = new Date().toISOString();
  if (FORMAT_TEXT) {
    const extra = campuri ? ` ${JSON.stringify(campuri)}` : '';
    const scrie = nivel === 'error' || nivel === 'warn' ? console.error : console.log;
    scrie(`${timp} ${nivel.toUpperCase().padEnd(5)} ${mesaj}${extra}`);
    return;
  }
  const linie = JSON.stringify({ timp, nivel, mesaj, ...campuri });
  if (nivel === 'error' || nivel === 'warn') console.error(linie);
  else console.log(linie);
}

export const log = {
  debug: (mesaj: string, campuri?: Record<string, unknown>) => emite('debug', mesaj, campuri),
  info: (mesaj: string, campuri?: Record<string, unknown>) => emite('info', mesaj, campuri),
  warn: (mesaj: string, campuri?: Record<string, unknown>) => emite('warn', mesaj, campuri),
  error: (mesaj: string, campuri?: Record<string, unknown>) => emite('error', mesaj, campuri),
};

/**
 * Genereaza un identificator scurt de cerere. Corelabil intre logul de acces si
 * eventualele erori aparute in timpul cererii; intors si clientului in antetul
 * `x-request-id`, ca un utilizator care raporteaza o problema sa poata da un id
 * cautabil in loguri.
 */
export function idCerere(): string {
  return randomUUID().slice(0, 8);
}
