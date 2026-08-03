import {
  DEPARTAMENTE_PRODUCTIE,
  ETICHETE_DEPARTAMENT,
  type OperatiuneBancara,
  type OperatiuneCasa,
  type Partener,
  balantaParteneri,
  parseConfiguratieMobila,
  urmatorulDepartament,
} from '@gr/core-domain';
import {
  AlertTriangle,
  Banknote,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Landmark,
  Loader2,
  Package,
  Receipt,
  Truck,
  Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, PageHeader } from '../components/ui.js';
import { useAIContext } from '../hooks/useAIContext.js';
import { useCollection } from '../hooks/useCollection.js';
import { useData } from '../lib/data-context.js';
import * as fmt from '../lib/format.js';
import { useI18n } from '../lib/i18n.js';
import { useLicense } from '../lib/license-context.js';

function Kpi({
  icon: Icon,
  label,
  value,
  tone = 'primary',
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone?: 'primary' | 'danger';
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-fg-muted">{label}</span>
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-lg ${
            tone === 'danger' ? 'bg-danger/10 text-danger' : 'bg-primary/10 text-primary'
          }`}
        >
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <div
        className={`mt-3 text-2xl font-semibold ${tone === 'danger' ? 'text-danger' : 'text-fg'}`}
      >
        {value}
      </div>
    </Card>
  );
}

/** Bara orizontala simpla pentru o magnitudine (numar) pe o categorie ordonata — o singura nuanta (--primary), nicio paleta categoriala necesara. */
function BaraMagnitudine({
  eticheta,
  valoare,
  maxim,
}: { eticheta: string; valoare: number; maxim: number }) {
  const procent = maxim > 0 ? Math.round((valoare / maxim) * 100) : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-28 shrink-0 text-fg-muted">{eticheta}</span>
      <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
        <span
          className="block h-full rounded-full bg-primary"
          style={{ width: `${Math.max(procent, valoare > 0 ? 4 : 0)}%` }}
        />
      </span>
      <span className="w-6 shrink-0 text-right font-medium text-fg">{valoare}</span>
    </div>
  );
}

const ETICHETE_STADIU: Record<string, string> = {
  oferta: 'Oferta',
  confirmata: 'Confirmata',
  in_productie: 'In productie',
  finalizata: 'Finalizata',
  livrata: 'Livrata',
  facturata: 'Facturata',
};
const ORDINE_STADII = [
  'oferta',
  'confirmata',
  'in_productie',
  'finalizata',
  'livrata',
  'facturata',
];

function isoAstazi(offsetZile = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetZile);
  return d.toISOString().slice(0, 10);
}

export function DashboardPage() {
  const { t } = useI18n();
  const db = useData();
  const { areModul } = useLicense();
  const ctx = useAIContext();
  const { rows: documente, loading: incarcaDocumente } = useCollection(db.documente);
  const [banca, setBanca] = useState<OperatiuneBancara[]>([]);
  const [casa, setCasa] = useState<OperatiuneCasa[]>([]);
  const [parteneri, setParteneri] = useState<Partener[]>([]);
  const [incarcaExtra, setIncarcaExtra] = useState(true);
  useEffect(() => {
    Promise.all([db.operatiuniBancare.list(), db.operatiuniCasa.list(), db.parteneri.list()]).then(
      ([b, c, p]) => {
        setBanca(b);
        setCasa(c);
        setParteneri(p);
        setIncarcaExtra(false);
      },
    );
  }, [db]);
  // Un singur comutator pentru tot continutul: mai simplu si mai sigur decat sa
  // gardam fiecare KPI in parte — altfel cifrele reale (calculate din stoc/casa/
  // documente) ar aparea pe rand, in loc sa apara toate deodata, gata calculate.
  const seIncarca = incarcaDocumente || incarcaExtra;

  const soldBancaBani = useMemo(() => banca.reduce((a, b) => a + b.sumaBani, 0), [banca]);

  const deIncasatBani = useMemo(() => {
    const solduri = balantaParteneri(
      documente,
      casa,
      ['factura_vanzare', 'vanzare_amanunt'],
      'incasare',
    );
    return solduri.reduce((a, s) => a + Math.max(0, s.soldBani), 0);
  }, [documente, casa]);

  const comenziMobila = useMemo(
    () => documente.filter((d) => d.tip === 'comanda_mobila'),
    [documente],
  );

  const stadii = useMemo(() => {
    const counts: Record<string, number> = Object.fromEntries(ORDINE_STADII.map((s) => [s, 0]));
    for (const d of comenziMobila) {
      const stadiu = parseConfiguratieMobila(d.meta).stareProductie;
      counts[stadiu] = (counts[stadiu] ?? 0) + 1;
    }
    return counts;
  }, [comenziMobila]);
  const maximStadiu = Math.max(1, ...Object.values(stadii));

  const capacitatePeDepartament = useMemo(() => {
    const inProductie = comenziMobila.filter(
      (d) => parseConfiguratieMobila(d.meta).stareProductie === 'in_productie',
    );
    return DEPARTAMENTE_PRODUCTIE.map((dep) => ({
      departament: dep,
      comenzi: inProductie.filter(
        (d) => urmatorulDepartament(parseConfiguratieMobila(d.meta).departamenteFinalizate) === dep,
      ).length,
    }));
  }, [comenziMobila]);

  const partenerNume = (id: string | null) => parteneri.find((p) => p.id === id)?.denumire ?? '—';

  const livrariSaptamana = useMemo(() => {
    const azi = isoAstazi(0);
    const peste7 = isoAstazi(7);
    return comenziMobila
      .map((d) => ({ doc: d, cfg: parseConfiguratieMobila(d.meta) }))
      .filter(
        ({ doc, cfg }) =>
          (doc.scadenta && doc.scadenta >= azi && doc.scadenta <= peste7) ||
          (cfg.dataMontaj && cfg.dataMontaj >= azi && cfg.dataMontaj <= peste7),
      )
      .sort((a, b) =>
        (a.doc.scadenta ?? a.cfg.dataMontaj ?? '').localeCompare(
          b.doc.scadenta ?? b.cfg.dataMontaj ?? '',
        ),
      );
  }, [comenziMobila]);

  const areMobila = areModul('mobila');

  if (seIncarca) {
    return (
      <div>
        <PageHeader title={t('nav.dashboard')} subtitle={t('dashboard.subtitle')} />
        <div className="flex items-center justify-center gap-2 py-24 text-sm text-fg-muted">
          <Loader2 className="h-5 w-5 animate-spin" /> Se incarca tabloul de bord...
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={t('nav.dashboard')} subtitle={t('dashboard.subtitle')} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Package} label="Valoare stoc" value={fmt.lei(ctx.valoareStocBani)} />
        <Kpi
          icon={Banknote}
          label="Sold casa"
          value={fmt.lei(ctx.soldCasaBani)}
          tone={ctx.soldCasaBani < 0 ? 'danger' : 'primary'}
        />
        <Kpi
          icon={Landmark}
          label="Sold banca"
          value={fmt.lei(soldBancaBani)}
          tone={soldBancaBani < 0 ? 'danger' : 'primary'}
        />
        <Kpi
          icon={Receipt}
          label="Sold clienti (de incasat)"
          value={fmt.lei(deIncasatBani)}
          tone={deIncasatBani > 0 ? 'danger' : 'primary'}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Kpi
          icon={ClipboardList}
          label="Comenzi mobila active"
          value={String(ctx.comenziInLucru)}
        />
        <Kpi icon={AlertTriangle} label="TVA de plata" value={fmt.lei(ctx.tvaDePlataBani)} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-4 flex items-center gap-2 font-semibold text-fg">
            <AlertTriangle className="h-5 w-5 text-warning" /> Alerte stoc (sub minim)
          </h3>
          {ctx.produseSubMinim.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-fg-muted">
              <CheckCircle2 className="h-4 w-4 text-success" /> Niciun produs sub stocul minim.
            </p>
          ) : (
            <div className="space-y-2">
              {ctx.produseSubMinim.map((p) => (
                <div
                  key={p.denumire}
                  className="flex items-center justify-between rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm"
                >
                  <span className="text-fg">{p.denumire}</span>
                  <span className="text-fg-muted">
                    stoc <b className="text-warning">{fmt.cant(p.stoc)}</b> / minim{' '}
                    {fmt.cant(p.minim)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {areMobila ? (
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-semibold text-fg">
                <ClipboardList className="h-5 w-5 text-primary" /> Comenzi mobila pe stadiu
              </h3>
              <Link to="/mobila/productie" className="text-xs text-primary hover:underline">
                Vezi productia →
              </Link>
            </div>
            <div className="space-y-2.5">
              {ORDINE_STADII.map((s) => (
                <BaraMagnitudine
                  key={s}
                  eticheta={ETICHETE_STADIU[s]!}
                  valoare={stadii[s] ?? 0}
                  maxim={maximStadiu}
                />
              ))}
            </div>
          </Card>
        ) : (
          <Card className="p-5">
            <h3 className="mb-2 font-semibold text-fg">Sumar operational</h3>
            <p className="text-sm text-fg-muted">
              {ctx.nrClienti} clienti · {ctx.nrFurnizori} furnizori · vanzari{' '}
              {fmt.lei(ctx.vanzariBrutBani)}
            </p>
          </Card>
        )}
      </div>

      {areMobila && (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="p-5">
            <h3 className="mb-4 flex items-center gap-2 font-semibold text-fg">
              <Wrench className="h-5 w-5 text-primary" /> Capacitate productie pe departament
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 lg:grid-cols-3">
              {capacitatePeDepartament.map(({ departament, comenzi }) => (
                <div key={departament} className="rounded-lg border border-border p-3 text-center">
                  <div className="text-2xl font-semibold text-fg">{comenzi}</div>
                  <div className="text-xs text-fg-muted">{ETICHETE_DEPARTAMENT[departament]}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-semibold text-fg">
                <Calendar className="h-5 w-5 text-primary" /> Livrari/montaj in urmatoarele 7 zile
              </h3>
              <Link to="/mobila/livrari" className="text-xs text-primary hover:underline">
                Vezi agenda →
              </Link>
            </div>
            {livrariSaptamana.length === 0 ? (
              <p className="text-sm text-fg-muted">
                Nicio livrare sau montaj planificat in perioada.
              </p>
            ) : (
              <div className="space-y-2">
                {livrariSaptamana.map(({ doc, cfg }) => {
                  const esteLivrare =
                    !!doc.scadenta && doc.scadenta >= isoAstazi(0) && doc.scadenta <= isoAstazi(7);
                  return (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                    >
                      <span className="flex items-center gap-2">
                        {esteLivrare ? (
                          <Truck className="h-4 w-4 text-primary" />
                        ) : (
                          <Wrench className="h-4 w-4 text-warning" />
                        )}
                        <span className="font-mono text-xs">{doc.cod}</span>
                        <span className="text-fg-muted">{partenerNume(doc.partenerId)}</span>
                      </span>
                      <span className="text-fg-muted">
                        {fmt.data(esteLivrare ? doc.scadenta : cfg.dataMontaj)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
