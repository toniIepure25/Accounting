import type { Repository } from '@gr/data';
import { useEffect, useState } from 'react';
import type { Option } from '../components/controls.js';

/** Incarca o colectie si o mapeaza in optiuni {value,label} pentru select-uri. */
export function useOptions<T extends { id: string }>(
  repo: Repository<T, unknown> | undefined,
  label: (row: T) => string,
  includeEmpty = true,
): Option[] {
  const [opts, setOpts] = useState<Option[]>([]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: label/includeEmpty sunt parametri de configurare (de obicei inline la apel), nu stare reactiva — doar `repo` justifica un reload.
  useEffect(() => {
    if (!repo) return;
    repo.list().then((rows) => {
      const mapped = rows.map((r) => ({ value: r.id, label: label(r) }));
      setOpts(includeEmpty ? [{ value: '', label: '— selecteaza —' }, ...mapped] : mapped);
    });
  }, [repo]);
  return opts;
}
