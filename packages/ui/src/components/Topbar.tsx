import { ETICHETE_ROL } from '@gr/auth';
import { KeyRound, Languages, LogOut, Moon, Search, Sun, UserCircle } from 'lucide-react';
import { useState } from 'react';
import { serverConfigurat } from '../lib/api-cont.js';
import { useAuth } from '../lib/auth-context.js';
import { useI18n } from '../lib/i18n.js';
import { useTheme } from '../lib/theme.js';
import { DialogParola } from './DialogParola.js';
import { Button } from './ui.js';

export function Topbar({ onOpenCommand }: { onOpenCommand: () => void }) {
  const { theme, toggle } = useTheme();
  const { lang, setLang } = useI18n();
  const { user, logout } = useAuth();
  const today = new Date().toLocaleDateString(lang === 'ro' ? 'ro-RO' : 'en-GB');
  const [parolaDeschis, setParolaDeschis] = useState(false);
  // Schimbarea parolei are sens doar cand autentificarea trece prin server —
  // in modul demo local nu exista parole deloc.
  const serverUrl = serverConfigurat();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-surface px-5">
      <button
        type="button"
        onClick={onOpenCommand}
        className="flex h-9 w-full max-w-sm items-center gap-2 rounded-lg border border-border bg-bg px-3 text-sm text-fg-muted hover:bg-muted"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Cauta...</span>
        <kbd className="rounded border border-border px-1.5 py-0.5 text-xs">Ctrl K</kbd>
      </button>

      <div className="flex items-center gap-1">
        <span className="mr-2 hidden text-sm text-fg-muted sm:inline">{today}</span>
        <Button variant="ghost" size="sm" onClick={() => setLang(lang === 'ro' ? 'en' : 'ro')}>
          <Languages className="h-4 w-4" />
          {lang.toUpperCase()}
        </Button>
        <Button variant="ghost" size="sm" onClick={toggle} aria-label="Comuta tema">
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        {user && (
          <div className="ml-1 flex items-center gap-2 border-l border-border pl-3">
            <span className="flex items-center gap-1.5 text-sm text-fg">
              <UserCircle className="h-4 w-4 text-fg-muted" />
              {user.nume}
              <span className="text-xs text-fg-muted">({ETICHETE_ROL[user.rol]})</span>
            </span>
            {serverUrl && user.token && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setParolaDeschis(true)}
                aria-label="Schimba parola"
                title="Schimba parola"
              >
                <KeyRound className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={logout} aria-label="Deconectare">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
      {serverUrl && (
        <DialogParola
          open={parolaDeschis}
          onClose={() => setParolaDeschis(false)}
          serverUrl={serverUrl}
        />
      )}
    </header>
  );
}
