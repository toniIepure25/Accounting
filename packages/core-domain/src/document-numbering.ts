/**
 * Serii si numerotare de documente (facturi, NIR, avize, bonuri).
 * Numerotarea este configurabila per firma / punct de lucru / an.
 */
import { z } from 'zod';

export const SerieDocumentSchema = z.object({
  id: z.string().uuid(),
  /** Tipul documentului: factura, nir, aviz, bon_consum, chitanta etc. */
  tipDocument: z.string().min(1),
  /** Prefixul seriei, ex. "FCT", "NIR". */
  prefix: z.string().min(1).max(10),
  /** Anul aplicabil (numerotarea de obicei se reseteaza anual). */
  an: z.number().int().min(2000).max(2100),
  /** Ultimul numar alocat (0 daca nu s-a emis inca nimic). */
  ultimulNumar: z.number().int().min(0),
  /** Cate cifre are numarul (pentru zero-padding), ex. 6 -> 000123. */
  lungimeNumar: z.number().int().min(1).max(12).default(6),
  punctDeLucruId: z.string().uuid().nullable().default(null),
});

export type SerieDocument = z.infer<typeof SerieDocumentSchema>;

/** Returneaza numarul urmator si seria actualizata (functie pura). */
export function alocaNumar(serie: SerieDocument): {
  numar: number;
  cod: string;
  serieActualizata: SerieDocument;
} {
  const numar = serie.ultimulNumar + 1;
  const cod = formateazaCodDocument(serie, numar);
  return { numar, cod, serieActualizata: { ...serie, ultimulNumar: numar } };
}

/** Formateaza codul complet al documentului, ex. FCT-2026-000123. */
export function formateazaCodDocument(
  serie: Pick<SerieDocument, 'prefix' | 'an' | 'lungimeNumar'>,
  numar: number,
): string {
  return `${serie.prefix}-${serie.an}-${String(numar).padStart(serie.lungimeNumar, '0')}`;
}
