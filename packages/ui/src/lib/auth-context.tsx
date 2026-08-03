import { ETICHETE_ROL, type Permisiune, type Rol, arePermisiune } from '@gr/auth';
import { type ReactNode, createContext, useCallback, useContext, useEffect, useState } from 'react';

export interface UtilizatorCurent {
  nume: string;
  rol: Rol;
  firmaId: string | null;
  /** Token de sesiune (non-null doar cand autentificarea a trecut prin server). */
  token: string | null;
}

interface AuthContextValue {
  user: UtilizatorCurent | null;
  /**
   * Autentificare DEMO (modul local, fara server): alegi un rol, fara parola —
   * util pentru evaluarea rapida a produsului. NU are echivalent server-side;
   * nu se foloseste cand exista un server configurat (vezi `loginServer`).
   */
  login: (nume: string, rol: Rol) => void;
  /**
   * Autentificare REALA prin server (moduri lan/cloud): verifica parola prin
   * POST /auth/login (server/src/auth.ts) si primeste un token de sesiune
   * semnat, atasat apoi pe fiecare cerere facuta de DataProvider (vezi
   * data-context.tsx + @gr/data createApiProvider).
   */
  loginServer: (
    serverUrl: string,
    nume: string,
    parola: string,
  ) => Promise<{ ok: boolean; eroare?: string }>;
  logout: () => void;
  areVoie: (p: Permisiune) => boolean;
}

const LS_USER = 'gr-user';
const Ctx = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UtilizatorCurent | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(LS_USER);
    if (raw) {
      try {
        setUser(JSON.parse(raw));
      } catch {
        /* ignora */
      }
    }
  }, []);

  const login = useCallback((nume: string, rol: Rol) => {
    const u: UtilizatorCurent = { nume, rol, firmaId: null, token: null };
    localStorage.setItem(LS_USER, JSON.stringify(u));
    setUser(u);
  }, []);

  const loginServer = useCallback(async (serverUrl: string, nume: string, parola: string) => {
    try {
      const r = await fetch(`${serverUrl.replace(/\/$/, '')}/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ nume, parola }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        return { ok: false, eroare: body.error ?? `Eroare server (${r.status})` };
      }
      const { token, utilizator } = (await r.json()) as {
        token: string;
        utilizator: { nume: string; rol: Rol; firmaId: string | null };
      };
      const u: UtilizatorCurent = {
        nume: utilizator.nume,
        rol: utilizator.rol,
        firmaId: utilizator.firmaId,
        token,
      };
      localStorage.setItem(LS_USER, JSON.stringify(u));
      setUser(u);
      return { ok: true };
    } catch (e) {
      return { ok: false, eroare: e instanceof Error ? e.message : 'Serverul nu raspunde.' };
    }
  }, []);

  const logout = useCallback(() => {
    // Revoca explicit tokenul pe server (doar cand autentificarea a trecut
    // prin server — modul demo local nu are token) — altfel un token Bearer
    // (stateless) ar ramane valid pana la expirarea sa naturala (12 ore) chiar
    // dupa ce utilizatorul s-a deconectat din UI. Best-effort: nu blocheaza
    // deconectarea locala daca serverul nu raspunde.
    if (user?.token) {
      const serverUrl = localStorage.getItem('gr-server-url');
      if (serverUrl) {
        fetch(`${serverUrl.replace(/\/$/, '')}/auth/logout`, {
          method: 'POST',
          headers: { authorization: `Bearer ${user.token}` },
        }).catch(() => {});
      }
    }
    localStorage.removeItem(LS_USER);
    setUser(null);
  }, [user]);

  const areVoie = useCallback(
    (p: Permisiune) => (user ? arePermisiune(user.rol, p) : false),
    [user],
  );

  return (
    <Ctx.Provider value={{ user, login, loginServer, logout, areVoie }}>{children}</Ctx.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth must be used within AuthProvider');
  return c;
}

export { ETICHETE_ROL };
