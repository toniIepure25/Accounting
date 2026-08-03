import { AlertOctagon, RefreshCw } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button, Card } from './ui.js';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/**
 * Plasa de siguranta la nivel de aplicatie: fara asta, orice eroare de
 * randare (bug intr-un ecran, date neasteptate dintr-un backup restaurat
 * etc.) inlocuieste TOT UI-ul brandat (Sidebar/Topbar) cu ecranul brut,
 * nebrandat, de crash al React Router — nepotrivit in mijlocul unei
 * prezentari catre un client. Prinde eroarea, arata un ecran clar cu
 * optiunea de reincarcare, fara sa expuna stack trace-ul catre utilizator.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Eroare neasteptata in UI:', error, info.componentStack);
  }

  override render() {
    if (this.state.error) {
      return (
        <div className="flex h-screen items-center justify-center bg-bg p-6">
          <Card className="max-w-md p-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-danger/10 text-danger">
              <AlertOctagon className="h-6 w-6" />
            </div>
            <h1 className="text-lg font-semibold text-fg">A aparut o eroare neasteptata</h1>
            <p className="mt-2 text-sm text-fg-muted">
              Ecranul curent nu a putut fi afisat. Datele tale nu sunt afectate — reincarca
              aplicatia pentru a continua.
            </p>
            <Button className="mt-5" onClick={() => window.location.reload()}>
              <RefreshCw className="h-4 w-4" /> Reincarca aplicatia
            </Button>
          </Card>
        </div>
      );
    }
    return this.props.children;
  }
}
