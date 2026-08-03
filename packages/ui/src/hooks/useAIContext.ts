import type { ContextGestiune } from '@gr/ai';
import { type Document, type OperatiuneCasa, type Partener, registruCasa } from '@gr/core-domain';
import { decontTVA } from '@gr/fiscal-ro';
import { useEffect, useMemo, useState } from 'react';
import { useData } from '../lib/data-context.js';
import { useStoc } from './useStoc.js';

/** Construieste instantaneul de gestiune oferit asistentului AI. */
export function useAIContext(): ContextGestiune {
  const db = useData();
  const { solduri, produse } = useStoc();
  const [documente, setDocumente] = useState<Document[]>([]);
  const [casa, setCasa] = useState<OperatiuneCasa[]>([]);
  const [parteneri, setParteneri] = useState<Partener[]>([]);

  useEffect(() => {
    db.documente.list().then(setDocumente);
    db.operatiuniCasa.list().then(setCasa);
    db.parteneri.list().then(setParteneri);
  }, [db]);

  return useMemo<ContextGestiune>(() => {
    // stoc total pe produs (peste toate gestiunile)
    const stocPeProdus = new Map<string, number>();
    for (const s of solduri)
      stocPeProdus.set(s.produsId, (stocPeProdus.get(s.produsId) ?? 0) + s.cantitate);

    const produseSubMinim = produse
      .filter((p) => p.stocMinim > 0 && (stocPeProdus.get(p.id) ?? 0) < p.stocMinim)
      .map((p) => ({
        denumire: p.denumire,
        stoc: stocPeProdus.get(p.id) ?? 0,
        minim: p.stocMinim,
      }));

    const valoareStocBani = solduri.reduce((a, s) => a + s.valoareBani, 0);
    const soldCasaBani = registruCasa(casa, 0).soldFinalBani;
    const tvaDePlataBani = decontTVA(documente).dePlataBani;
    const comenziInLucru = documente.filter(
      (d) => d.tip === 'comanda_mobila' && d.stare === 'validat',
    ).length;
    const vanzariBrutBani = documente
      .filter(
        (d) =>
          d.stare === 'validat' && (d.tip === 'factura_vanzare' || d.tip === 'vanzare_amanunt'),
      )
      .reduce((a, d) => a + d.totalBrutBani, 0);

    return {
      soldCasaBani,
      valoareStocBani,
      produseSubMinim,
      comenziInLucru,
      tvaDePlataBani,
      nrClienti: parteneri.filter((p) => p.tip === 'client' || p.tip === 'ambele').length,
      nrFurnizori: parteneri.filter((p) => p.tip === 'furnizor' || p.tip === 'ambele').length,
      vanzariBrutBani,
    };
  }, [solduri, produse, casa, documente, parteneri]);
}
