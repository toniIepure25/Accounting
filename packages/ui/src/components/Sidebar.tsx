import { NavLink } from 'react-router-dom';
import { useAuth } from '../lib/auth-context.js';
import { cn } from '../lib/cn.js';
import { useFirma } from '../lib/firma-context.js';
import { useI18n } from '../lib/i18n.js';
import { useLicense } from '../lib/license-context.js';
import { modules } from '../modules/registry.js';

export function Sidebar() {
  const { t } = useI18n();
  const { areModul } = useLicense();
  const { areVoie } = useAuth();
  const { firme, firmaCurenta, selecteazaFirma } = useFirma();
  const vizibile = modules
    .filter((m) => areModul(m.moduleId))
    .filter((m) => !m.permisiune || areVoie(m.permisiune))
    // Un element poate suprascrie permisiunea grupului (ex. "Personal" intr-un
    // grup altfel deschis) — fara filtrarea asta, el ar ramane vizibil in meniu
    // chiar daca ruta lui e blocata de <Gated>, ducand la un link "mort".
    .map((m) => ({
      ...m,
      items: m.items.filter((i) => !i.permisiune || areVoie(i.permisiune)),
    }))
    .filter((m) => m.items.length > 0);

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex h-14 items-center gap-2 border-b border-border px-5">
        {firmaCurenta?.logoDataUrl ? (
          <img
            src={firmaCurenta.logoDataUrl}
            alt=""
            className="h-8 w-8 shrink-0 rounded-lg object-contain"
          />
        ) : (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-fg font-bold">
            {(firmaCurenta?.numeAplicatie ?? t('app.title')).charAt(0).toUpperCase()}
          </div>
        )}
        <span className="truncate font-semibold tracking-tight text-fg">
          {firmaCurenta?.numeAplicatie || t('app.title')}
        </span>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {vizibile.map((mod) => (
          <div key={mod.id}>
            {mod.id !== 'principal' && (
              <p className="px-3 pb-1.5 text-xs font-medium uppercase tracking-wider text-fg-muted">
                {mod.label}
              </p>
            )}
            <div className="space-y-0.5">
              {mod.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-fg-muted hover:bg-muted hover:text-fg',
                    )
                  }
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-border px-5 py-3 text-xs text-fg-muted">
        {firme.length > 1 ? (
          <select
            value={firmaCurenta?.id ?? ''}
            onChange={(e) => selecteazaFirma(e.target.value)}
            className="w-full bg-transparent text-xs text-fg-muted outline-none"
          >
            {firme.map((f) => (
              <option key={f.id} value={f.id}>
                {f.denumire}
              </option>
            ))}
          </select>
        ) : (
          <span>{firmaCurenta?.denumire ?? 'Nicio firma'}</span>
        )}
        <span> · v0.0.0</span>
      </div>
    </aside>
  );
}
