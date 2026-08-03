import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';

type ToastType = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DURATA_MS = 5000;

const STIL: Record<ToastType, { icon: typeof CheckCircle2; classes: string }> = {
  success: { icon: CheckCircle2, classes: 'border-success/30 bg-surface text-success' },
  error: { icon: AlertTriangle, classes: 'border-danger/30 bg-surface text-danger' },
  info: { icon: Info, classes: 'border-primary/30 bg-surface text-primary' },
};

/**
 * Notificari consistente de succes/eroare/info, in loc de `alert()` nativ (fara
 * stil, blocheaza thread-ul UI) sau de mesaje ad-hoc diferite pe fiecare
 * pagina (unele `<p>` neutre, altele `alert()`, fara sa distinga vizual
 * succesul de eroare). Un singur loc, folosit peste tot prin `useToast()`.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const remove = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const push = useCallback(
    (type: ToastType, message: string) => {
      const id = nextId.current++;
      setToasts((t) => [...t, { id, type, message }]);
      setTimeout(() => remove(id), DURATA_MS);
    },
    [remove],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      success: (m) => push('success', m),
      error: (m) => push('error', m),
      info: (m) => push('info', m),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* biome-ignore lint/a11y/useSemanticElements: <output> e pentru rezultatul unui calcul/formular, nu pentru o regiune de notificari tranzitorii — role="status" cu aria-live e patternul standard pentru toast-uri. */}
      <div
        role="status"
        aria-live="polite"
        className="fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2"
      >
        {toasts.map((t) => {
          const { icon: Icon, classes } = STIL[t.type];
          return (
            <div
              key={t.id}
              className={`flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm shadow-lg ${classes}`}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="flex-1 text-fg">{t.message}</span>
              <button
                type="button"
                onClick={() => remove(t.id)}
                aria-label="Inchide notificarea"
                className="text-fg-muted hover:text-fg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
