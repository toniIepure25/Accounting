import type { DataProvider } from './provider.js';
import type { Repository } from './repository.js';

/** Instantaneu complet al datelor, exportabil/importabil ca fisier JSON. */
export interface BackupSnapshot {
  versiune: 1;
  exportatLa: string; // ISO
  /** Randurile fiecarui repository, keyed pe numele proprietatii din DataProvider. */
  tabele: Record<string, unknown[]>;
}

// biome-ignore lint/suspicious/noExplicitAny: acces generic la orice repository al provider-ului
type AnyRepo = Repository<any, any>;

function repoDeLaCheie(provider: DataProvider, cheie: string): AnyRepo | undefined {
  if (cheie === 'numerotare') return undefined; // nu e un Repository (nu are date de exportat)
  // biome-ignore lint/suspicious/noExplicitAny: acces dinamic pe DataProvider
  return (provider as any)[cheie] as AnyRepo | undefined;
}

/**
 * Exporta toate datele (nomenclatoare, documente, casa, jurnal de audit etc.)
 * intr-un instantaneu serializabil. Folosit pentru backup manual (mod local)
 * si ca baza pentru sincronizare initiala.
 */
export async function exportDate(provider: DataProvider): Promise<BackupSnapshot> {
  const tabele: Record<string, unknown[]> = {};
  for (const cheie of Object.keys(provider)) {
    const repo = repoDeLaCheie(provider, cheie);
    if (!repo) continue;
    tabele[cheie] = await repo.list();
  }
  return { versiune: 1, exportatLa: new Date().toISOString(), tabele };
}

export interface RezultatRestaurare {
  tabeleRestaurate: number;
  inregistrariRestaurate: number;
}

/**
 * Restaureaza un instantaneu. Mod `inlocuieste` (implicit): sterge tot ce
 * exista si reincarca exact continutul din backup (pastrand ID-urile
 * originale, esential pentru relatiile intre tabele — ex. documente_linii →
 * documente). Mod `adauga`: insereaza peste datele existente (upsert dupa id).
 *
 * Ordinea de stergere e inversa fata de export (copiii inaintea parintilor),
 * iar ordinea de inserare respecta exportul (parintii inaintea copiilor) —
 * relevant mai ales pentru backend-uri SQL cu constrangeri de integritate.
 */
export async function importDate(
  provider: DataProvider,
  snapshot: BackupSnapshot,
  mod: 'inlocuieste' | 'adauga' = 'inlocuieste',
): Promise<RezultatRestaurare> {
  const intrari = Object.entries(snapshot.tabele);

  if (mod === 'inlocuieste') {
    for (const [cheie] of [...intrari].reverse()) {
      const repo = repoDeLaCheie(provider, cheie);
      if (!repo) continue;
      const existente = await repo.list();
      for (const rand of existente) await repo.remove((rand as { id: string }).id);
    }
  }

  let inregistrariRestaurate = 0;
  for (const [cheie, randuri] of intrari) {
    const repo = repoDeLaCheie(provider, cheie);
    if (!repo) continue; // tabela necunoscuta pentru aceasta versiune — ignorata sigur
    for (const rand of randuri) {
      await repo.create(rand);
      inregistrariRestaurate++;
    }
  }

  return { tabeleRestaurate: intrari.length, inregistrariRestaurate };
}
