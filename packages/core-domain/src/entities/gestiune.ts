import { z } from 'zod';

/**
 * Gestiune (loc de stocare / gestionar responsabil).
 *
 * Migrata din tabela `Gestiuni` a aplicatiei KISS (coloane COD, DEN, GST, CS, DS).
 * Mapare legacy -> nou:
 *   COD -> cod, DEN -> denumire, GST -> gestionar,
 *   CS  -> contSintetic, DS -> contAnalitic (interpretare; configurabil).
 */
export const TipGestiune = z.enum(['cantitativ_valorica', 'global_valorica']);
export type TipGestiune = z.infer<typeof TipGestiune>;

export const GestiuneSchema = z.object({
  id: z.string().uuid(),
  cod: z.string().min(1).max(20),
  denumire: z.string().min(1).max(120),
  gestionar: z.string().max(120).default(''),
  contSintetic: z.string().max(20).default(''),
  contAnalitic: z.string().max(20).default(''),
  tip: TipGestiune.default('cantitativ_valorica'),
  punctDeLucruId: z.string().uuid().nullable().default(null),
  activ: z.boolean().default(true),
});

export type Gestiune = z.infer<typeof GestiuneSchema>;

export const GestiuneInputSchema = GestiuneSchema.omit({ id: true });
export type GestiuneInput = z.infer<typeof GestiuneInputSchema>;
