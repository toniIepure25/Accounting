import type { Document } from '@gr/core-domain';
import type { CursorDocument } from '@gr/data';
import { useCallback, useEffect, useState } from 'react';
import { useData } from '../lib/data-context.js';
import { useRapoarte } from './useRapoarte.js';

/**
 * Documentele de un anumit TIP, ca sursa pentru listele din DocumentEditor.
 *
 * In modul RETEA/cloud foloseste interogarea KEYSET a serverului
 * (`/reports/documents`, RK-13): filtrare pe tip + firma pe SERVER, in pagini
 * marginite (indexate), acumulate — nu mai aduce toata tabela in client ca s-o
 * filtreze acolo. In modul LOCAL cade pe `list()` + filtrare (memory provider).
 *
 * `tip` optional: cand lipseste (ex. picker de document-sursa neconfigurat) nu se
 * incarca nimic, ca sa nu tragem toate documentele degeaba.
 */
export function useDocumenteTip(
  tip: string | undefined,
  optiuni: { stare?: string } = {},
): { rows: Document[]; loading: boolean; reload: () => Promise<void> } {
  const db = useData();
  const rapoarte = useRapoarte();
  const [rows, setRows] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const stare = optiuni.stare;

  const reload = useCallback(async () => {
    if (!tip) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    if (rapoarte) {
      // Keyset: pagini marginite (max 500), continuate pe cursor pana la capat.
      const acc: Document[] = [];
      let dupa: CursorDocument | undefined;
      do {
        const pagina = await rapoarte.documente({ tip, stare }, { limita: 500, dupa });
        acc.push(...pagina.randuri);
        dupa = pagina.urmatorCursor ?? undefined;
      } while (dupa);
      setRows(acc);
    } else {
      const toate = await db.documente.list();
      setRows(toate.filter((d) => d.tip === tip && (!stare || d.stare === stare)));
    }
    setLoading(false);
  }, [db, rapoarte, tip, stare]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { rows, loading, reload };
}
