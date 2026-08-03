import { difCampuri, rezumaModificare } from '@gr/core-domain';
import type { AuditEntry, AuditEntryInput } from '@gr/core-domain';
import type { Repository } from './repository.js';

/** Cine face mutatia — injectat din stratul de UI (nu are @gr/data nevoie de @gr/auth). */
export interface CineScrie {
  utilizator: string;
  rol: string;
}

/**
 * Decoreaza un Repository cu scriere automata in jurnalul de audit la fiecare
 * create/update/remove. Nu modifica semantica repository-ului decorat —
 * doar adauga o intrare de audit dupa ce operatia a reusit.
 */
export function withAudit<T extends { id: string }, TInput>(
  repo: Repository<T, TInput>,
  entitate: string,
  auditLog: Repository<AuditEntry, AuditEntryInput>,
  cineScrie: () => CineScrie,
): Repository<T, TInput> {
  const scrieAudit = async (
    actiune: AuditEntry['actiune'],
    entitateId: string,
    detalii: string,
  ): Promise<void> => {
    const { utilizator, rol } = cineScrie();
    await auditLog.create({
      timp: new Date().toISOString(),
      utilizator,
      rol,
      actiune,
      entitate,
      entitateId,
      detalii,
    });
  };

  return {
    list: () => repo.list(),
    getById: (id) => repo.getById(id),
    async create(input) {
      const creat = await repo.create(input);
      await scrieAudit('creare', creat.id, '');
      return creat;
    },
    async update(id, patch) {
      const inainte = await repo.getById(id);
      const dupa = await repo.update(id, patch);
      const campuri = difCampuri(
        inainte as unknown as Record<string, unknown> | null,
        dupa as unknown as Record<string, unknown>,
      );
      await scrieAudit('actualizare', id, rezumaModificare(campuri));
      return dupa;
    },
    async remove(id) {
      await repo.remove(id);
      await scrieAudit('stergere', id, '');
    },
  };
}
