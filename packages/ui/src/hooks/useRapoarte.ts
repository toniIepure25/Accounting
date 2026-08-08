import { type ClientRapoarte, createReportsClient } from '@gr/data';
import { useMemo, useRef } from 'react';
import { useAuth } from '../lib/auth-context.js';

/**
 * Client de RAPOARTE citite din registrele persistente ale serverului (retea/
 * cloud), sau `null` in modul local — unde nu exista registre si rapoartele se
 * recalculeaza din documente. Tokenul de sesiune e citit LIVE (prin ref), ca in
 * useComenzi / DataProviderContext.
 */
export function useRapoarte(): ClientRapoarte | null {
  const { user } = useAuth();
  const userRef = useRef(user);
  userRef.current = user;

  const mod = localStorage.getItem('gr-deployment-mode') ?? 'local';
  const serverUrl = localStorage.getItem('gr-server-url') ?? '';
  const foloseesteServer = mod !== 'local' && serverUrl.trim().length > 0;

  return useMemo(
    () =>
      foloseesteServer
        ? createReportsClient(serverUrl.trim(), () => userRef.current?.token ?? null)
        : null,
    [foloseesteServer, serverUrl],
  );
}
