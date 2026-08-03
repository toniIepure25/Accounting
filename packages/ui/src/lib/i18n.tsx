import { type ReactNode, createContext, useContext, useMemo, useState } from 'react';

export type Lang = 'ro' | 'en';

type Dict = Record<string, string>;

const RO: Dict = {
  'app.title': 'Gestiune & Contabilitate',
  'nav.dashboard': 'Tablou de bord',
  'nav.nomenclatoare': 'Nomenclatoare',
  'nav.gestiuni': 'Gestiuni',
  'nav.parteneri': 'Parteneri',
  'nav.produse': 'Produse',
  'nav.documente': 'Documente',
  'nav.rapoarte': 'Rapoarte',
  'nav.setari': 'Setari',
  'common.search': 'Cauta...',
  'common.add': 'Adauga',
  'common.edit': 'Editeaza',
  'common.delete': 'Sterge',
  'common.save': 'Salveaza',
  'common.cancel': 'Renunta',
  'common.active': 'Activ',
  'common.inactive': 'Inactiv',
  'command.placeholder': 'Comanda sau cauta o pagina...',
  'dashboard.subtitle': 'Sumar operational',
  'kpi.stoc': 'Valoare stoc',
  'kpi.casa': 'Sold casa',
  'kpi.facturi': 'Facturi scadente',
  'kpi.comenzi': 'Comenzi in lucru',
  'gestiuni.title': 'Gestiuni',
  'gestiuni.subtitle': 'Locuri de stocare si gestionari',
  'gestiuni.cod': 'Cod',
  'gestiuni.denumire': 'Denumire',
  'gestiuni.gestionar': 'Gestionar',
  'gestiuni.cont': 'Cont',
  'gestiuni.tip': 'Tip',
  'gestiuni.status': 'Status',
  'gestiuni.empty': 'Nicio gestiune. Adauga prima gestiune.',
  'tip.cantitativ_valorica': 'Cantitativ-valorica',
  'tip.global_valorica': 'Global-valorica',
};

const EN: Dict = {
  'app.title': 'Inventory & Accounting',
  'nav.dashboard': 'Dashboard',
  'nav.nomenclatoare': 'Master data',
  'nav.gestiuni': 'Stock locations',
  'nav.parteneri': 'Partners',
  'nav.produse': 'Products',
  'nav.documente': 'Documents',
  'nav.rapoarte': 'Reports',
  'nav.setari': 'Settings',
  'common.search': 'Search...',
  'common.add': 'Add',
  'common.edit': 'Edit',
  'common.delete': 'Delete',
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.active': 'Active',
  'common.inactive': 'Inactive',
  'command.placeholder': 'Type a command or search a page...',
  'dashboard.subtitle': 'Operational summary',
  'kpi.stoc': 'Stock value',
  'kpi.casa': 'Cash balance',
  'kpi.facturi': 'Due invoices',
  'kpi.comenzi': 'Orders in progress',
  'gestiuni.title': 'Stock locations',
  'gestiuni.subtitle': 'Storage locations and managers',
  'gestiuni.cod': 'Code',
  'gestiuni.denumire': 'Name',
  'gestiuni.gestionar': 'Manager',
  'gestiuni.cont': 'Account',
  'gestiuni.tip': 'Type',
  'gestiuni.status': 'Status',
  'gestiuni.empty': 'No stock locations yet. Add the first one.',
  'tip.cantitativ_valorica': 'Quantitative-value',
  'tip.global_valorica': 'Global-value',
};

const DICTS: Record<Lang, Dict> = { ro: RO, en: EN };

interface I18nContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>('ro');
  const value = useMemo<I18nContextValue>(
    () => ({ lang, setLang, t: (key) => DICTS[lang][key] ?? key }),
    [lang],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
