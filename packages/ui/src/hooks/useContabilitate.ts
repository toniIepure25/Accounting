import {
  type Document,
  type NotaContabila,
  type OperatiuneCasa,
  genereazaNoteContabile,
} from '@gr/core-domain';
import { useEffect, useMemo, useState } from 'react';
import { useData } from '../lib/data-context.js';
import { useStoc } from './useStoc.js';

/**
 * Asambleaza notele contabile (partida dubla) din documente + casa, folosind
 * conturile de stoc din gestiuni si costul marfii vandute din miscarile de stoc.
 */
export function useContabilitate(): { note: NotaContabila[]; loading: boolean } {
  const db = useData();
  const { miscari, gestiuneById, loading } = useStoc();
  const [documente, setDocumente] = useState<Document[]>([]);
  const [casa, setCasa] = useState<OperatiuneCasa[]>([]);

  useEffect(() => {
    db.documente.list().then(setDocumente);
    db.operatiuniCasa.list().then(setCasa);
  }, [db]);

  const note = useMemo(() => {
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

  return { note, loading };
}
