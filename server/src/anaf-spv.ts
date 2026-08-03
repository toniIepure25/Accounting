/**
 * Conector ANAF e-Factura (SPV). Acopera fluxul oficial: obtinere token OAuth2,
 * incarcare XML, verificare stare, descarcare raspuns.
 *
 * IMPORTANT: autentificarea ANAF cere un certificat digital calificat (mTLS) si
 * inregistrarea aplicatiei OAuth in SPV. Endpoint-urile de mai jos sunt cele
 * reale; rularea necesita credentiale + certificat valide. Semnatura XML si
 * mTLS se configureaza la nivel de agent HTTP (undici/Agent cu certificat).
 */

const OAUTH_TOKEN = 'https://logincert.anaf.ro/anaf-oauth2/v1/token';
const API = (env: 'test' | 'prod') => `https://api.anaf.ro/${env}/FCTEL/rest`;

export interface AnafConfig {
  env: 'test' | 'prod';
  clientId: string;
  clientSecret: string;
  /** Bearer token deja obtinut (optional, daca nu folosesti schimbul de mai jos). */
  accessToken?: string;
  /** Agent mTLS (din `agentMTLS`) cu certificatul calificat, pentru logincert.anaf.ro. */
  dispatcher?: unknown;
}

/** Adauga dispatcher-ul mTLS la optiunile de fetch (undici il accepta). */
function cuMtls(cfg: AnafConfig, init: RequestInit): RequestInit {
  return { ...init, dispatcher: cfg.dispatcher } as RequestInit;
}

/** Schimba authorization_code / refresh_token pe un access_token OAuth2. */
export async function obtineToken(
  cfg: AnafConfig,
  grant: { code: string; redirectUri: string } | { refreshToken: string },
): Promise<{ accessToken: string; refreshToken?: string; expiresIn: number }> {
  const body = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    token_content_type: 'jwt',
  });
  if ('code' in grant) {
    body.set('grant_type', 'authorization_code');
    body.set('code', grant.code);
    body.set('redirect_uri', grant.redirectUri);
  } else {
    body.set('grant_type', 'refresh_token');
    body.set('refresh_token', grant.refreshToken);
  }
  const r = await fetch(
    OAUTH_TOKEN,
    cuMtls(cfg, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    }),
  );
  if (!r.ok) throw new Error(`ANAF token ${r.status}`);
  const j = (await r.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };
  return { accessToken: j.access_token, refreshToken: j.refresh_token, expiresIn: j.expires_in };
}

/** Incarca o factura (XML UBL) in SPV. Returneaza indexul de incarcare. */
export async function incarcaFactura(
  cfg: AnafConfig,
  cif: string,
  xmlUbl: string,
): Promise<{ indexIncarcare: string }> {
  const token = cfg.accessToken;
  if (!token) throw new Error('Lipseste accessToken');
  const url = `${API(cfg.env)}/upload?standard=UBL&cif=${encodeURIComponent(cif)}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'text/plain' },
    body: xmlUbl,
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`ANAF upload ${r.status}: ${text}`);
  const index = /index_incarcare="(\d+)"/.exec(text)?.[1];
  if (!index) throw new Error(`Raspuns upload neasteptat: ${text}`);
  return { indexIncarcare: index };
}

/** Verifica starea unei incarcari. */
export async function verificaStare(
  cfg: AnafConfig,
  indexIncarcare: string,
): Promise<{ stare: string; idDescarcare?: string }> {
  const token = cfg.accessToken;
  if (!token) throw new Error('Lipseste accessToken');
  const r = await fetch(`${API(cfg.env)}/stareMesaj?id_incarcare=${indexIncarcare}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`ANAF stare ${r.status}: ${text}`);
  const stare = /stare="([^"]+)"/.exec(text)?.[1] ?? 'necunoscut';
  const idDescarcare = /id_descarcare="(\d+)"/.exec(text)?.[1];
  return { stare, idDescarcare };
}

/** Descarca raspunsul (ZIP) pentru o factura procesata. */
export async function descarcaRaspuns(cfg: AnafConfig, idDescarcare: string): Promise<ArrayBuffer> {
  const token = cfg.accessToken;
  if (!token) throw new Error('Lipseste accessToken');
  const r = await fetch(`${API(cfg.env)}/descarcare?id=${idDescarcare}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`ANAF descarcare ${r.status}`);
  return r.arrayBuffer();
}
