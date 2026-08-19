import type { MijlocFix } from './entities/mijloc-fix.js';
import type { FaraCampuriSync } from './entities/sync-fields.js';

/** Mijloc fix fara metadatele de persistenta — logica de amortizare nu le foloseste. */
type MijlocFixDomeniu = FaraCampuriSync<MijlocFix>;

/**
 * Amortizare mijloace fixe. Doua metode uzuale in contabilitatea romaneasca:
 *   - liniara: cota lunara constanta = valoare intrare / durata normala (luni).
 *   - degresiva: cota anuala liniara * coeficient (1.5/2/2.5, dat explicit —
 *     nu dedus dupa durata, ca sa nu presupunem un prag neverificat), aplicata
 *     asupra valorii RAMASE la inceputul fiecarui an; cand cota degresiva ar
 *     deveni mai mica decat cota liniara pe luna ramase, se trece la liniar
 *     pentru restul duratei (regula standard de comutare degresiv->liniar).
 * Amortizarea nu poate depasi niciodata valoarea ramasa (valoarea de intrare
 * minus ce s-a amortizat deja).
 */

/** Cota de amortizare pentru O LUNA, data valoarea deja amortizata cumulat. */
export function calculAmortizareLunara(mf: MijlocFixDomeniu): number {
  const ramasa = Math.max(0, mf.valoareIntrareBani - mf.amortizareCumulataBani);
  if (ramasa <= 0 || mf.casat) return 0;

  const cotaLiniaraLunara = mf.valoareIntrareBani / mf.durataNormalaLuni;

  if (mf.metodaAmortizare === 'liniara') {
    return Math.min(ramasa, Math.round(cotaLiniaraLunara));
  }

  // Degresiva: rata anuala liniara * coeficient, aplicata pe valoarea ramasa,
  // impartita la 12. Daca rezultatul e sub cota liniara ramasa (adica sub ce
  // ar necesita liniarul pentru lunile ramase), foloseste liniarul — regula
  // standard de trecere degresiv -> liniar spre finalul duratei.
  const luniRamase = Math.max(
    1,
    mf.durataNormalaLuni - Math.round(mf.amortizareCumulataBani / cotaLiniaraLunara),
  );
  const cotaLiniaraPeLuniRamase = ramasa / luniRamase;
  const rataAnualaLiniara = mf.valoareIntrareBani / (mf.durataNormalaLuni / 12);
  const cotaDegresivaLunara = (rataAnualaLiniara * mf.coeficientDegresiv) / 12;

  const cota = Math.max(cotaDegresivaLunara, cotaLiniaraPeLuniRamase);
  return Math.min(ramasa, Math.round(cota));
}

export interface RandPlanAmortizare {
  luna: number; // 1-indexat de la data punerii in functiune
  amortizareBani: number;
  cumulatBani: number;
  ramasaBani: number;
}

/** Planul complet de amortizare (luna cu luna) pana la epuizarea valorii. */
export function planAmortizare(mf: MijlocFixDomeniu): RandPlanAmortizare[] {
  const randuri: RandPlanAmortizare[] = [];
  let curent: MijlocFixDomeniu = { ...mf, amortizareCumulataBani: mf.amortizareCumulataBani };
  let luna = 0;
  while (
    curent.amortizareCumulataBani < curent.valoareIntrareBani &&
    luna < curent.durataNormalaLuni * 2
  ) {
    luna++;
    const cota = calculAmortizareLunara(curent);
    if (cota <= 0) break;
    curent = { ...curent, amortizareCumulataBani: curent.amortizareCumulataBani + cota };
    randuri.push({
      luna,
      amortizareBani: cota,
      cumulatBani: curent.amortizareCumulataBani,
      ramasaBani: curent.valoareIntrareBani - curent.amortizareCumulataBani,
    });
  }
  return randuri;
}
