import { z } from 'zod';

/** O intrare in jurnalul de audit — o mutatie (creare/actualizare/stergere). */
export const AuditActiune = z.enum(['creare', 'actualizare', 'stergere']);
export type AuditActiune = z.infer<typeof AuditActiune>;

export const AuditEntrySchema = z.object({
  id: z.string().uuid(),
  timp: z.string(), // ISO
  utilizator: z.string().default('necunoscut'),
  rol: z.string().default(''),
  actiune: AuditActiune,
  entitate: z.string().min(1), // numele tabelei/resursei (ex. "documente")
  entitateId: z.string().default(''),
  detalii: z.string().default(''), // rezumat scurt (ex. campurile modificate)
});
export type AuditEntry = z.infer<typeof AuditEntrySchema>;

export const AuditEntryInputSchema = AuditEntrySchema.omit({ id: true });
export type AuditEntryInput = z.infer<typeof AuditEntryInputSchema>;
