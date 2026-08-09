import { type ClientAdmin, createAdminClient } from '@gr/data';
import { useMemo, useRef } from 'react';
import { useAuth } from '../lib/auth-context.js';

/**
 * Client de ADMINISTRARE (backup/restore la nivel de baza, incl. registrele) pentru
 * modurile retea/cloud, sau `null` in modul local — unde backup-ul foloseste calea
 * DataProvider (`exportDate`/`importDate`). Tokenul de sesiune e citit LIVE (prin
 * ref), ca in useRapoarte / useComenzi. Serverul impune `setari.administrare`.
 */
export function useAdmin(): ClientAdmin | null {
  const { user } = useAuth();
  const userRef = useRef(user);
  userRef.current = user;

  const mod = localStorage.getItem('gr-deployment-mode') ?? 'local';
  const serverUrl = localStorage.getItem('gr-server-url') ?? '';
  const foloseesteServer = mod !== 'local' && serverUrl.trim().length > 0;

  return useMemo(
    () =>
      foloseesteServer
        ? createAdminClient(serverUrl.trim(), () => userRef.current?.token ?? null)
        : null,
    [foloseesteServer, serverUrl],
  );
}
