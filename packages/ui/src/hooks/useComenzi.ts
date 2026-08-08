import { type ClientComenzi, createCommandClient } from '@gr/data';
import { useMemo, useRef } from 'react';
import { useAuth } from '../lib/auth-context.js';

/**
 * Client de COMENZI autoritare pentru modurile retea/cloud, sau `null` in modul
 * local (fara server) — unde nu exista motor de comenzi si UI-ul cade pe CRUD.
 *
 * Postarea/stornarea unui document trebuie sa treaca prin comenzile serverului
 * (@gr/application: stoc + jurnal + fiscal atomic), nu printr-un PATCH de stare.
 * Tokenul de sesiune e citit LIVE (prin ref) la fiecare cerere, ca reinnoirea
 * sesiunii sa nu ceara reconstruirea clientului — la fel ca DataProviderContext.
 */
export function useComenzi(): ClientComenzi | null {
  const { user } = useAuth();
  const userRef = useRef(user);
  userRef.current = user;

  // Configuratia de deployment e citita din localStorage (ca in data-context):
  // stabila pe durata sesiunii, deci o citim o data la construirea clientului.
  const mod = localStorage.getItem('gr-deployment-mode') ?? 'local';
  const serverUrl = localStorage.getItem('gr-server-url') ?? '';
  const foloseesteServer = mod !== 'local' && serverUrl.trim().length > 0;

  return useMemo(
    () =>
      foloseesteServer
        ? createCommandClient(serverUrl.trim(), () => userRef.current?.token ?? null)
        : null,
    [foloseesteServer, serverUrl],
  );
}
