import type { Permisiune } from '@gr/auth';
import type { ModuleId } from '@gr/license';
import { Lock, ShieldAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { useAuth } from '../lib/auth-context.js';
import { useLicense } from '../lib/license-context.js';
import { Card } from './ui.js';

/**
 * Blocheaza randarea unui ecran daca licenta nu include modulul, sau daca
 * utilizatorul autentificat nu are permisiunea ceruta.
 */
export function Gated({
  moduleId,
  permisiune,
  children,
}: {
  moduleId: ModuleId;
  /** Permisiune necesara (opțional); daca lipseste, doar licenta e verificata. */
  permisiune?: Permisiune;
  children: ReactNode;
}) {
  const { areModul } = useLicense();
  const { areVoie } = useAuth();

  if (!areModul(moduleId)) {
    return (
      <Card className="flex flex-col items-center justify-center gap-3 p-16 text-center">
        <Lock className="h-10 w-10 text-fg-muted" />
        <p className="text-lg font-medium text-fg">Modul indisponibil</p>
        <p className="max-w-md text-sm text-fg-muted">
          Acest modul nu este inclus in licenta ta. Contacteaza furnizorul pentru a-l activa.
        </p>
      </Card>
    );
  }

  if (permisiune && !areVoie(permisiune)) {
    return (
      <Card className="flex flex-col items-center justify-center gap-3 p-16 text-center">
        <ShieldAlert className="h-10 w-10 text-warning" />
        <p className="text-lg font-medium text-fg">Acces restrictionat</p>
        <p className="max-w-md text-sm text-fg-muted">
          Rolul tau nu are permisiunea necesara pentru acest ecran. Contacteaza administratorul.
        </p>
      </Card>
    );
  }

  return <>{children}</>;
}
