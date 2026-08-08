import {
  type Document,
  type NotaContabila,
  type OperatiuneCasa,
  genereazaNoteContabile,
} from '@gr/core-domain';
import { useEffect, useMemo, useState } from 'react';
import { useData } from '../lib/data-context.js';
import { useRapoarte } from './useRapoarte.js';
import { useStoc } from './useStoc.js';

/**
 * Asambleaza notele contabile (partida dubla) folosite de rapoartele contabile
 * (registru-jurnal, cartea mare, balanta, fisa de cont).
 *
 * In modul RETEA/cloud le citeste din REGISTRUL persistat al serverului (scris la
 * postare — sursa de adevar), prin `useRapoarte`. In modul LOCAL (fara motor) le
 * RECALCULEAZA din documente + casa + miscarile de stoc (CMP), ca inainte. Aceeasi
 * forma `NotaContabila[]` in ambele cazuri, deci paginile nu se schimba.
 */
export function useContabilitate(): { note: NotaContabila[]; loading: boolean } {
  const db = useData();
  const rapoarte = useRapoarte();
  const { miscari, gestiuneById, loading: loadingStoc } = useStoc();
  const [documente, setDocumente] = useState<Document[]>([]);
  const [casa, setCasa] = useState<OperatiuneCasa[]>([]);

  // Note persistate (mod retea). `null` inseamna "nu s-au incarcat inca" cand
  // exista un client de rapoarte; ramane null in modul local.
  const [notePersistate, setNotePersistate] = useState<NotaContabila[] | null>(null);
  const [loadingPersistat, setLoadingPersistat] = useState(rapoarte != null);

  useEffect(() => {
    if (!rapoarte) {
      setNotePersistate(null);
      return;
    }
    let activ = true;
    setLoadingPersistat(true);
    rapoarte
      .noteContabile()
      .then((n) => activ && setNotePersistate(n))
      .catch(() => activ && setNotePersistate([]))
      .finally(() => activ && setLoadingPersistat(false));
    return () => {
      activ = false;
    };
  }, [rapoarte]);

  // Sursa pentru recalcularea locala (ignorata in modul retea).
  useEffect(() => {
    if (rapoarte) return;
    db.documente.list().then(setDocumente);
    db.operatiuniCasa.list().then(setCasa);
  }, [db, rapoarte]);

  const noteRecalculate = useMemo(() => {
    // Costul (CMP) al oricarei iesiri de stoc per document — vanzare SAU
    // consum de materiale, aceeasi sursa de adevar ca balanta stocurilor.
    const cost = new Map<string, number>();
    for (const m of miscari) {
      if (m.cantitate < 0) cost.set(m.documentId, (cost.get(m.documentId) ?? 0) - m.valoareBani);
    }
    return genereazaNoteContabile(documente, casa, {
      contStoc: (d) =>
        d.gestiuneId ? gestiuneById.get(d.gestiuneId)?.contSintetic || '371' : '371',
      costIesireBani: (id) => cost.get(id) ?? 0,
    });
  }, [documente, casa, miscari, gestiuneById]);

  if (rapoarte) return { note: notePersistate ?? [], loading: loadingPersistat };
  return { note: noteRecalculate, loading: loadingStoc };
}
