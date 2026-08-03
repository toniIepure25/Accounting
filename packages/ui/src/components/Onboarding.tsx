import { cuiValid } from '@gr/fiscal-ro';
import { EDITIONS, type EditionId } from '@gr/license';
import { Building2, Check, KeyRound, Palette, Rocket } from 'lucide-react';
import { useState } from 'react';
import { useCollection } from '../hooks/useCollection.js';
import { useData } from '../lib/data-context.js';
import { useFirma } from '../lib/firma-context.js';
import { useLicense } from '../lib/license-context.js';
import { useToast } from '../lib/toast.js';
import { Field, Select } from './controls.js';
import { Button, Card, Input } from './ui.js';

export const LS_ONBOARDING = 'gr-configurare-initiala';

/** A fost parcursa (sau sarita) configurarea initiala? */
export function configurareInitialaFacuta(): boolean {
  return localStorage.getItem(LS_ONBOARDING) === 'da';
}

const PASI = ['Firma', 'Identitate', 'Licenta', 'Gata'] as const;

/**
 * Configurare initiala la prima pornire. Fara ea, un client nou ateriza direct
 * peste datele demo ale altcuiva ("SC Titan_CO SRL"), fara sa i se spuna
 * niciodata de unde isi seteaza propriile date — prima impresie a produsului
 * era a unei aplicatii deja folosite de altcineva.
 *
 * Wizard-ul scrie in aceleasi locuri ca ecranul de Setari (db.firme, licenta),
 * deci nu introduce o a doua sursa de adevar; e doar un drum ghidat prin
 * setarile care conteaza in prima zi. Poate fi sarit oricand si reluat din Setari.
 */
export function Onboarding({ onGata }: { onGata: () => void }) {
  const db = useData();
  const { rows: firme, update, create } = useCollection(db.firme);
  const { activeaza, seteazaEditie, ent } = useLicense();
  const { reincarca: reincarcaFirme } = useFirma();
  const toast = useToast();

  const [pas, setPas] = useState(0);
  const [denumire, setDenumire] = useState('');
  const [cui, setCui] = useState('');
  const [adresa, setAdresa] = useState('');
  const [localitate, setLocalitate] = useState('');
  const [judet, setJudet] = useState('');
  const [numeAplicatie, setNumeAplicatie] = useState('');
  const [culoare, setCuloare] = useState('');
  const [cheie, setCheie] = useState('');
  const [editie, setEditie] = useState<EditionId>('mobila');
  const [seSalveaza, setSeSalveaza] = useState(false);

  const cuiEValid = cui.trim() === '' || cuiValid(cui.trim());

  const finalizeaza = () => {
    localStorage.setItem(LS_ONBOARDING, 'da');
    onGata();
  };

  const salveazaFirma = async () => {
    setSeSalveaza(true);
    try {
      const date = {
        denumire: denumire.trim(),
        cui: cui.trim(),
        adresa: adresa.trim(),
        localitate: localitate.trim(),
        judet: judet.trim(),
        numeAplicatie: numeAplicatie.trim() || null,
        culoarePrimara: culoare || null,
      };
      // Prima firma din lista e cea implicita a instalarii: o actualizam in loc
      // sa cream una noua, ca sa nu ramana in nomenclator o firma demo orfana
      // pe langa cea reala a clientului.
      const existenta = firme[0];
      if (existenta) {
        await update(existenta.id, date);
      } else {
        await create({ ...date, cod: 'F1' });
      }
      // FirmaProvider tine o copie a listei de firme, incarcata la montare.
      // Fara reincarcare explicita, Sidebar-ul, brandingul si ecranul de Setari
      // ar continua sa afiseze denumirea veche (cea din datele demo) pana la o
      // reincarcare completa a paginii — exact impresia gresita pe care
      // wizard-ul trebuia sa o evite.
      reincarcaFirme();
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Nu am putut salva datele firmei.');
      return false;
    } finally {
      setSeSalveaza(false);
    }
  };

  const inainte = async () => {
    if (pas === 0) {
      if (!denumire.trim()) return toast.error('Denumirea firmei este obligatorie.');
      if (!cuiEValid) return toast.error('CUI-ul introdus nu este valid.');
    }
    if (pas === 1) {
      // Datele firmei + identitatea vizuala se salveaza impreuna, la iesirea
      // din pasul 2, ca sa nu scriem de doua ori in acelasi rand.
      if (!(await salveazaFirma())) return;
    }
    if (pas === 2) {
      if (cheie.trim()) {
        const ok = await activeaza(cheie.trim());
        if (!ok) return toast.error('Cheia de licenta este invalida sau expirata.');
        toast.success('Licenta a fost activata.');
      } else {
        seteazaEditie(editie);
      }
    }
    setPas((p) => p + 1);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-4">
      <Card className="w-full max-w-2xl p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-fg">
            <Rocket className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-fg">Bine ai venit</h1>
            <p className="text-sm text-fg-muted">
              Cateva setari si aplicatia e gata de folosit cu datele firmei tale.
            </p>
          </div>
        </div>

        <ol className="mb-7 flex items-center gap-2">
          {PASI.map((eticheta, i) => (
            <li key={eticheta} className="flex flex-1 items-center gap-2">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  i < pas
                    ? 'bg-primary text-primary-fg'
                    : i === pas
                      ? 'bg-primary/15 text-primary ring-2 ring-primary'
                      : 'bg-muted text-fg-muted'
                }`}
              >
                {i < pas ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span
                className={`hidden text-sm sm:inline ${i === pas ? 'font-medium text-fg' : 'text-fg-muted'}`}
              >
                {eticheta}
              </span>
              {i < PASI.length - 1 && <span className="h-px flex-1 bg-border" />}
            </li>
          ))}
        </ol>

        {pas === 0 && (
          <div className="space-y-4">
            <p className="flex items-center gap-2 text-sm font-medium text-fg">
              <Building2 className="h-4 w-4 text-primary" /> Datele firmei
            </p>
            <Field label="Denumire" hint="Apare pe facturi si pe documentele tiparite">
              <Input
                value={denumire}
                onChange={(e) => setDenumire(e.target.value)}
                placeholder="ex. Mobila Prod SRL"
                autoFocus
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="CUI"
                hint={cui.trim() && !cuiEValid ? 'CUI invalid (cifra de control)' : 'Optional acum'}
              >
                <Input
                  value={cui}
                  onChange={(e) => setCui(e.target.value)}
                  placeholder="ex. RO12345678"
                />
              </Field>
              <Field label="Judet">
                <Input value={judet} onChange={(e) => setJudet(e.target.value)} />
              </Field>
              <Field label="Localitate">
                <Input value={localitate} onChange={(e) => setLocalitate(e.target.value)} />
              </Field>
              <Field label="Adresa">
                <Input value={adresa} onChange={(e) => setAdresa(e.target.value)} />
              </Field>
            </div>
          </div>
        )}

        {pas === 1 && (
          <div className="space-y-4">
            <p className="flex items-center gap-2 text-sm font-medium text-fg">
              <Palette className="h-4 w-4 text-primary" /> Identitate vizuala (optional)
            </p>
            <p className="text-sm text-fg-muted">
              Aplicatia poate purta numele si culoarea firmei tale. Le poti schimba oricand din
              Setari.
            </p>
            <Field label="Nume aplicatie afisat" hint="Gol = denumirea generica a aplicatiei">
              <Input
                value={numeAplicatie}
                onChange={(e) => setNumeAplicatie(e.target.value)}
                placeholder="ex. Mobila Prod ERP"
              />
            </Field>
            <Field label="Culoare primara" hint="Aplicata in navigare, butoane si accente">
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={culoare || '#2563eb'}
                  onChange={(e) => setCuloare(e.target.value)}
                  className="h-10 w-16 cursor-pointer rounded border border-border bg-surface"
                  aria-label="Culoare primara"
                />
                <Button variant="secondary" size="sm" onClick={() => setCuloare('')}>
                  Foloseste culoarea implicita
                </Button>
              </div>
            </Field>
          </div>
        )}

        {pas === 2 && (
          <div className="space-y-4">
            <p className="flex items-center gap-2 text-sm font-medium text-fg">
              <KeyRound className="h-4 w-4 text-primary" /> Licenta
            </p>
            <Field
              label="Cheie de licenta"
              hint="Furnizata la achizitie. Lasa gol ca sa continui in modul de evaluare."
            >
              <Input
                value={cheie}
                onChange={(e) => setCheie(e.target.value)}
                placeholder="xxxxx.yyyyy"
              />
            </Field>
            {!cheie.trim() && (
              <Field label="Domeniul de activitate" hint="Determina modulele afisate in evaluare">
                <Select
                  options={Object.entries(EDITIONS).map(([id, e]) => ({
                    value: id,
                    label: e.label,
                  }))}
                  value={editie}
                  onChange={(e) => setEditie(e.target.value as EditionId)}
                />
              </Field>
            )}
          </div>
        )}

        {pas === 3 && (
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-sm font-medium text-fg">
              <Check className="h-4 w-4 text-success" /> Totul e pregatit
            </p>
            <p className="text-sm text-fg-muted">
              Aplicatia porneste cu date demo, ca sa poti explora imediat fiecare ecran. Le poti
              sterge oricand si poti importa propriile date din Setari → Backup si restaurare.
            </p>
            <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
              <p className="text-fg">
                <strong>{denumire || 'Firma noua'}</strong>
                {cui.trim() ? ` · ${cui.trim()}` : ''}
              </p>
              <p className="mt-1 text-fg-muted">
                Editie: {EDITIONS[ent.editie].label} · {ent.licentiat ? 'Licentiat' : 'Evaluare'}
              </p>
            </div>
          </div>
        )}

        <div className="mt-8 flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={finalizeaza}>
            Sari peste configurare
          </Button>
          <div className="flex gap-2">
            {pas > 0 && pas < 3 && (
              <Button variant="secondary" onClick={() => setPas((p) => p - 1)}>
                Inapoi
              </Button>
            )}
            {pas < 3 ? (
              <Button onClick={inainte} disabled={seSalveaza}>
                {seSalveaza ? 'Se salveaza...' : 'Continua'}
              </Button>
            ) : (
              <Button onClick={finalizeaza}>Intra in aplicatie</Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
