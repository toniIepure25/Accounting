import type { ZodTypeAny } from 'zod';
import type { Repository } from './repository.js';
import type { SqlExecutor } from './sql-executor.js';

type Kind = 'bool' | 'json' | 'pass';

const camelToSnake = (s: string) => s.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);

// biome-ignore lint/suspicious/noExplicitAny: introspectie pe interne Zod
function unwrap(def: any): any {
  let d = def;
  while (d && ['ZodOptional', 'ZodNullable', 'ZodDefault'].includes(d.typeName)) {
    d = d.innerType?._def;
  }
  if (d && d.typeName === 'ZodEffects') d = d.schema?._def;
  return d;
}

function kindOf(field: ZodTypeAny): Kind {
  // biome-ignore lint/suspicious/noExplicitAny: introspectie pe interne Zod
  const t = unwrap((field as any)._def)?.typeName;
  if (t === 'ZodBoolean') return 'bool';
  if (t === 'ZodArray' || t === 'ZodObject' || t === 'ZodRecord') return 'json';
  return 'pass';
}

/**
 * Repository SQL generic pentru orice entitate cu `id`, derivat dintr-o schema Zod.
 * Numele coloanelor = camelCase-ul proprietatilor -> snake_case. Conversii
 * automate: boolean <-> 0/1, array/obiect <-> JSON text. Functioneaza pe SQLite
 * si PostgreSQL. Elimina nevoia de a scrie manual fiecare repository.
 */
export function createSqlRepository<T extends { id: string }>(
  exec: SqlExecutor,
  table: string,
  schema: ZodTypeAny,
  now: () => string = () => new Date().toISOString(),
): Repository<T, Partial<T>> {
  // biome-ignore lint/suspicious/noExplicitAny: acces la shape-ul ZodObject
  const shape = (schema as any).shape as Record<string, ZodTypeAny>;
  const props = Object.keys(shape);
  const kinds: Record<string, Kind> = Object.fromEntries(props.map((p) => [p, kindOf(shape[p]!)]));
  const col = (p: string) => camelToSnake(p);

  // Entitatile care declara campurile de sincronizare in schema (vezi core-domain
  // `campuriSync`) primesc `version`/`updatedAt` STAMPILATE automat la scriere:
  // version=1 la creare, +1 la fiecare update, updatedAt=acum. Exceptie: cand
  // apelantul furnizeaza EXPLICIT `updatedAt` (ex. sincronizarea scrie un rand de
  // pe server VERBATIM), valorile lui se pastreaza — nu re-stampilam.
  const areSync = 'version' in shape && 'updatedAt' in shape && 'deletedAt' in shape;

  const conv = (p: string, v: unknown) =>
    kinds[p] === 'bool' ? (v ? 1 : 0) : kinds[p] === 'json' ? JSON.stringify(v) : v;

  const rowToEntity = (row: Record<string, unknown>): T => {
    const obj: Record<string, unknown> = {};
    for (const p of props) {
      const v = row[col(p)];
      obj[p] =
        kinds[p] === 'bool'
          ? v === 1 || v === true
          : kinds[p] === 'json'
            ? typeof v === 'string'
              ? JSON.parse(v)
              : v
            : v;
    }
    return schema.parse(obj) as T;
  };

  return {
    async list() {
      const rows = await exec.select<Record<string, unknown>>(`SELECT * FROM ${table}`);
      return rows.map(rowToEntity);
    },
    async getById(id) {
      const rows = await exec.select<Record<string, unknown>>(
        `SELECT * FROM ${table} WHERE id = ?`,
        [id],
      );
      return rows[0] ? rowToEntity(rows[0]) : null;
    },
    async create(input) {
      // biome-ignore lint/suspicious/noExplicitAny: id optional in input
      const inp = input as any;
      const id = inp.id ?? crypto.randomUUID();
      const parsat = schema.parse({ ...input, id }) as T;
      // Stampilare la creare, doar daca apelantul NU a dat explicit `updatedAt`.
      const entity =
        areSync && inp.updatedAt === undefined
          ? ({ ...parsat, version: 1, updatedAt: now(), deletedAt: inp.deletedAt ?? null } as T)
          : parsat;
      const cols = props.map(col).join(', ');
      const placeholders = props.map(() => '?').join(', ');
      // biome-ignore lint/suspicious/noExplicitAny: acces dinamic
      const params = props.map((p) => conv(p, (entity as any)[p]));
      await exec.execute(`INSERT INTO ${table} (${cols}) VALUES (${placeholders})`, params);
      return entity;
    },
    async update(id, patch) {
      const current = await this.getById(id);
      if (!current) throw new Error(`${table}: id ${id} inexistent`);
      const parsat = schema.parse({ ...current, ...patch, id }) as T;
      // Bump `version` + `updatedAt`, doar daca patch-ul nu da explicit `updatedAt`
      // (sincronizarea scrie versiunea serverului verbatim -> nu re-stampilam).
      // biome-ignore lint/suspicious/noExplicitAny: acces la campurile de sync
      const next =
        areSync && (patch as any).updatedAt === undefined
          ? ({ ...parsat, version: ((current as any).version ?? 0) + 1, updatedAt: now() } as T)
          : parsat;
      const editable = props.filter((p) => p !== 'id');
      const assignments = editable.map((p) => `${col(p)} = ?`).join(', ');
      // biome-ignore lint/suspicious/noExplicitAny: acces dinamic
      const params = editable.map((p) => conv(p, (next as any)[p]));
      await exec.execute(`UPDATE ${table} SET ${assignments} WHERE id = ?`, [...params, id]);
      return next;
    },
    async remove(id) {
      await exec.execute(`DELETE FROM ${table} WHERE id = ?`, [id]);
    },
  };
}
