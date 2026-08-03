import {
  CHEIE_PUBLICA_DEMO,
  type EditionId,
  type Entitlements,
  type LicentaPayload,
  type ModuleId,
  type StareLicenta,
  areModul as areModulFn,
  entitlementsDinLicenta,
  entitlementsImplicite,
  permiteScriere,
  stareLicenta,
  verificaLicenta,
} from '@gr/license';
import { type ReactNode, createContext, useCallback, useContext, useEffect, useState } from 'react';

/**
 * Cheia PUBLICA a furnizorului (ECDSA P-256) — verifica semnatura licentei.
 * A NU se confunda cu o cheie secreta: fiind publica, poate fi vazuta de
 * oricine citeste acest cod fara sa permita emiterea unei licente noi (doar
 * cheia PRIVATA corespunzatoare, tinuta offline de furnizor si NICIODATA
 * distribuita clientilor, poate semna — vezi packages/license/scripts).
 * Aceeasi constanta e folosita si de server (enforcement-ul de utilizatori),
 * ca sa nu apara drift intre cele doua.
 */
const VENDOR_CHEIE_PUBLICA = CHEIE_PUBLICA_DEMO;
const LS_LICENSE = 'gr-license';
const LS_EDITION = 'gr-edition';

interface LicenseContextValue {
  ent: Entitlements;
  areModul: (m: ModuleId) => boolean;
  activeaza: (cheie: string) => Promise<boolean>;
  seteazaEditie: (e: EditionId) => void;
  reset: () => void;
  /** Starea comerciala in timp (trial / expira curand / gratie / expirata). */
  stare: StareLicenta;
  /**
   * `false` doar cand licenta a expirat definitiv (dupa perioada de gratie).
   * Citirea si exportul raman permise si atunci — vezi withLicentaGuard.
   */
  poateScrie: boolean;
}

const Ctx = createContext<LicenseContextValue | null>(null);

export function LicenseProvider({ children }: { children: ReactNode }) {
  const [ent, setEnt] = useState<Entitlements>(() => entitlementsImplicite('mobila'));
  // Payload-ul brut al licentei active, pastrat separat de entitlements ca sa
  // putem recalcula starea in timp (o sesiune lasata deschisa peste noapte
  // trebuie sa observe trecerea in expirare).
  const [payload, setPayload] = useState<LicentaPayload | null>(null);
  const [acum, setAcum] = useState(() => new Date());

  useEffect(() => {
    const key = localStorage.getItem(LS_LICENSE);
    if (key) {
      verificaLicenta(key, VENDOR_CHEIE_PUBLICA).then((r) => {
        // O licenta expirata isi pastreaza payload-ul (semnatura e valida, doar
        // data a trecut) — o incarcam totusi, ca perioada de gratie sa
        // functioneze si dupa un restart al aplicatiei, nu doar in sesiunea in
        // care a expirat.
        if (r.valida) {
          setPayload(r.payload);
          setEnt(entitlementsDinLicenta(r.payload));
        } else if (r.motiv === 'expirata') {
          setPayload(r.payload);
          setEnt(entitlementsDinLicenta(r.payload));
        }
      });
    } else {
      const ed = localStorage.getItem(LS_EDITION) as EditionId | null;
      setEnt(entitlementsImplicite(ed ?? 'mobila'));
    }
  }, []);

  // Reevalueaza starea din ora in ora: fara asta, o aplicatie lasata deschisa
  // ar continua sa afiseze "mai ai 1 zi" si dupa ce licenta chiar a expirat.
  useEffect(() => {
    const t = setInterval(() => setAcum(new Date()), 60 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  const activeaza = useCallback(async (cheie: string) => {
    const r = await verificaLicenta(cheie, VENDOR_CHEIE_PUBLICA);
    // Acceptam si o licenta aflata in perioada de gratie (tocmai expirata):
    // clientul poate fi in curs de reinnoire, iar refuzul brut ar fi inutil de
    // dur. O licenta expirata DEFINITIV, cu semnatura invalida sau cu format
    // gresit e insa respinsa.
    let p: LicentaPayload;
    if (r.valida) {
      p = r.payload;
    } else if (r.motiv === 'expirata' && stareLicenta(r.payload).stare === 'gratie') {
      p = r.payload;
    } else {
      return false;
    }
    localStorage.setItem(LS_LICENSE, cheie.trim());
    setPayload(p);
    setEnt(entitlementsDinLicenta(p));
    setAcum(new Date());
    return true;
  }, []);

  const seteazaEditie = useCallback((e: EditionId) => {
    // permis doar in mod nelicentiat (demo/dev)
    if (localStorage.getItem(LS_LICENSE)) return;
    localStorage.setItem(LS_EDITION, e);
    setEnt(entitlementsImplicite(e));
  }, []);

  const reset = useCallback(() => {
    localStorage.removeItem(LS_LICENSE);
    setPayload(null);
    setEnt(
      entitlementsImplicite((localStorage.getItem(LS_EDITION) as EditionId | null) ?? 'mobila'),
    );
  }, []);

  const stare = stareLicenta(payload, acum);

  return (
    <Ctx.Provider
      value={{
        ent,
        areModul: (m) => areModulFn(ent, m),
        activeaza,
        seteazaEditie,
        reset,
        stare,
        poateScrie: permiteScriere(stare),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useLicense(): LicenseContextValue {
  const c = useContext(Ctx);
  if (!c) throw new Error('useLicense must be used within LicenseProvider');
  return c;
}
