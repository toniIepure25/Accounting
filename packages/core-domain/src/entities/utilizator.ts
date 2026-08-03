import { z } from 'zod';

/**
 * Utilizator cu cont real (nume + parola hash-uita + rol). Sursa de adevar
 * pentru autentificarea server-side (POST /auth/login) — separat de
 * simularea client-side din modul demo/local (vezi packages/ui/lib/auth-context.tsx).
 */
export const RolUtilizator = z.enum(['admin', 'contabil', 'casier', 'gestionar', 'vanzator']);
export type RolUtilizator = z.infer<typeof RolUtilizator>;

export const UtilizatorSchema = z.object({
  id: z.string().uuid(),
  nume: z.string().min(1).max(120),
  parolaHash: z.string().min(1),
  rol: RolUtilizator,
  firmaId: z.string().uuid().nullable().default(null),
  activ: z.boolean().default(true),
});

export type Utilizator = z.infer<typeof UtilizatorSchema>;

export const UtilizatorInputSchema = UtilizatorSchema.omit({ id: true });
export type UtilizatorInput = z.infer<typeof UtilizatorInputSchema>;

/** Forma publica (fara hash de parola) trimisa catre client dupa login. */
export type UtilizatorPublic = Omit<Utilizator, 'parolaHash'>;

export function catrePublic(u: Utilizator): UtilizatorPublic {
  const { parolaHash: _parolaHash, ...rest } = u;
  return rest;
}
