import type { AIProvider, ContextGestiune, MesajAI } from './types.js';

/**
 * Provider care deleaga catre serverul aplicatiei (`/ai/chat`), unde ruleaza
 * agentul Claude cu tool-use peste date. Cheia API ANTHROPIC ramane pe server —
 * nu ajunge niciodata in browser/desktop. Cade automat pe un mesaj clar daca
 * serverul nu e disponibil (mod offline).
 */
export function createServerProvider(baseUrl: string): AIProvider {
  const url = `${baseUrl.replace(/\/$/, '')}/ai/chat`;
  return {
    nume: 'Asistent Claude (online)',
    async chat(mesaje: readonly MesajAI[], ctx: ContextGestiune): Promise<string> {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mesaje, ctx }),
      });
      if (!r.ok) throw new Error(`AI server ${r.status}`);
      const j = (await r.json()) as { text: string };
      return j.text;
    },
  };
}
