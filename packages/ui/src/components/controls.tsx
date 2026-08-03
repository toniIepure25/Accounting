import { X } from 'lucide-react';
import type { ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { useEffect, useId, useRef } from 'react';
import { cn } from '../lib/cn.js';

export interface Option {
  value: string;
  label: string;
}

export function Select({
  className,
  options,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { options: Option[] }) {
  return (
    <select
      className={cn(
        'h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        className,
      )}
      {...props}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'min-h-[72px] w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg',
        'placeholder:text-fg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  children,
  hint,
  className,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: `children` e generic (ReactNode) — controlul e mereu randat direct in interiorul acestui <label>, dar biome nu poate verifica static asta.
    <label className={cn('block', className)}>
      <span className="mb-1.5 block text-sm font-medium text-fg">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-fg-muted">{hint}</span>}
    </label>
  );
}

const SELECTOR_FOCUSABIL =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const declansatorRef = useRef<HTMLElement | null>(null);

  // Muta focusul in dialog la deschidere si il restaureaza pe elementul care
  // a declansat deschiderea la inchidere — fara asta, un utilizator de
  // tastatura/cititor de ecran ramane cu focusul "pierdut" pe pagina din
  // spatele overlay-ului, sau il pierde complet la inchidere.
  useEffect(() => {
    if (open) {
      declansatorRef.current = document.activeElement as HTMLElement;
      dialogRef.current?.focus();
    } else {
      declansatorRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      // Capcana de tastatura: Tab nu trebuie sa iasa din dialog cat timp e deschis.
      if (e.key === 'Tab' && dialogRef.current) {
        const focusabile = dialogRef.current.querySelectorAll<HTMLElement>(SELECTOR_FOCUSABIL);
        if (focusabile.length === 0) return;
        const prim = focusabile[0]!;
        const ultim = focusabile[focusabile.length - 1]!;
        if (e.shiftKey && document.activeElement === prim) {
          e.preventDefault();
          ultim.focus();
        } else if (!e.shiftKey && document.activeElement === ultim) {
          e.preventDefault();
          prim.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: inchiderea pe tastatura e deja acoperita de listener-ul global de Escape de mai sus; click-ul pe overlay e doar o comoditate pentru mouse.
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-[8vh]"
      onClick={onClose}
    >
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: onClick aici opreste doar propagarea catre overlay (nu e o actiune interactiva proprie). */}
      {/* biome-ignore lint/a11y/useSemanticElements: <dialog> nativ ar cere rescrierea completa a modelului open/close (showModal/close, ::backdrop) — role="dialog" pe un div e chiar patternul WAI-ARIA APG recomandat pentru overlay-uri custom. */}
      <div
        role="dialog"
        ref={dialogRef}
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'w-full rounded-xl border border-border bg-surface shadow-2xl focus:outline-none',
          wide ? 'max-w-4xl' : 'max-w-lg',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h2 id={titleId} className="text-lg font-semibold text-fg">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Inchide"
            className="text-fg-muted hover:text-fg"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-5">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return <div className="px-4 py-12 text-center text-sm text-fg-muted">{text}</div>;
}
