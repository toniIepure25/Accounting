import { type Gestiune, type GestiuneInput, GestiuneSchema } from '@gr/core-domain';
import type { Repository } from '../repository.js';
import type { SqlExecutor } from '../sql-executor.js';

interface GestiuneRow {
  id: string;
  cod: string;
  denumire: string;
  gestionar: string;
  cont_sintetic: string;
  cont_analitic: string;
  tip: string;
  punct_de_lucru_id: string | null;
  activ: number;
}

function rowToEntity(r: GestiuneRow): Gestiune {
  return GestiuneSchema.parse({
    id: r.id,
    cod: r.cod,
    denumire: r.denumire,
    gestionar: r.gestionar,
    contSintetic: r.cont_sintetic,
    contAnalitic: r.cont_analitic,
    tip: r.tip,
    punctDeLucruId: r.punct_de_lucru_id,
    activ: r.activ === 1,
  });
}

/** Repository SQL pentru Gestiuni (functioneaza pe SQLite si Postgres). */
export function createGestiuneSqlRepository(
  exec: SqlExecutor,
): Repository<Gestiune, GestiuneInput> {
  return {
    async list() {
      const rows = await exec.select<GestiuneRow>('SELECT * FROM gestiuni ORDER BY cod');
      return rows.map(rowToEntity);
    },
    async getById(id) {
      const rows = await exec.select<GestiuneRow>('SELECT * FROM gestiuni WHERE id = ?', [id]);
      return rows[0] ? rowToEntity(rows[0]) : null;
    },
    async create(input) {
      const entity = GestiuneSchema.parse({ ...input, id: crypto.randomUUID() });
      await exec.execute(
        `INSERT INTO gestiuni
           (id, cod, denumire, gestionar, cont_sintetic, cont_analitic, tip, punct_de_lucru_id, activ)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          entity.id,
          entity.cod,
          entity.denumire,
          entity.gestionar,
          entity.contSintetic,
          entity.contAnalitic,
          entity.tip,
          entity.punctDeLucruId,
          entity.activ ? 1 : 0,
        ],
      );
      return entity;
    },
    async update(id, patch) {
      const current = await this.getById(id);
      if (!current) throw new Error(`Gestiunea ${id} nu exista`);
      const next = GestiuneSchema.parse({ ...current, ...patch, id });
      await exec.execute(
        `UPDATE gestiuni SET
           cod = ?, denumire = ?, gestionar = ?, cont_sintetic = ?, cont_analitic = ?,
           tip = ?, punct_de_lucru_id = ?, activ = ?
         WHERE id = ?`,
        [
          next.cod,
          next.denumire,
          next.gestionar,
          next.contSintetic,
          next.contAnalitic,
          next.tip,
          next.punctDeLucruId,
          next.activ ? 1 : 0,
          id,
        ],
      );
      return next;
    },
    async remove(id) {
      await exec.execute('DELETE FROM gestiuni WHERE id = ?', [id]);
    },
  };
}
