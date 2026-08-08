import {
  type Document,
  type DocumentLinie,
  type Gestiune,
  type MiscareStoc,
  type Produs,
  type SoldStoc,
  genereazaMiscari,
  ruleazaStoc,
} from '@gr/core-domain';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useData } from '../lib/data-context.js';
import { useRapoarte } from './useRapoarte.js';

/**
 * Sursa unica pentru fise de magazie, balanta stocurilor, rulaje si reevaluare.
 *
 * In modul RETEA/cloud citeste miscarile + soldurile din REGISTRUL persistat al
 * serverului (scris la postare — sursa de adevar), prin `useRapoarte`. In modul
 * LOCAL (fara motor) le RECALCULEAZA din documentele validate (CMP), ca inainte.
 *
 * Expune `reload()` pentru fluxurile care creeaza documente ce afecteaza stocul in
 * acelasi ecran fara sa navigheze (ex. ProductieMobilaPage vrea sa vada imediat
 * costul/marja actualizate).
 */
export function useStoc() {
  const db = useData();
  const rapoarte = useRapoarte();
  const [documente, setDocumente] = useState<Document[]>([]);
  const [linii, setLinii] = useState<DocumentLinie[]>([]);
  const [produse, setProduse] = useState<Produs[]>([]);
  const [gestiuni, setGestiuni] = useState<Gestiune[]>([]);
  // Miscari/solduri persistate (mod retea); `null` = nu s-au incarcat inca.
  const [persistat, setPersistat] = useState<{
    miscari: MiscareStoc[];
    solduri: SoldStoc[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    // Nomenclatoarele (produse/gestiuni) vin din provider in ambele moduri.
    const nomencl = Promise.all([db.produse.list(), db.gestiuni.list()]).then(([p, g]) => {
      setProduse(p);
      setGestiuni(g);
    });
    if (rapoarte) {
      // Mod retea: stocul din registrul persistat.
      return Promise.all([nomencl, rapoarte.stoc()]).then(([, s]) => {
        setPersistat(s);
        setLoading(false);
      });
    }
    // Mod local: recalculare din documente.
    setPersistat(null);
    return Promise.all([nomencl, db.documente.list(), db.documenteLinii.list()]).then(
      ([, d, l]) => {
        setDocumente(d);
        setLinii(l);
        setLoading(false);
      },
    );
  }, [db, rapoarte]);

  useEffect(() => {
    reload();
  }, [reload]);

  const { miscari, solduri } = useMemo(() => {
    if (persistat) return { miscari: persistat.miscari, solduri: persistat.solduri };
    // O singura trecere prin ruleazaStoc (CMP): solduri + miscari evaluate impreuna.
    const out: MiscareStoc[] = [];
    for (const doc of documente) {
      if (doc.stare !== 'validat') continue;
      const ll = linii.filter((l) => l.documentId === doc.id);
      out.push(...genereazaMiscari(doc, ll));
    }
    const r = ruleazaStoc(out);
    return { miscari: r.miscariEvaluate, solduri: r.solduri };
  }, [persistat, documente, linii]);

  const produsById = useMemo(() => new Map(produse.map((p) => [p.id, p])), [produse]);
  const gestiuneById = useMemo(() => new Map(gestiuni.map((g) => [g.id, g])), [gestiuni]);

  return { loading, miscari, solduri, produse, gestiuni, produsById, gestiuneById, reload };
}
