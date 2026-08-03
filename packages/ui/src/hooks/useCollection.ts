import type { Repository } from '@gr/data';
import { useCallback, useEffect, useState } from 'react';

/** Hook CRUD peste un Repository: incarca, reincarca, creeaza, actualizeaza, sterge. */
export function useCollection<T extends { id: string }, TInput>(repo: Repository<T, TInput>) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    repo.list().then((r) => {
      setRows(r);
      setLoading(false);
    });
  }, [repo]);

  useEffect(() => {
    reload();
  }, [reload]);

  const create = useCallback(
    async (input: TInput) => {
      await repo.create(input);
      reload();
    },
    [repo, reload],
  );

  const update = useCallback(
    async (id: string, patch: Partial<TInput>) => {
      await repo.update(id, patch);
      reload();
    },
    [repo, reload],
  );

  const remove = useCallback(
    async (id: string) => {
      await repo.remove(id);
      reload();
    },
    [repo, reload],
  );

  return { rows, loading, reload, create, update, remove };
}
