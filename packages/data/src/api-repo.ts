import type { Repository } from './repository.js';

/**
 * Repository peste un API REST (modurile retea / cloud). UI-ul foloseste acelasi
 * contract Repository; doar transportul difera fata de SQLite local.
 * Conventie endpoint: GET /:resource, GET /:resource/:id, POST /:resource,
 * PATCH /:resource/:id, DELETE /:resource/:id.
 */
/** Furnizor de token de sesiune, citit la fiecare cerere (nu capturat o singura data). */
export type FurnizorToken = () => string | null;

export function createApiRepository<T extends { id: string }>(
  baseUrl: string,
  resource: string,
  getToken?: FurnizorToken,
): Repository<T, Partial<T>> {
  const base = baseUrl.replace(/\/$/, '');
  const url = (p = '') => `${base}/${resource}${p}`;
  const headers = () => {
    const h: Record<string, string> = { 'content-type': 'application/json' };
    const token = getToken?.();
    if (token) h.authorization = `Bearer ${token}`;
    return h;
  };

  /**
   * Serverul trimite mesaje de eroare explicative si actionabile in corp
   * (`{ error: "Trebuie sa ramana cel putin un administrator activ..." }`) —
   * inclusiv pentru reguli de business: 402 licenta plina, 403 acces interzis,
   * 409 ultimul administrator, 423 perioada contabila inchisa. Fara extragerea
   * lor, utilizatorul vedea doar "API 409 Conflict", un mesaj tehnic din care
   * nu putea intelege NICI ce s-a intamplat, NICI ce are de facut.
   */
  const eroareDinRaspuns = async (r: Response): Promise<Error> => {
    try {
      const corp = (await r.json()) as { error?: string };
      if (corp?.error) return new Error(corp.error);
    } catch {
      /* raspuns fara corp JSON — cadem pe mesajul generic de mai jos */
    }
    return new Error(`Eroare server (${r.status} ${r.statusText})`);
  };

  const ok = async (r: Response) => {
    if (!r.ok) throw await eroareDinRaspuns(r);
    return r.json();
  };

  return {
    list: () => fetch(url(), { headers: headers() }).then(ok) as Promise<T[]>,
    getById: (id) =>
      fetch(url(`/${id}`), { headers: headers() }).then((r) =>
        r.status === 404 ? null : (ok(r) as Promise<T>),
      ),
    create: (input) =>
      fetch(url(), { method: 'POST', headers: headers(), body: JSON.stringify(input) }).then(
        ok,
      ) as Promise<T>,
    update: (id, patch) =>
      fetch(url(`/${id}`), {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify(patch),
      }).then(ok) as Promise<T>,
    remove: async (id) => {
      const r = await fetch(url(`/${id}`), { method: 'DELETE', headers: headers() });
      if (!r.ok) throw new Error(`API ${r.status}`);
    },
  };
}
