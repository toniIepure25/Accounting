/**
 * Optimizare debitare (nesting) pentru placi PAL/MDF/OSB. Euristica de tip
 * "guillotine shelf" (First-Fit-Decreasing pe rafturi orizontale) cu grosime de
 * taiere (kerf) si rotire optionala. Minimizeaza numarul de placi si pierderea
 * de material; ofera plasarile pentru diagrama de taiere.
 *
 * Nu e optimul absolut (problema e NP-hard), dar e rapid si aproape de optim
 * pentru repere dreptunghiulare uzuale de mobila.
 */
export interface Piesa {
  eticheta: string;
  latimeMm: number;
  inaltimeMm: number;
  bucati: number;
}

export interface Placa {
  latimeMm: number;
  inaltimeMm: number;
}

export interface Plasare {
  eticheta: string;
  x: number;
  y: number;
  latimeMm: number;
  inaltimeMm: number;
  rotit: boolean;
}

export interface RezultatNesting {
  placi: { index: number; plasari: Plasare[] }[];
  nrPlaci: number;
  suprafataFolositaMm2: number;
  suprafataTotalaMm2: number;
  procentPierdere: number;
}

interface Raft {
  y: number;
  inaltime: number;
  latimeFolosita: number;
}
interface PlacaLucru {
  rafturi: Raft[];
  plasari: Plasare[];
  inaltimeFolosita: number;
}

export function optimizeazaDebitare(
  piese: readonly Piesa[],
  placa: Placa,
  opt: { kerfMm?: number; permiteRotire?: boolean } = {},
): RezultatNesting {
  const kerf = opt.kerfMm ?? 3;
  const rotire = opt.permiteRotire ?? true;
  const P = placa.latimeMm;
  const H = placa.inaltimeMm;

  // expandeaza pe bucati si orienteaza (landscape) daca rotirea e permisa
  const unitati: { eticheta: string; w: number; h: number; rotit: boolean }[] = [];
  for (const p of piese) {
    for (let i = 0; i < p.bucati; i++) {
      let w = p.latimeMm;
      let h = p.inaltimeMm;
      let rotit = false;
      if (rotire && h > w && h <= P && w <= H) {
        [w, h] = [h, w];
        rotit = true;
      }
      unitati.push({ eticheta: p.eticheta, w, h, rotit });
    }
  }
  // descrescator dupa inaltime, apoi latime (FFD pe rafturi)
  unitati.sort((a, b) => b.h - a.h || b.w - a.w);

  const placi: PlacaLucru[] = [];
  const nouaPlaca = (): PlacaLucru => ({ rafturi: [], plasari: [], inaltimeFolosita: 0 });

  const incearcaPlasare = (
    pl: PlacaLucru,
    u: { eticheta: string; w: number; h: number; rotit: boolean },
  ): boolean => {
    // 1) incape intr-un raft existent?
    for (const r of pl.rafturi) {
      const offset = r.latimeFolosita === 0 ? 0 : kerf;
      if (u.h <= r.inaltime && r.latimeFolosita + offset + u.w <= P) {
        const x = r.latimeFolosita + offset;
        pl.plasari.push({
          eticheta: u.eticheta,
          x,
          y: r.y,
          latimeMm: u.w,
          inaltimeMm: u.h,
          rotit: u.rotit,
        });
        r.latimeFolosita = x + u.w;
        return true;
      }
    }
    // 2) raft nou dedesubt?
    const y = pl.inaltimeFolosita === 0 ? 0 : pl.inaltimeFolosita + kerf;
    if (y + u.h <= H && u.w <= P) {
      pl.rafturi.push({ y, inaltime: u.h, latimeFolosita: u.w });
      pl.plasari.push({
        eticheta: u.eticheta,
        x: 0,
        y,
        latimeMm: u.w,
        inaltimeMm: u.h,
        rotit: u.rotit,
      });
      pl.inaltimeFolosita = y + u.h;
      return true;
    }
    return false;
  };

  for (const u of unitati) {
    let plasat = false;
    for (const pl of placi) {
      if (incearcaPlasare(pl, u)) {
        plasat = true;
        break;
      }
    }
    if (!plasat) {
      const pl = nouaPlaca();
      incearcaPlasare(pl, u); // presupune ca reperul incape pe o placa goala
      placi.push(pl);
    }
  }

  const suprafataFolositaMm2 = unitati.reduce((a, u) => a + u.w * u.h, 0);
  const suprafataTotalaMm2 = placi.length * P * H;
  const procentPierdere =
    suprafataTotalaMm2 > 0
      ? Math.round((1 - suprafataFolositaMm2 / suprafataTotalaMm2) * 1000) / 10
      : 0;

  return {
    placi: placi.map((pl, i) => ({ index: i, plasari: pl.plasari })),
    nrPlaci: placi.length,
    suprafataFolositaMm2,
    suprafataTotalaMm2,
    procentPierdere,
  };
}
