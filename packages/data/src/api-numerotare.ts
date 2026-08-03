import type { FurnizorToken } from './api-repo.js';
import type { NumarAlocat, Numerotare } from './numerotare.js';

/** Client pentru alocarea numerelor de document prin server (moduri lan/cloud). */
export function createApiNumerotare(baseUrl: string, getToken?: FurnizorToken): Numerotare {
  const url = `${baseUrl.replace(/\/$/, '')}/numerotare/next`;
  return {
    async next(tipDocument, an, prefixImplicit, lungimeImplicita = 6) {
      const headers: Record<string, string> = { 'content-type': 'application/json' };
      const token = getToken?.();
      if (token) headers.authorization = `Bearer ${token}`;
      const r = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ tipDocument, an, prefixImplicit, lungimeImplicita }),
      });
      if (!r.ok) throw new Error(`Numerotare API ${r.status}`);
      return (await r.json()) as NumarAlocat;
    },
  };
}
