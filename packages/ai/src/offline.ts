import { type Bani, formatBani } from '@gr/core-domain';
import type { AIProvider, ContextGestiune, MesajAI } from './types.js';

const lei = (b: number) => formatBani(b as Bani, { withSymbol: true });
const has = (t: string, ...k: string[]) => k.some((x) => t.includes(x));

/**
 * Asistent offline, bazat pe reguli. Raspunde din contextul de gestiune fara
 * internet — mereu disponibil. Acopera intrebarile frecvente; pentru raspunsuri
 * in limbaj natural mai bogat se foloseste providerul Claude (online).
 */
export function createOfflineProvider(): AIProvider {
  return {
    nume: 'Asistent offline',
    async chat(mesaje: readonly MesajAI[], ctx: ContextGestiune): Promise<string> {
      const q = (mesaje[mesaje.length - 1]?.text ?? '').toLowerCase();

      if (has(q, 'casa', 'casă', 'numerar', 'bani')) {
        return `Soldul casei este ${lei(ctx.soldCasaBani)}.`;
      }
      if (has(q, 'stoc sub', 'sub minim', 'trebuie sa comand', 'de comandat', 'reaprovizion')) {
        if (ctx.produseSubMinim.length === 0) return 'Niciun produs nu este sub stocul minim.';
        const lista = ctx.produseSubMinim
          .slice(0, 10)
          .map((p) => `• ${p.denumire}: stoc ${p.stoc}, minim ${p.minim}`)
          .join('\n');
        return `${ctx.produseSubMinim.length} produse sub minim:\n${lista}`;
      }
      if (has(q, 'valoare stoc', 'valoarea stoc', 'cat stoc', 'stocul', 'marfa in stoc')) {
        return `Valoarea totala a stocului este ${lei(ctx.valoareStocBani)}.`;
      }
      if (has(q, 'tva', 'decont')) {
        return `TVA de plata (din documentele validate) este ${lei(ctx.tvaDePlataBani)}.`;
      }
      if (has(q, 'comenzi', 'comanda', 'productie')) {
        return `Ai ${ctx.comenziInLucru} comenzi in lucru.`;
      }
      if (has(q, 'vanzari', 'vandut', 'incasari facturate')) {
        return `Total vanzari (facturi + amanuntul, cu TVA): ${lei(ctx.vanzariBrutBani)}.`;
      }
      if (has(q, 'clienti', 'client')) {
        return `Ai ${ctx.nrClienti} clienti in nomenclator.`;
      }
      if (has(q, 'furnizori', 'furnizor')) {
        return `Ai ${ctx.nrFurnizori} furnizori in nomenclator.`;
      }
      if (has(q, 'ajutor', 'ce poti', 'help', 'salut', 'buna')) {
        return AJUTOR;
      }
      return `Nu am inteles intrebarea in modul offline.\n\n${AJUTOR}`;
    },
  };
}

const AJUTOR = `Pot raspunde la:
• soldul casei ("cati bani am in casa")
• valoarea stocului ("cat stoc am")
• produse sub minim ("ce trebuie sa comand")
• TVA de plata ("cat TVA am de plata")
• comenzi in lucru
• total vanzari
• numar de clienti / furnizori
Pentru intrebari libere, activeaza asistentul online (Claude) din Setari.`;
