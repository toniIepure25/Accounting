/**
 * Blocare optimista (Faza 4, P4-R1). Fiecare document poarta un contor `version`.
 * O comanda care modifica documentul poate trimite `expectedVersion`; daca nu
 * corespunde versiunii curente, comanda e respinsa cu `ConflictOptimistaError`
 * in loc sa suprascrie orbeste modificarea concurenta (nu last-write-wins).
 * Fiecare scriere autoritara incrementeaza `version`.
 */

export class ConflictOptimistaError extends Error {
  constructor(
    public readonly id: string,
    public readonly expected: number,
    public readonly actual: number,
  ) {
    super(
      `Conflict de versiune la documentul ${id}: se astepta versiunea ${expected}, dar versiunea curenta este ${actual}. Reincarca documentul si reincearca.`,
    );
    this.name = 'ConflictOptimistaError';
  }
}

/**
 * Verifica versiunea asteptata fata de cea curenta. `expected === undefined`
 * dezactiveaza verificarea (apelantul nu foloseste blocare optimista).
 */
export function asertaVersiune(id: string, actual: number, expected: number | undefined): void {
  if (expected !== undefined && expected !== actual) {
    throw new ConflictOptimistaError(id, expected, actual);
  }
}
