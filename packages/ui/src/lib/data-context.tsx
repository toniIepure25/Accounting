import {
  type DataProvider,
  type Repository,
  createApiProvider,
  createMemoryProvider,
  demoSeed,
  withAudit,
  withFirmaScope,
  withLicentaGuard,
} from '@gr/data';
import {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAuth } from './auth-context.js';
import { EVENIMENT_FIRMA_SCHIMBATA, LS_FIRMA } from './firma-context.js';
import { useLicense } from './license-context.js';
import { creeazaProviderLocalSqlite } from './local-sqlite.js';

const DataContext = createContext<DataProvider | null>(null);

/**
 * Repository-urile care poarta `firmaId` (vezi Document.firmaId) si trebuie
 * scopate pe firma curenta — restul (nomenclatoare: parteneri, produse,
 * gestiuni...) raman comune tuturor firmelor dintr-o instalare, decizie
 * deliberata, nu un gol.
 */
const CHEI_SCOPATE_PE_FIRMA: readonly (keyof DataProvider)[] = [
  'documente',
  'documenteLinii',
  'operatiuniCasa',
  'operatiuniBancare',
  'mijloaceFixe',
];

/**
 * Furnizeaza DataProvider-ul aplicatiei.
 * - local (fara server configurat in Setari): provider in-memory cu date demo.
 * - lan/cloud (server configurat): client subtire prin `createApiProvider`,
 *   care ataseaza tokenul de sesiune curent pe fiecare cerere — serverul
 *   (server/src/auth.ts) impune RBAC-ul real, nu doar UI-ul.
 * - Desktop (Tauri): se poate injecta si un provider SQL (SQLite) la bootstrap.
 *
 * UI-ul depinde doar de interfata DataProvider, deci schimbarea backendului nu
 * afecteaza ecranele. Fiecare repository (in afara de `auditLog` si
 * `numerotare`) e decorat cu `withAudit`, ca orice creare/actualizare/stergere
 * sa apara in jurnalul de audit cu utilizatorul si rolul curent (citite din
 * AuthContext printr-un ref, ca provider-ul sa nu se reconstruiasca la fiecare
 * schimbare de sesiune). Peste asta, resursele din `CHEI_SCOPATE_PE_FIRMA` mai
 * primesc si `withFirmaScope` — pentru modurile retea/cloud, aceeasi scopare e
 * impusa AUTORITATIV pe server (server/src/index.ts), fiindca un client nu
 * poate fi de incredere sa se auto-limiteze la firma lui.
 *
 * Stratul de baza (`base`: memory sau API) se construieste O SINGURA DATA per
 * mod de deployment — NU la schimbarea firmei, altfel providerul in-memory
 * ar arunca tot ce s-a creat in sesiune. Doar stratul de DECORARE (audit +
 * firma-scope) se reconstruieste la schimbarea firmei (`EVENIMENT_FIRMA_SCHIMBATA`),
 * ca sa dea repository-uri cu identitate NOUA — `useCollection` (folosit peste
 * tot) reincarca automat cand primeste un repo nou, exact ca la schimbarea
 * modului de deployment. Fara asta, paginile deja deschise ar ramane cu datele
 * vechii firme pana la o navigare noua.
 */
export function DataProviderContext({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userRef = useRef(user);
  userRef.current = user;

  // Citita printr-un ref, la fel ca sesiunea: garda de licenta trebuie sa vada
  // mereu starea CURENTA, dar o schimbare de licenta nu are voie sa reconstruiasca
  // providerul de baza (ar goli datele demo din sesiune, vezi comentariul de mai jos).
  const { poateScrie } = useLicense();
  const poateScrieRef = useRef(poateScrie);
  poateScrieRef.current = poateScrie;

  const mod = localStorage.getItem('gr-deployment-mode') ?? 'local';
  const serverUrl = localStorage.getItem('gr-server-url') ?? '';
  const modLocalSqlite = mod === 'local-sqlite';
  const foloseesteServer = mod !== 'local' && !modLocalSqlite && serverUrl.trim().length > 0;

  // Server + demo (in-memory) se construiesc SINCRON. Modul `local-sqlite` (motor
  // SQLite-WASM real, offline) se initializeaza ASINCRON (incarca WASM + migreaza +
  // seed/persistenta), deci baza incepe `null` si se completeaza dupa init; daca
  // WASM pica, cadem pe providerul in-memory ca aplicatia sa nu ramana blocata.
  const construiesteSincron = (): DataProvider =>
    foloseesteServer
      ? createApiProvider(serverUrl.trim(), () => userRef.current?.token ?? null)
      : createMemoryProvider(demoSeed);

  const [base, setBase] = useState<DataProvider | null>(() =>
    modLocalSqlite ? null : construiesteSincron(),
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: init o singura data per mod (modul se schimba doar prin reload din Setari).
  useEffect(() => {
    if (!modLocalSqlite) return;
    let viu = true;
    creeazaProviderLocalSqlite()
      .then((p) => viu && setBase(() => p))
      .catch((e) => {
        console.error('init local-sqlite esuat — cad pe providerul in-memory:', e);
        if (viu) setBase(() => createMemoryProvider(demoSeed));
      });
    return () => {
      viu = false;
    };
  }, [modLocalSqlite]);

  const [firmaSemnal, setFirmaSemnal] = useState(() => localStorage.getItem(LS_FIRMA));
  useEffect(() => {
    const asculta = (e: Event) => setFirmaSemnal((e as CustomEvent<string>).detail);
    window.addEventListener(EVENIMENT_FIRMA_SCHIMBATA, asculta);
    return () => window.removeEventListener(EVENIMENT_FIRMA_SCHIMBATA, asculta);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `firmaSemnal` nu e citit direct in corp (firma curenta se citeste live prin firmaCurenta()) — e in deps doar ca sa forteze repo-uri NOI (identitate noua) la schimbarea firmei, ca useCollection sa reincarce automat.
  const provider = useMemo<DataProvider | null>(() => {
    if (!base) return null; // init local-sqlite inca in curs
    const cineScrie = () => ({
      utilizator: userRef.current?.nume ?? 'necunoscut',
      rol: userRef.current?.rol ?? '',
    });
    const firmaCurenta = () => localStorage.getItem(LS_FIRMA);

    // biome-ignore lint/suspicious/noExplicitAny: decorare generica a provider-ului
    const decorat: any = { ...base };
    for (const key of Object.keys(base) as (keyof DataProvider)[]) {
      if (key === 'auditLog' || key === 'numerotare') continue;
      let repo = base[key] as unknown as Repository<{ id: string }, unknown>;
      if (CHEI_SCOPATE_PE_FIRMA.includes(key)) {
        // biome-ignore lint/suspicious/noExplicitAny: entitatile scopate au toate firmaId, dar tipul generic al buclei nu o poate exprima
        repo = withFirmaScope(repo as any, firmaCurenta) as unknown as Repository<
          { id: string },
          unknown
        >;
      }
      // Ordinea conteaza: garda de licenta e stratul cel mai din AFARA, ca o
      // scriere blocata sa nu ajunga nici macar sa fie inregistrata in audit
      // (altfel jurnalul s-ar umple cu incercari care nu s-au intamplat).
      decorat[key] = withLicentaGuard(
        withAudit(repo, key, base.auditLog, cineScrie),
        () => poateScrieRef.current,
      );
    }
    return decorat as DataProvider;
  }, [base, firmaSemnal]);

  if (!provider) {
    // Doar in modul `local-sqlite`, cat timp motorul WASM se initializeaza.
    return (
      <div className="flex min-h-screen items-center justify-center text-fg-muted">
        Se initializeaza motorul local (SQLite)…
      </div>
    );
  }

  return <DataContext.Provider value={provider}>{children}</DataContext.Provider>;
}

export function useData(): DataProvider {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProviderContext');
  return ctx;
}
