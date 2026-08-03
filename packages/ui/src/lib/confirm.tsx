import { type ReactNode, createContext, useCallback, useContext, useRef, useState } from 'react';
import { Modal } from '../components/controls.js';
import { Button } from '../components/ui.js';

export interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Stiliazeaza butonul de confirmare ca actiune distructiva (rosu). */
  danger?: boolean;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * Inlocuieste `confirm()` nativ (dialog de browser, fara stil, cu titlul
 * site-ului in bara de titlu — arata neprofesional intr-un ERP) cu un modal
 * din design system-ul aplicatiei. `useConfirm()` intoarce o functie async
 * care se rezolva cu true/false — apelantul scrie `if (await confirmDialog({...}))`
 * exact ca inainte cu `if (confirm(...))`, doar ca UI-ul e consistent.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirmDialog = useCallback<ConfirmFn>((o) => {
    setOpts(o);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = (v: boolean) => {
    resolver.current?.(v);
    resolver.current = null;
    setOpts(null);
  };

  return (
    <ConfirmContext.Provider value={confirmDialog}>
      {children}
      <Modal
        open={opts !== null}
        onClose={() => settle(false)}
        title={opts?.title ?? ''}
        footer={
          <>
            <Button variant="secondary" onClick={() => settle(false)}>
              {opts?.cancelLabel ?? 'Renunta'}
            </Button>
            <Button variant={opts?.danger ? 'danger' : 'primary'} onClick={() => settle(true)}>
              {opts?.confirmLabel ?? 'Confirma'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-fg-muted">{opts?.message}</p>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
}
