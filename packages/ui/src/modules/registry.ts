import type { Permisiune } from '@gr/auth';
import type { ModuleId } from '@gr/license';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowLeftRight,
  Banknote,
  BookOpenCheck,
  BookText,
  Boxes,
  Briefcase,
  Building2,
  Calculator,
  ChefHat,
  ClipboardList,
  Contact,
  Factory,
  FileDigit,
  FileInput,
  FileSpreadsheet,
  FileText,
  FolderTree,
  History,
  Landmark,
  Layers,
  LayoutDashboard,
  ListChecks,
  Package,
  PackageMinus,
  PackagePlus,
  RefreshCw,
  Repeat,
  Scale,
  Scissors,
  ScrollText,
  Settings,
  ShoppingCart,
  SlidersHorizontal,
  Sofa,
  Sparkles,
  Tags,
  Truck,
  Users,
  Warehouse,
} from 'lucide-react';
import { type ComponentType, lazy } from 'react';

/**
 * Incarcare la cerere a ecranelor (code-splitting pe ruta). Inainte, TOATE
 * paginile — inclusiv cele grele si rar folosite (fiscal, mobila, contabilitate,
 * rapoarte) — erau importate static aici, deci ajungeau intr-un singur bundle
 * de ~515 KB pe care fiecare utilizator il descarca integral la prima
 * deschidere, chiar daca folosea doar doua ecrane.
 *
 * Vite imparte automat fiecare `import()` intr-un chunk separat; paginile care
 * exporta mai multe ecrane din acelasi fisier (ex. `fiscal.tsx`) le impart pe
 * acelasi chunk, ceea ce e corect — sunt folosite impreuna.
 */
function pagina<M extends Record<string, unknown>>(
  incarca: () => Promise<M>,
  nume: keyof M & string,
): ComponentType {
  return lazy(() => incarca().then((m) => ({ default: m[nume] as ComponentType })));
}

const AsistentPage = pagina(() => import('../pages/Asistent.js'), 'AsistentPage');
const AuditPage = pagina(() => import('../pages/Audit.js'), 'AuditPage');
const DashboardPage = pagina(() => import('../pages/Dashboard.js'), 'DashboardPage');
const SetariPage = pagina(() => import('../pages/Setari.js'), 'SetariPage');
const UtilizatoriPage = pagina(() => import('../pages/Utilizatori.js'), 'UtilizatoriPage');
const BancaPage = pagina(() => import('../pages/banca.js'), 'BancaPage');
const CasaPage = pagina(() => import('../pages/casa.js'), 'CasaPage');

const contabilitate = () => import('../pages/contabilitate.js');
const BalantaVerificarePage = pagina(contabilitate, 'BalantaVerificarePage');
const CarteaMarePage = pagina(contabilitate, 'CarteaMarePage');
const FisaContPage = pagina(contabilitate, 'FisaContPage');
const RegistruJurnalPage = pagina(contabilitate, 'RegistruJurnalPage');

const documente = () => import('../pages/documente.js');
const AvizePage = pagina(documente, 'AvizePage');
const BonuriConsumPage = pagina(documente, 'BonuriConsumPage');
const FacturiCumpararePage = pagina(documente, 'FacturiCumpararePage');
const PlusMinusPage = pagina(documente, 'PlusMinusPage');
const ProformePage = pagina(documente, 'ProformePage');
const ReceptiiMarfaPage = pagina(documente, 'ReceptiiMarfaPage');
const ReceptiiMaterialePage = pagina(documente, 'ReceptiiMaterialePage');
const TransferuriPage = pagina(documente, 'TransferuriPage');
const VanzariAmanuntPage = pagina(documente, 'VanzariAmanuntPage');
const VanzariFacturatePage = pagina(documente, 'VanzariFacturatePage');

const fiscal = () => import('../pages/fiscal.js');
const D390Page = pagina(fiscal, 'D390Page');
const D394Page = pagina(fiscal, 'D394Page');
const DecontTvaPage = pagina(fiscal, 'DecontTvaPage');
const EFacturaPage = pagina(fiscal, 'EFacturaPage');
const SaftPage = pagina(fiscal, 'SaftPage');
const TvaReguliPage = pagina(() => import('../pages/TvaReguli.js'), 'TvaReguliPage');

const MijloaceFixePage = pagina(() => import('../pages/mijloace-fixe.js'), 'MijloaceFixePage');

const mobila = () => import('../pages/mobila.js');
const ComenziMobilaPage = pagina(mobila, 'ComenziMobilaPage');
const ConfiguratorPage = pagina(mobila, 'ConfiguratorPage');
const LivrariMobilaPage = pagina(mobila, 'LivrariMobilaPage');
const OptiuniMobilaPage = pagina(mobila, 'OptiuniMobilaPage');
const ProductieMobilaPage = pagina(mobila, 'ProductieMobilaPage');
const ReguliConfiguratorPage = pagina(mobila, 'ReguliConfiguratorPage');
const SarjaDebitarePage = pagina(mobila, 'SarjaDebitarePage');

const nomenclatoare = () => import('../pages/nomenclatoare.js');
const CatalogMarfuriPage = pagina(nomenclatoare, 'CatalogMarfuriPage');
const CatalogMaterialePage = pagina(nomenclatoare, 'CatalogMaterialePage');
const FirmaPage = pagina(nomenclatoare, 'FirmaPage');
const GestiuniPage = pagina(nomenclatoare, 'GestiuniPage');
const GrupeProdusePage = pagina(nomenclatoare, 'GrupeProdusePage');
const ListePreturiPage = pagina(nomenclatoare, 'ListePreturiPage');
const ObiecteInventarPage = pagina(nomenclatoare, 'ObiecteInventarPage');
const ParteneriPage = pagina(nomenclatoare, 'ParteneriPage');
const PersonalPage = pagina(nomenclatoare, 'PersonalPage');
const PlanConturiPage = pagina(nomenclatoare, 'PlanConturiPage');
const PuncteLucruPage = pagina(nomenclatoare, 'PuncteLucruPage');
const TipConsumPage = pagina(nomenclatoare, 'TipConsumPage');

const preparate = () => import('../pages/preparate.js');
const PreparatePage = pagina(preparate, 'PreparatePage');
const RetetePage = pagina(preparate, 'RetetePage');

const rapoarte = () => import('../pages/rapoarte.js');
const BalantaClientiPage = pagina(rapoarte, 'BalantaClientiPage');
const BalantaFurnizoriPage = pagina(rapoarte, 'BalantaFurnizoriPage');
const FiseMagaziePage = pagina(rapoarte, 'FiseMagaziePage');
const JurnalCumparariPage = pagina(rapoarte, 'JurnalCumparariPage');
const JurnalIesiriPage = pagina(rapoarte, 'JurnalIesiriPage');
const JurnalIntrariPage = pagina(rapoarte, 'JurnalIntrariPage');
const JurnalVanzariPage = pagina(rapoarte, 'JurnalVanzariPage');
const ReevaluareStocPage = pagina(rapoarte, 'ReevaluareStocPage');
const RegistruInventarPage = pagina(rapoarte, 'RegistruInventarPage');
const RulajePage = pagina(rapoarte, 'RulajePage');
const StocuriPage = pagina(rapoarte, 'StocuriPage');

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  component: ComponentType;
  /** Suprascrie permisiunea grupului pentru acest element (ex. o pagina mai sensibila intr-un grup altfel deschis). */
  permisiune?: Permisiune;
}

export interface AppModule {
  id: string;
  label: string;
  /** Modulul de licenta care deblocheaza acest grup. */
  moduleId: ModuleId;
  /** Permisiune RBAC necesara pentru acest grup (optional). */
  permisiune?: Permisiune;
  items: NavItem[];
}

/** NavItem cu modulul de licenta + permisiunea atasate (pentru rutare/gating). */
export interface RoutedNavItem extends NavItem {
  moduleId: ModuleId;
  permisiune?: Permisiune;
}

/** Registrul complet — acopera meniul KISS, reorganizat + modulul Mobila. */
export const modules: AppModule[] = [
  {
    id: 'principal',
    label: 'Principal',
    moduleId: 'core',
    items: [
      { label: 'Tablou de bord', path: '/', icon: LayoutDashboard, component: DashboardPage },
      { label: 'Asistent AI', path: '/asistent', icon: Sparkles, component: AsistentPage },
    ],
  },
  {
    id: 'date-fixe',
    label: 'Date fixe',
    moduleId: 'core',
    items: [
      { label: 'Firme', path: '/firme', icon: Briefcase, component: FirmaPage },
      { label: 'Parteneri', path: '/parteneri', icon: Users, component: ParteneriPage },
      {
        label: 'Puncte de lucru',
        path: '/puncte-lucru',
        icon: Building2,
        component: PuncteLucruPage,
      },
      { label: 'Gestiuni', path: '/gestiuni', icon: Warehouse, component: GestiuniPage },
      {
        label: 'Catalog materiale',
        path: '/materiale',
        icon: Boxes,
        component: CatalogMaterialePage,
      },
      { label: 'Catalog marfuri', path: '/marfuri', icon: Package, component: CatalogMarfuriPage },
      { label: 'Grupe de produse', path: '/grupe', icon: FolderTree, component: GrupeProdusePage },
      { label: 'Lista de preturi', path: '/preturi', icon: Tags, component: ListePreturiPage },
      {
        label: 'Planul de conturi',
        path: '/conturi',
        icon: BookText,
        component: PlanConturiPage,
        permisiune: 'contabilitate.vizualizare',
      },
      { label: 'Tip consum', path: '/tip-consum', icon: ListChecks, component: TipConsumPage },
      {
        label: 'Personal',
        path: '/personal',
        icon: Contact,
        component: PersonalPage,
        permisiune: 'personal.vizualizare',
      },
    ],
  },
  {
    id: 'horeca',
    label: 'HoReCa',
    moduleId: 'horeca',
    items: [
      { label: 'Preparate bucatarie', path: '/preparate', icon: ChefHat, component: PreparatePage },
      { label: 'Retete', path: '/retete', icon: ScrollText, component: RetetePage },
    ],
  },
  {
    id: 'stocuri',
    label: 'Stocuri & documente',
    moduleId: 'core',
    items: [
      {
        label: 'Receptii materiale',
        path: '/receptii-materiale',
        icon: PackagePlus,
        component: ReceptiiMaterialePage,
      },
      {
        label: 'Receptii marfa',
        path: '/receptii-marfa',
        icon: PackagePlus,
        component: ReceptiiMarfaPage,
      },
      {
        label: 'Bonuri de consum',
        path: '/bonuri',
        icon: PackageMinus,
        component: BonuriConsumPage,
      },
      {
        label: 'Transferuri',
        path: '/transferuri',
        icon: ArrowLeftRight,
        component: TransferuriPage,
      },
      { label: 'Plusuri / minusuri', path: '/plus-minus', icon: Scale, component: PlusMinusPage },
      {
        label: 'Fise de magazie',
        path: '/fise-magazie',
        icon: ClipboardList,
        component: FiseMagaziePage,
      },
      {
        label: 'Balanta stocurilor',
        path: '/balanta-stocuri',
        icon: Layers,
        component: StocuriPage,
      },
      { label: 'Rulaje', path: '/rulaje', icon: Repeat, component: RulajePage },
      {
        label: 'Jurnal de intrari',
        path: '/jurnal-intrari',
        icon: BookText,
        component: JurnalIntrariPage,
      },
      {
        label: 'Jurnal de iesiri',
        path: '/jurnal-iesiri',
        icon: BookText,
        component: JurnalIesiriPage,
      },
      {
        label: 'Reevaluare stoc',
        path: '/reevaluare',
        icon: RefreshCw,
        component: ReevaluareStocPage,
      },
    ],
  },
  {
    id: 'vanzari',
    label: 'Clienti & vanzari',
    moduleId: 'core',
    items: [
      {
        label: 'Vanzari cu amanuntul',
        path: '/vanzari-amanunt',
        icon: ShoppingCart,
        component: VanzariAmanuntPage,
      },
      {
        label: 'Vanzari facturate',
        path: '/vanzari-facturate',
        icon: FileText,
        component: VanzariFacturatePage,
      },
      { label: 'Avize de insotire', path: '/avize', icon: Truck, component: AvizePage },
      { label: 'Proforme', path: '/proforme', icon: FileText, component: ProformePage },
      {
        label: 'Jurnal de vanzari',
        path: '/jurnal-vanzari',
        icon: BookText,
        component: JurnalVanzariPage,
      },
      {
        label: 'Balanta clientilor',
        path: '/balanta-clienti',
        icon: Scale,
        component: BalantaClientiPage,
      },
    ],
  },
  {
    id: 'furnizori',
    label: 'Furnizori',
    moduleId: 'core',
    items: [
      {
        label: 'Facturi furnizori',
        path: '/facturi-furnizori',
        icon: FileInput,
        component: FacturiCumpararePage,
      },
      {
        label: 'Jurnal de cumparari',
        path: '/jurnal-cumparari',
        icon: BookText,
        component: JurnalCumparariPage,
      },
      {
        label: 'Balanta furnizorilor',
        path: '/balanta-furnizori',
        icon: Scale,
        component: BalantaFurnizoriPage,
      },
    ],
  },
  {
    id: 'trezorerie',
    label: 'Trezorerie',
    moduleId: 'core',
    permisiune: 'casa.operare',
    items: [
      { label: 'Registru de casa', path: '/casa', icon: Banknote, component: CasaPage },
      {
        label: 'Banca (extras + reconciliere)',
        path: '/banca',
        icon: Landmark,
        component: BancaPage,
      },
      {
        label: 'Obiecte de inventar',
        path: '/obiecte-inventar',
        icon: Boxes,
        component: ObiecteInventarPage,
      },
    ],
  },
  {
    id: 'mobila',
    label: 'Modul Mobila',
    moduleId: 'mobila',
    items: [
      {
        label: 'Configurator',
        path: '/mobila/configurator',
        icon: Sofa,
        component: ConfiguratorPage,
      },
      {
        label: 'Comenzi',
        path: '/mobila/comenzi',
        icon: ClipboardList,
        component: ComenziMobilaPage,
      },
      {
        label: 'Productie',
        path: '/mobila/productie',
        icon: Factory,
        component: ProductieMobilaPage,
      },
      {
        label: 'Sarja de debitare',
        path: '/mobila/debitare',
        icon: Scissors,
        component: SarjaDebitarePage,
      },
      { label: 'Livrari', path: '/mobila/livrari', icon: Truck, component: LivrariMobilaPage },
      {
        label: 'Optiuni configurator',
        path: '/mobila/optiuni',
        icon: SlidersHorizontal,
        component: OptiuniMobilaPage,
      },
      {
        label: 'Reguli configurator',
        path: '/mobila/reguli',
        icon: ListChecks,
        component: ReguliConfiguratorPage,
      },
    ],
  },
  {
    id: 'contabilitate',
    label: 'Contabilitate',
    moduleId: 'contabilitate',
    permisiune: 'contabilitate.vizualizare',
    items: [
      {
        label: 'Registru-jurnal',
        path: '/contabilitate/jurnal',
        icon: BookText,
        component: RegistruJurnalPage,
      },
      {
        label: 'Balanta de verificare',
        path: '/contabilitate/balanta',
        icon: Scale,
        component: BalantaVerificarePage,
      },
      {
        label: 'Fisa de cont',
        path: '/contabilitate/fisa',
        icon: FileText,
        component: FisaContPage,
      },
      {
        label: 'Cartea mare',
        path: '/contabilitate/cartea-mare',
        icon: BookOpenCheck,
        component: CarteaMarePage,
      },
      {
        label: 'Registru-inventar',
        path: '/contabilitate/inventar',
        icon: ClipboardList,
        component: RegistruInventarPage,
      },
      {
        label: 'Mijloace fixe',
        path: '/contabilitate/mijloace-fixe',
        icon: Calculator,
        component: MijloaceFixePage,
      },
    ],
  },
  {
    id: 'fiscal',
    label: 'Fiscal',
    moduleId: 'fiscal',
    permisiune: 'fiscal.trimitere',
    items: [
      { label: 'Reguli TVA', path: '/fiscal/reguli-tva', icon: Landmark, component: TvaReguliPage },
      { label: 'e-Factura', path: '/fiscal/efactura', icon: FileDigit, component: EFacturaPage },
      {
        label: 'Decont TVA (D300)',
        path: '/fiscal/decont',
        icon: Landmark,
        component: DecontTvaPage,
      },
      { label: 'D394', path: '/fiscal/d394', icon: FileSpreadsheet, component: D394Page },
      { label: 'D390 (VIES)', path: '/fiscal/d390', icon: FileSpreadsheet, component: D390Page },
      { label: 'SAF-T (D406)', path: '/fiscal/saft', icon: FileSpreadsheet, component: SaftPage },
    ],
  },
  {
    id: 'audit',
    label: 'Audit',
    moduleId: 'core',
    permisiune: 'audit.vizualizare',
    items: [{ label: 'Jurnal de audit', path: '/audit', icon: History, component: AuditPage }],
  },
  {
    id: 'sistem',
    label: 'Sistem',
    moduleId: 'core',
    permisiune: 'setari.administrare',
    items: [
      {
        label: 'Utilizatori',
        path: '/utilizatori',
        icon: Users,
        component: UtilizatoriPage,
        permisiune: 'utilizatori.administrare',
      },
      { label: 'Setari', path: '/setari', icon: Settings, component: SetariPage },
    ],
  },
];

export const allNavItems: RoutedNavItem[] = modules.flatMap((m) =>
  m.items.map((i) => ({ ...i, moduleId: m.moduleId, permisiune: i.permisiune ?? m.permisiune })),
);
