import { CornerDownLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context.js';
import { useI18n } from '../lib/i18n.js';
import { useLicense } from '../lib/license-context.js';
import { allNavItems } from '../modules/registry.js';

/** Paleta de comenzi (Ctrl/Cmd+K) pentru navigare rapida — flux tastatura-first. */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const { areModul } = useLicense();
  const { areVoie } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const results = allNavItems
    .filter((i) => areModul(i.moduleId))
    .filter((i) => !i.permisiune || areVoie(i.permisiune))
    .filter((i) => i.label.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
    }
  }, [open]);

  if (!open) return null;

  const go = (path: string) => {
    navigate(path);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[15vh]"
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: onClick aici opreste doar propagarea catre overlay (Escape e deja gestionat pe overlay, mai sus). */}
      {/* biome-ignore lint/a11y/useSemanticElements: <dialog> nativ ar cere rescrierea completa a modelului open/close (showModal/close, ::backdrop) — role="dialog" pe un div e chiar patternul WAI-ARIA APG recomandat pentru overlay-uri custom. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('command.placeholder')}
        className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-elevated shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          // biome-ignore lint/a11y/noAutofocus: paleta de comenzi (Ctrl/Cmd+K) e conceputa sa primeasca focus imediat la deschidere — fara asta, tastarea nu ar filtra nimic.
          autoFocus
          value={query}
          placeholder={t('command.placeholder')}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, results.length - 1));
            if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0));
            if (e.key === 'Enter' && results[active]) go(results[active].path);
          }}
          className="w-full border-b border-border bg-transparent px-4 py-3.5 text-sm text-fg outline-none placeholder:text-fg-muted"
        />
        <ul className="max-h-72 overflow-y-auto p-2">
          {results.map((item, i) => (
            <li key={item.path}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => go(item.path)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm ${
                  i === active ? 'bg-primary/10 text-primary' : 'text-fg'
                }`}
              >
                <item.icon className="h-4 w-4" />
                <span className="flex-1">{item.label}</span>
                {i === active && <CornerDownLeft className="h-3.5 w-3.5 opacity-60" />}
              </button>
            </li>
          ))}
          {results.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-fg-muted">—</li>
          )}
        </ul>
      </div>
    </div>
  );
}
