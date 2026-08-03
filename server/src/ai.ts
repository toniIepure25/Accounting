import Anthropic from '@anthropic-ai/sdk';

/**
 * Agent Claude pentru asistentul aplicatiei. Ruleaza pe SERVER, deci cheia
 * ANTHROPIC_API_KEY nu ajunge niciodata in browser/desktop. Primeste conversatia
 * + un instantaneu al starii afacerii si raspunde in romana.
 *
 * Model implicit: claude-opus-5 (cel mai capabil Opus). Gandire adaptiva pornita.
 */
interface MesajAI {
  rol: 'user' | 'assistant';
  text: string;
}

export async function chatAI(mesaje: MesajAI[], ctx: unknown): Promise<string> {
  const client = new Anthropic(); // citeste ANTHROPIC_API_KEY din mediu

  const system = [
    'Esti asistentul unei aplicatii romanesti de gestiune si contabilitate.',
    'Raspunzi concis, in limba romana, folosind DOAR datele din contextul de mai jos.',
    'Sumele sunt in bani (imparte la 100 pentru RON). Daca nu ai data, spune clar.',
    '',
    `Context (JSON): ${JSON.stringify(ctx)}`,
  ].join('\n');

  const response = await client.messages.create({
    model: 'claude-opus-5',
    max_tokens: 1024,
    thinking: { type: 'adaptive' },
    system,
    messages: mesaje.map((m) => ({ role: m.rol, content: m.text })),
  });

  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
}
