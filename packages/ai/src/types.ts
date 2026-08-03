/** Un mesaj din conversatia cu asistentul. */
export interface MesajAI {
  rol: 'user' | 'assistant';
  text: string;
}

/**
 * Instantaneu al starii afacerii, oferit asistentului ca sa raspunda din date.
 * Calculat in UI din DataProvider + motoarele de stoc/contabilitate.
 */
export interface ContextGestiune {
  soldCasaBani: number;
  valoareStocBani: number;
  produseSubMinim: { denumire: string; stoc: number; minim: number }[];
  comenziInLucru: number;
  tvaDePlataBani: number;
  nrClienti: number;
  nrFurnizori: number;
  vanzariBrutBani: number;
}

/** Contractul comun pe care il implementeaza toti providerii AI. */
export interface AIProvider {
  /** Numele providerului (pentru UI). */
  readonly nume: string;
  /** Raspunde la conversatie folosind contextul de gestiune. */
  chat(mesaje: readonly MesajAI[], ctx: ContextGestiune): Promise<string>;
}
