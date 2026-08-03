import { type AIProvider, type MesajAI, createOfflineProvider, createServerProvider } from '@gr/ai';
import { Bot, Send, User } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Button, Card, Input, PageHeader } from '../components/ui.js';
import { useAIContext } from '../hooks/useAIContext.js';

const SUGESTII = [
  'Cat stoc am?',
  'Ce trebuie sa comand?',
  'Cati bani am in casa?',
  'Cat TVA am de plata?',
];

export function AsistentPage() {
  const ctx = useAIContext();
  const offline = useMemo(() => createOfflineProvider(), []);
  const provider = useMemo<AIProvider>(() => {
    const url = localStorage.getItem('gr-ai-url');
    return url ? createServerProvider(url) : offline;
  }, [offline]);

  const [mesaje, setMesaje] = useState<MesajAI[]>([
    {
      rol: 'assistant',
      text: `Salut! Sunt ${provider.nume}. Intreaba-ma despre stoc, casa, TVA sau comenzi.`,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const trimite = async (text: string) => {
    if (!text.trim() || loading) return;
    const noi: MesajAI[] = [...mesaje, { rol: 'user', text }];
    setMesaje(noi);
    setInput('');
    setLoading(true);
    try {
      const raspuns = await provider.chat(noi, ctx);
      setMesaje([...noi, { rol: 'assistant', text: raspuns }]);
    } catch {
      // fallback offline daca serverul nu raspunde
      const raspuns = await offline.chat(noi, ctx);
      setMesaje([...noi, { rol: 'assistant', text: `(offline) ${raspuns}` }]);
    } finally {
      setLoading(false);
      setTimeout(() => listRef.current?.scrollTo({ top: 1e9, behavior: 'smooth' }), 50);
    }
  };

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col">
      <PageHeader title="Asistent" subtitle={provider.nume} />
      <Card className="flex flex-1 flex-col overflow-hidden">
        <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto p-5">
          {mesaje.map((m, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: lista e strict append-only (niciun mesaj nu e reordonat/sters), deci indexul e stabil.
            <div key={i} className={`flex gap-3 ${m.rol === 'user' ? 'flex-row-reverse' : ''}`}>
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${m.rol === 'user' ? 'bg-primary text-primary-fg' : 'bg-muted text-fg'}`}
              >
                {m.rol === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </div>
              <div
                className={`max-w-[75%] whitespace-pre-wrap rounded-xl px-4 py-2.5 text-sm ${m.rol === 'user' ? 'bg-primary text-primary-fg' : 'bg-muted text-fg'}`}
              >
                {m.text}
              </div>
            </div>
          ))}
          {loading && <div className="text-sm text-fg-muted">Se gandeste...</div>}
        </div>

        <div className="border-t border-border p-3">
          <div className="mb-2 flex flex-wrap gap-2">
            {SUGESTII.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => trimite(s)}
                className="rounded-full border border-border px-3 py-1 text-xs text-fg-muted hover:bg-muted"
              >
                {s}
              </button>
            ))}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              trimite(input);
            }}
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Scrie o intrebare..."
            />
            <Button type="submit" disabled={loading}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
