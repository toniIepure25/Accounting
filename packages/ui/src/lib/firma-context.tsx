import type { Firma } from '@gr/core-domain';
import { type ReactNode, createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useData } from './data-context.js';

/** Exportat pentru data-context.tsx (scoparea multi-firma citeste direct din localStorage, ca sa evite o dependinta circulara intre cele doua contexte). */
export const LS_FIRMA = 'gr-firma-id';

/**
 * Emis de fiecare data cand firma curenta se schimba (selectie manuala SAU
 * fallback persistat automat) — `data-context.tsx` asculta acest eveniment ca
 * sa reconstruiasca stratul de repository-uri scopate, altfel paginile deja
 * deschise (`useCollection`) nu s-ar reincarca decat la o navigare noua.
 * Evenimentul nativ `storage` NU functioneaza aici: el se declanseaza doar in
 * ALTE tab-uri/ferestre, niciodata in tab-ul care a facut chiar el scrierea.
 */
export const EVENIMENT_FIRMA_SCHIMBATA = 'gr-firma-schimbata';

function anuntaFirmaSchimbata(id: string): void {
  window.dispatchEvent(new CustomEvent<string>(EVENIMENT_FIRMA_SCHIMBATA, { detail: id }));
}

interface FirmaContextValue {
  firme: Firma[];
  firmaCurenta: Firma | null;
  selecteazaFirma: (id: string) => void;
  reincarca: () => void;
}

const Ctx = createContext<FirmaContextValue | null>(null);

/**
 * Context de firma activa (multi-firma: o instalare poate gestiona mai multe
 * firme, ex. un contabil cu mai multi clienti). Firma selectata e persistata
 * local (`LS_FIRMA`) si citita direct de acolo de `data-context.tsx` (vezi
 * `withFirmaScope`), ca documentele/casa/banca/mijloacele fixe sa fie scopate
 * pe firma curenta — impus si server-side (server/src/index.ts) pentru
 * modurile retea/cloud. Nomenclatoarele (parteneri, produse, gestiuni...)
 * raman comune tuturor firmelor, deliberat.
 */
export function FirmaProvider({ children }: { children: ReactNode }) {
  const db = useData();
  const [firme, setFirme] = useState<Firma[]>([]);
  const [firmaId, setFirmaId] = useState<string | null>(() => localStorage.getItem(LS_FIRMA));

  const reincarca = useCallback(() => {
    db.firme.list().then(setFirme);
  }, [db]);

  useEffect(() => {
    reincarca();
  }, [reincarca]);

  const selecteazaFirma = useCallback((id: string) => {
    localStorage.setItem(LS_FIRMA, id);
    setFirmaId(id);
    anuntaFirmaSchimbata(id);
  }, []);

  const firmaCurenta = firme.find((f) => f.id === firmaId) ?? firme[0] ?? null;

  // Cazul obisnuit (o singura firma): utilizatorul nu vede/atinge niciodata
  // selectorul (randat doar cand `firme.length > 1`), deci `firmaId` (starea)
  // ramane `null` la nesfarsit — fara linia de mai jos, `data-context.tsx`
  // (care citeste `LS_FIRMA` direct din localStorage, ca sa evite dependinta
  // circulara) ar vedea mereu `null` si NU ar stampila firmaId la creare.
  // Documentele ar ramane "nescopate" — inofensiv cat exista o singura firma,
  // dar ar deveni vizibile pentru orice firma noua adaugata ulterior. Rezolvat
  // salvand explicit rezultatul fallback-ului (nu doar selectia manuala).
  useEffect(() => {
    if (firmaCurenta && !firmaId) {
      localStorage.setItem(LS_FIRMA, firmaCurenta.id);
      anuntaFirmaSchimbata(firmaCurenta.id);
    }
  }, [firmaCurenta, firmaId]);

  return (
    <Ctx.Provider value={{ firme, firmaCurenta, selecteazaFirma, reincarca }}>
      {children}
    </Ctx.Provider>
  );
}

export function useFirma(): FirmaContextValue {
  const c = useContext(Ctx);
  if (!c) throw new Error('useFirma must be used within FirmaProvider');
  return c;
}
