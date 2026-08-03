import { ETICHETE_ROL, type Rol } from '@gr/auth';
import { LogIn, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Button, Card, Input } from '../components/ui.js';
import { useAuth } from '../lib/auth-context.js';

const ROLURI: Rol[] = ['admin', 'contabil', 'gestionar', 'casier', 'vanzator'];

/**
 * Ecran de autentificare. Comportamentul depinde de modul de functionare ales
 * in Setari (`gr-deployment-mode`):
 * - local (fara server): alegerea unui rol conecteaza direct — pentru
 *   evaluarea rapida a produsului si a separarii pe permisiuni.
 * - lan/cloud (server configurat): utilizator + parola reale, verificate de
 *   server prin POST /auth/login (vezi server/src/auth.ts). Fara asta, RBAC-ul
 *   ar fi doar decorativ intr-un deployment multi-utilizator.
 */
export function LoginPage() {
  const { login, loginServer } = useAuth();
  const mod = localStorage.getItem('gr-deployment-mode') ?? 'local';
  const serverUrl = localStorage.getItem('gr-server-url') ?? '';
  const modServer = mod !== 'local' && serverUrl.trim().length > 0;

  const [nume, setNume] = useState('');
  const [rol, setRol] = useState<Rol>('admin');
  const [parola, setParola] = useState('');
  const [eroare, setEroare] = useState('');
  const [seVerifica, setSeVerifica] = useState(false);

  const conecteazaServer = async () => {
    setEroare('');
    setSeVerifica(true);
    const r = await loginServer(serverUrl, nume.trim(), parola);
    setSeVerifica(false);
    if (!r.ok) setEroare(r.eroare ?? 'Autentificare esuata.');
  };

  return (
    <div className="flex h-screen items-center justify-center bg-bg p-4">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-5 flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-fg">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-lg font-semibold text-fg">Autentificare</h1>
          <p className="text-sm text-fg-muted">Gestiune &amp; Contabilitate</p>
        </div>

        <label className="mb-1.5 block text-sm font-medium text-fg" htmlFor="nume-utilizator">
          Nume utilizator
        </label>
        <Input
          id="nume-utilizator"
          value={nume}
          onChange={(e) => setNume(e.target.value)}
          placeholder={modServer ? 'ex. admin' : 'ex. Ion Popescu'}
          className="mb-4"
        />

        {modServer ? (
          <>
            <label className="mb-1.5 block text-sm font-medium text-fg" htmlFor="parola-utilizator">
              Parola
            </label>
            <Input
              id="parola-utilizator"
              type="password"
              value={parola}
              onChange={(e) => setParola(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && conecteazaServer()}
              className="mb-4"
            />
            {eroare && <p className="mb-3 text-sm text-danger">{eroare}</p>}
            <Button
              className="w-full"
              disabled={seVerifica || !nume.trim() || !parola}
              onClick={conecteazaServer}
            >
              <LogIn className="h-4 w-4" /> {seVerifica ? 'Se conecteaza...' : 'Intra in aplicatie'}
            </Button>
            <p className="mt-3 text-center text-xs text-fg-muted">
              Autentificare verificata de server ({serverUrl}).
            </p>
          </>
        ) : (
          <>
            <span className="mb-1.5 block text-sm font-medium text-fg">Rol</span>
            <div className="mb-5 grid grid-cols-2 gap-2">
              {ROLURI.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRol(r)}
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    rol === r
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-fg-muted hover:bg-muted'
                  }`}
                >
                  {ETICHETE_ROL[r]}
                </button>
              ))}
            </div>

            <Button className="w-full" onClick={() => login(nume.trim() || 'Utilizator demo', rol)}>
              <LogIn className="h-4 w-4" /> Intra in aplicatie
            </Button>
            <p className="mt-3 text-center text-xs text-fg-muted">
              Mod demo: autentificare fara parola, pentru evaluare. Configureaza un server in Setari
              pentru autentificare reala.
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
