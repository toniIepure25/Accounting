/** Contractul CRUD pe care il expune fiecare repository, indiferent de backend. */
export interface Repository<T, TInput> {
  list(): Promise<T[]>;
  getById(id: string): Promise<T | null>;
  create(input: TInput): Promise<T>;
  update(id: string, patch: Partial<TInput>): Promise<T>;
  remove(id: string): Promise<void>;
}

/**
 * Repository generic in-memory, folosit pentru demo web (fara DB) si in teste.
 * Pastreaza aceeasi semantica precum implementarile SQL.
 */
export function createMemoryRepository<T extends { id: string }, TInput>(
  buildEntity: (input: TInput, id: string) => T,
  seed: readonly T[] = [],
): Repository<T, TInput> {
  const store = new Map<string, T>(seed.map((e) => [e.id, structuredClone(e)]));

  return {
    async list() {
      return [...store.values()].map((e) => structuredClone(e));
    },
    async getById(id) {
      const e = store.get(id);
      return e ? structuredClone(e) : null;
    },
    async create(input) {
      // Respecta un id explicit din input (ex. la restaurare din backup, ca sa
      // pastreze relatiile intre tabele) — la fel ca repository-ul SQL generic.
      // Niciun apel existent nu seteaza `id` la creare, deci e neutru altfel.
      const id = (input as { id?: string }).id ?? crypto.randomUUID();
      const entity = buildEntity(input, id);
      store.set(id, entity);
      return structuredClone(entity);
    },
    async update(id, patch) {
      const current = store.get(id);
      if (!current) throw new Error(`Entitatea ${id} nu exista`);
      const updated = { ...current, ...patch } as T;
      store.set(id, updated);
      return structuredClone(updated);
    },
    async remove(id) {
      store.delete(id);
    },
  };
}
