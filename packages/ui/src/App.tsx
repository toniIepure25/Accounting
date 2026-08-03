import { Suspense, useState } from 'react';
import { RouterProvider, createHashRouter } from 'react-router-dom';
import { AppShell } from './components/AppShell.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { Gated } from './components/Gated.js';
import { Onboarding, configurareInitialaFacuta } from './components/Onboarding.js';
import { AuthProvider, useAuth } from './lib/auth-context.js';
import { ConfirmProvider } from './lib/confirm.js';
import { DataProviderContext } from './lib/data-context.js';
import { FirmaProvider } from './lib/firma-context.js';
import { I18nProvider } from './lib/i18n.js';
import { LicenseProvider } from './lib/license-context.js';
import { ThemeProvider } from './lib/theme.js';
import { ToastProvider } from './lib/toast.js';
import { allNavItems } from './modules/registry.js';
import { LoginPage } from './pages/Login.js';

/** Afisat cat timp se descarca chunk-ul unei pagini (code-splitting pe ruta). */
function SeIncarcaPagina() {
  return (
    <div className="flex h-40 items-center justify-center text-sm text-fg-muted">Se incarca...</div>
  );
}

// HashRouter: functioneaza identic in browser, in fisiere locale (Tauri) si offline.
// Fiecare ruta e protejata de licenta (modul) si, optional, de permisiunea RBAC
// a utilizatorului autentificat, prin <Gated moduleId=... permisiune=...>.
// `Suspense` e obligatoriu: paginile sunt incarcate lazy (vezi registry.ts), iar
// <Gated> ramane in AFARA lui, ca o ruta interzisa sa fie respinsa fara sa mai
// descarce degeaba chunk-ul paginii.
const router = createHashRouter([
  {
    path: '/',
    element: <AppShell />,
    children: allNavItems.map((item) => ({
      index: item.path === '/',
      path: item.path === '/' ? undefined : item.path.slice(1),
      element: (
        <Gated moduleId={item.moduleId} permisiune={item.permisiune}>
          <Suspense fallback={<SeIncarcaPagina />}>
            <item.component />
          </Suspense>
        </Gated>
      ),
    })),
  },
]);

/** Cere autentificare inainte de a randa aplicatia. */
function ContinutAutentificat() {
  const { user } = useAuth();
  // Configurarea initiala ruleaza DUPA autentificare (are nevoie de acces la
  // date pentru a scrie firma) si INAINTE de router, ca prima experienta a unui
  // client nou sa fie propriile lui date, nu cele demo ale altcuiva.
  const [configurat, setConfigurat] = useState(configurareInitialaFacuta);
  if (!user) return <LoginPage />;
  if (!configurat) {
    return (
      <DataProviderContext>
        <FirmaProvider>
          <Onboarding onGata={() => setConfigurat(true)} />
        </FirmaProvider>
      </DataProviderContext>
    );
  }
  return (
    <DataProviderContext>
      <FirmaProvider>
        {/*
          `v7_startTransition` e obligatoriu de cand rutele sunt incarcate lazy
          (vezi registry.ts): fara el, React 18 trateaza navigarea declansata de
          un click ca actualizare SINCRONA, iar o componenta care suspenda in
          timpul ei arunca "A component suspended while responding to
          synchronous input" in loc sa afiseze fallback-ul din <Suspense>. Cu
          flag-ul, react-router impacheteaza tranzitia in `startTransition`, iar
          indicatorul de incarcare devine comportamentul normal — vizibil mai
          ales pe conexiuni lente, unde chunk-ul paginii chiar are nevoie de timp.
        */}
        <RouterProvider router={router} future={{ v7_startTransition: true }} />
      </FirmaProvider>
    </DataProviderContext>
  );
}

export function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <I18nProvider>
          <ToastProvider>
            <ConfirmProvider>
              <LicenseProvider>
                <AuthProvider>
                  <ContinutAutentificat />
                </AuthProvider>
              </LicenseProvider>
            </ConfirmProvider>
          </ToastProvider>
        </I18nProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
