import type { DataProvider } from '@gr/data';
import {
  CHEIE_PUBLICA_DEMO,
  type LicentaPayload,
  maiIncapeUnUtilizator,
  utilizatoriMaxPermisi,
  verificaLicenta,
} from '@gr/license';
import { log } from './log.js';

/**
 * Licenta impusa SERVER-SIDE. Pana acum, licenta traia doar in clientul web
 * (localStorage) — adica limita de utilizatori era o sugestie: cine vorbea
 * direct cu API-ul putea crea oricati utilizatori, exact ca la RBAC-ul care
 * inainte era doar in UI. Aici e impunerea reala.
 *
 * Configurare: `LICENSE_KEY` (cheia livrata clientului) si, optional,
 * `LICENSE_PUBLIC_KEY` (JWK-ul cheii publice a furnizorului, daca deployment-ul
 * foloseste alta pereche decat cea demo).
 *
 * Fara `LICENSE_KEY` setat, serverul ramane NELIMITAT — comportamentul de pana
 * acum, ca instalarile existente si mediile de dezvoltare sa nu se blocheze
 * brusc la un upgrade.
 */

let payload: LicentaPayload | null = null;
let incarcata = false;

function cheiePublica(): JsonWebKey {
  const brut = process.env.LICENSE_PUBLIC_KEY;
  if (!brut) return CHEIE_PUBLICA_DEMO;
  try {
    return JSON.parse(brut) as JsonWebKey;
  } catch {
    log.warn('LICENSE_PUBLIC_KEY nu e un JWK JSON valid — folosesc cheia demo');
    return CHEIE_PUBLICA_DEMO;
  }
}

/** Incarca si verifica licenta din mediu. Idempotent — se apeleaza la boot. */
export async function incarcaLicenta(): Promise<LicentaPayload | null> {
  if (incarcata) return payload;
  incarcata = true;

  const cheie = process.env.LICENSE_KEY?.trim();
  if (!cheie) {
    log.warn(
      'LICENSE_KEY nesetat — serverul nu impune nicio limita de utilizatori. ' +
        'Seteaza cheia de licenta intr-un deployment comercial.',
    );
    return null;
  }

  const r = await verificaLicenta(cheie, cheiePublica());
  if (r.valida) {
    payload = r.payload;
  } else if (r.motiv === 'expirata') {
    // Expirata: pastram payload-ul (deci si limita de utilizatori), dar
    // semnalam. Blocarea efectiva a scrierii ramane o decizie de produs
    // aplicata in client (perioada de gratie) — serverul nu inchide brusc
    // accesul la datele contabile ale clientului.
    payload = r.payload;
    log.warn('licenta expirata', { client: r.payload.client, expira: r.payload.expira });
  } else {
    log.error('LICENSE_KEY invalida — ignorata, serverul ramane fara limita', { motiv: r.motiv });
    return null;
  }

  const max = utilizatoriMaxPermisi(payload);
  log.info('licenta incarcata', {
    client: payload.client,
    editie: payload.editie,
    plan: payload.plan ?? 'fara',
    utilizatoriMax: max ?? 'nelimitat',
  });
  return payload;
}

export function licentaCurenta(): LicentaPayload | null {
  return payload;
}

/**
 * Verifica daca mai poate fi ADAUGAT un utilizator activ. Numara utilizatorii
 * `activ: true` — conturile dezactivate nu consuma licenta, ca un client sa
 * poata pastra istoricul unui angajat plecat fara sa plateasca pentru el.
 */
export async function maiIncapeUtilizatorActiv(provider: DataProvider): Promise<{
  ok: boolean;
  activi: number;
  max: number | null;
}> {
  const max = utilizatoriMaxPermisi(payload);
  const toti = await provider.utilizatori.list();
  const activi = toti.filter((u) => u.activ).length;
  return { ok: maiIncapeUnUtilizator(payload, activi), activi, max };
}
