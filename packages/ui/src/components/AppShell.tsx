import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useAplicaBranding } from '../lib/branding.js';
import { useFirma } from '../lib/firma-context.js';
import { BannerLicenta } from './BannerLicenta.js';
import { CommandPalette } from './CommandPalette.js';
import { Sidebar } from './Sidebar.js';
import { Topbar } from './Topbar.js';

export function AppShell() {
  const [cmdOpen, setCmdOpen] = useState(false);
  const { firmaCurenta } = useFirma();
  useAplicaBranding(firmaCurenta);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar onOpenCommand={() => setCmdOpen(true)} />
        <BannerLicenta />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
    </div>
  );
}
