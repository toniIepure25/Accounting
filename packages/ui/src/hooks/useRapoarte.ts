import { type ClientRapoarte, createReportsClient } from '@gr/data';
import { useMemo, useRef } from 'react';
import { useAuth } from '../lib/auth-context.js';
import { LS_FIRMA } from '../lib/firma-context.js';
import { createLocalReportsClient } from '../lib/local-rapoarte.js';
import { getExecLocal } from '../lib/local-sqlite.js';

/**
 * Client de RAPOARTE citite din REGISTRELE persistate:
 *  - retea/cloud: de pe server (`createReportsClient`);
 *  - local-sqlite: din baza SQLite-WASM din browser (`createLocalReportsClient`),
 *    aceleasi registre scrise de motorul local (WIRING-13);
 *  - demo (in-memory): `null` — nu exista registre, rapoartele se recalculeaza din documente.
 * Tokenul de sesiune / firma curenta se citesc LIVE, ca in useComenzi / DataProviderContext.
 */
export function useRapoarte(): ClientRapoarte | null {
  const { user } = useAuth();
  const userRef = useRef(user);
  userRef.current = user;

  const mod = localStorage.getItem('gr-deployment-mode') ?? 'local';
  const serverUrl = localStorage.getItem('gr-server-url') ?? '';
  const foloseesteServer = mod !== 'local' && mod !== 'local-sqlite' && serverUrl.trim().length > 0;
  const modLocalSqlite = mod === 'local-sqlite';

  return useMemo(() => {
    if (foloseesteServer) {
      return createReportsClient(serverUrl.trim(), () => userRef.current?.token ?? null);
    }
    if (modLocalSqlite) {
      const exec = getExecLocal();
      return exec ? createLocalReportsClient(exec, () => localStorage.getItem(LS_FIRMA)) : null;
    }
    return null;
  }, [foloseesteServer, serverUrl, modLocalSqlite]);
}
