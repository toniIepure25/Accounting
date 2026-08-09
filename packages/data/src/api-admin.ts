import type { FurnizorToken } from './api-repo.js';
import type { BackupBaza, RezultatRestaurareBaza } from './backup-sql.js';

/**
 * Client pentru operatiunile de ADMINISTRARE ale serverului (backup/restore la
 * nivel de baza). Spre deosebire de `exportDate`/`importDate` (backup pe
 * DataProvider — doar nomenclatoare + documente, PIERDE registrele), acest client
 * cere serverului instantaneul COMPLET al bazei, verificat prin proba de
 * restaurare (`backupVerificat`), incluzand jurnalul/stocul/evenimentele fiscale.
 * Doar rolul cu `setari.administrare` il poate folosi (impus pe server).
 */
export interface ClientAdmin {
  /** Instantaneul complet, verificat, al bazei (incl. registrele). */
  backup(): Promise<BackupBaza>;
  /** Restaureaza baza dintr-un instantaneu complet (ATOMIC, verificat). */
  restaureaza(snapshot: BackupBaza): Promise<RezultatRestaurareBaza>;
}

export function createAdminClient(baseUrl: string, getToken?: FurnizorToken): ClientAdmin {
  const base = baseUrl.replace(/\/$/, '');
  const headers = () => {
    const h: Record<string, string> = { 'content-type': 'application/json' };
    const token = getToken?.();
    if (token) h.authorization = `Bearer ${token}`;
    return h;
  };
  const ok = async (r: Response): Promise<unknown> => {
    if (!r.ok) {
      let mesaj = `Eroare server (${r.status} ${r.statusText})`;
      try {
        const corp = (await r.json()) as { error?: string };
        if (corp?.error) mesaj = corp.error;
      } catch {
        /* raspuns fara corp JSON */
      }
      throw new Error(mesaj);
    }
    return r.json();
  };

  return {
    backup: () =>
      fetch(`${base}/admin/backup`, { headers: headers() }).then(ok) as Promise<BackupBaza>,
    restaureaza: (snapshot) =>
      fetch(`${base}/admin/restore`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(snapshot),
      }).then(ok) as Promise<RezultatRestaurareBaza>,
  };
}
