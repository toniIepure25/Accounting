import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * GARDA statica (A6): impiedica reintroducerea unui default TACIT de cota TVA in
 * schemele de entitati. Cota autoritara se rezolva din categorie fiscala + data
 * (motorul temporal), NU dintr-un procent hardcodat pe entitate.
 *
 * Daca cineva adauga la loc `cotaTvaProcent: z.number()...default(19)` (sau orice
 * numar) pe produs / linie de document / preparat, acest test pica.
 */
const SRC = join(dirname(fileURLToPath(import.meta.url)));

function liniiCu(fisier: string, substr: string): string[] {
  return readFileSync(join(SRC, fisier), 'utf8')
    .split('\n')
    .filter((l) => l.includes(substr));
}

describe('garda: fara default tacit de cota TVA in entitati', () => {
  for (const fisier of ['entities/produs.ts', 'entities/document.ts', 'entities/preparat.ts']) {
    it(`${fisier}: cotaTvaProcent nu are un .default(<numar>)`, () => {
      for (const linie of liniiCu(fisier, 'cotaTvaProcent')) {
        // Nu permite `.default(19)` / `.default( 9 )` etc. pe cotaTvaProcent.
        // `.default(null)` (indiciu legacy nullable) e permis.
        expect(linie).not.toMatch(/cotaTvaProcent[^\n]*\.default\(\s*-?\d/);
      }
    });
  }

  it('produs.ts nu mai foloseste constanta hardcodata COTE_TVA_RO', () => {
    const continut = readFileSync(join(SRC, 'entities/produs.ts'), 'utf8');
    expect(continut).not.toContain('COTE_TVA_RO');
  });

  it('produs.ts are campul autoritar codCategorieFiscala', () => {
    const continut = readFileSync(join(SRC, 'entities/produs.ts'), 'utf8');
    expect(continut).toContain('codCategorieFiscala');
  });
});
