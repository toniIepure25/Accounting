import {
  type Document,
  type DocumentLinie,
  type Gestiune,
  type MiscareStoc,
  type Produs,
  genereazaMiscari,
  ruleazaStoc,
} from '@gr/core-domain';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useData } from '../lib/data-context.js';

/**
 * Calculeaza stocul (solduri + miscari evaluate CMP) din documentele validate.
 * Sursa unica pentru fise de magazie, balanta stocurilor, rulaje si reevaluare.
 *
 * Expune `reload()` (ca @gr/ui/useCollection) pentru fluxurile care creeaza
 * documente ce afecteaza stocul in acelasi ecran fara sa navigheze (ex.
 * ProductieMobilaPage genereaza un bon de consum si vrea sa vada imediat
 * costul/marja actualizate, nu abia dupa un remount al paginii).
 */
export function useStoc() {
  const db = useData();
  const [documente, setDocumente] = useState<Document[]>([]);
  const [linii, setLinii] = useState<DocumentLinie[]>([]);
  const [produse, setProduse] = useState<Produs[]>([]);
  const [gestiuni, setGestiuni] = useState<Gestiune[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    return Promise.all([
      db.documente.list(),
      db.documenteLinii.list(),
      db.produse.list(),
      db.gestiuni.list(),
    ]).then(([d, l, p, g]) => {
      setDocumente(d);
      setLinii(l);
      setProduse(p);
      setGestiuni(g);
      setLoading(false);
    });
  }, [db]);

  useEffect(() => {
    reload();
  }, [reload]);

  // O singura trecere prin ruleazaStoc (CMP) — returneaza deja solduri +
  // miscari evaluate impreuna, deci nu se recalculeaza a doua oara peste
  // miscarile deja evaluate (redundant si fragil daca logica CMP s-ar schimba).
  const { miscari, solduri } = useMemo(() => {
    const out: MiscareStoc[] = [];
    for (const doc of documente) {
      if (doc.stare !== 'validat') continue;
      const ll = linii.filter((l) => l.documentId === doc.id);
      out.push(...genereazaMiscari(doc, ll));
    }
    const r = ruleazaStoc(out);
    return { miscari: r.miscariEvaluate, solduri: r.solduri };
  }, [documente, linii]);

  const produsById = useMemo(() => new Map(produse.map((p) => [p.id, p])), [produse]);
  const gestiuneById = useMemo(() => new Map(gestiuni.map((g) => [g.id, g])), [gestiuni]);

  return { loading, miscari, solduri, produse, gestiuni, produsById, gestiuneById, reload };
}
