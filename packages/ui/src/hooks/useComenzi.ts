import {
  type ClientComenziOffline,
  createCommandClient,
  createOfflineCommandClient,
  stocatorStorage,
} from '@gr/data';
import { useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../lib/auth-context.js';
import { createLocalCommandClient } from '../lib/local-comenzi.js';
import { getExecLocal } from '../lib/local-sqlite.js';
import { useToast } from '../lib/toast.js';

/**
 * Client de COMENZI autoritare pentru modurile retea/cloud, sau `null` in modul
 * local (fara server) — unde nu exista motor de comenzi si UI-ul cade pe CRUD.
 *
 * Postarea/stornarea unui document trebuie sa treaca prin comenzile serverului
 * (@gr/application: stoc + jurnal + fiscal atomic), nu printr-un PATCH de stare.
 * Tokenul de sesiune e citit LIVE (prin ref) la fiecare cerere, ca reinnoirea
 * sesiunii sa nu ceara reconstruirea clientului — la fel ca DataProviderContext.
 *
 * Transportul e invelit cu coada OFFLINE (@gr/data `createOfflineCommandClient`):
 * daca serverul e inaccesibil, comanda se pune in coada (persistata in
 * localStorage) cu o cheie de idempotenta si se reda automat la reconectare
 * (evenimentul `online`). Serverul aplica aceeasi idempotenta (Faza 4), deci o
 * redare dubla nu posteaza de doua ori. Apelantii primesc `ComandaInCoadaError`
 * cand o comanda a fost pusa in coada (vezi `esteInCoada`).
 */
export function useComenzi(): ClientComenziOffline | null {
  const { user } = useAuth();
  const userRef = useRef(user);
  userRef.current = user;
  const toast = useToast();

  // Configuratia de deployment e citita din localStorage (ca in data-context):
  // stabila pe durata sesiunii, deci o citim o data la construirea clientului.
  const mod = localStorage.getItem('gr-deployment-mode') ?? 'local';
  const serverUrl = localStorage.getItem('gr-server-url') ?? '';
  const foloseesteServer = mod !== 'local' && mod !== 'local-sqlite' && serverUrl.trim().length > 0;
  const modLocalSqlite = mod === 'local-sqlite';

  const client = useMemo(() => {
    // Mod retea/cloud: comenzi autoritare pe server, invelite cu coada offline.
    if (foloseesteServer) {
      return createOfflineCommandClient(
        createCommandClient(serverUrl.trim(), () => userRef.current?.token ?? null),
        { stocator: stocatorStorage(localStorage) },
      );
    }
    // Mod local-sqlite: ACELASI motor @gr/application rulat pe executorul SQLite-WASM
    // din browser (postarea scrie registrele local). `data-context` a initializat deja
    // executorul inainte sa randeze paginile, deci `getExecLocal()` e gata aici.
    if (modLocalSqlite) {
      const exec = getExecLocal();
      return exec ? createLocalCommandClient(exec, userRef.current?.nume ?? 'local') : null;
    }
    // Mod demo (in-memory): fara motor de comenzi — UI-ul cade pe CRUD.
    return null;
  }, [foloseesteServer, serverUrl, modLocalSqlite]);

  // La reconectare (si o data la montare, in caz ca au ramas comenzi dintr-o
  // sesiune anterioara), redam coada catre server si anuntam rezultatul.
  useEffect(() => {
    if (!client) return;
    const reda = async () => {
      if (client.inAsteptare().length === 0) return;
      const rez = await client.sincronizeaza();
      if (rez.redate > 0) {
        toast.success(
          `Reconectat: ${rez.redate} ${rez.redate === 1 ? 'comanda trimisa' : 'comenzi trimise'} din coada.`,
        );
      }
      if (rez.esuate.length > 0) {
        toast.error(
          `${rez.esuate.length} ${rez.esuate.length === 1 ? 'comanda din coada a fost respinsa' : 'comenzi din coada au fost respinse'} de server.`,
        );
      }
    };
    void reda();
    window.addEventListener('online', reda);
    return () => window.removeEventListener('online', reda);
  }, [client, toast]);

  return client;
}
