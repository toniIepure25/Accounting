import type { Firma } from '@gr/core-domain';
import { exportDate, importDate } from '@gr/data';
import { EDITIONS, ETICHETE_MODULE, type EditionId } from '@gr/license';
import {
  Building2,
  DatabaseBackup,
  Download,
  Globe,
  ImageOff,
  KeyRound,
  Lock,
  Moon,
  Palette,
  RefreshCw,
  Scale,
  Server,
  ShieldCheck,
  Sparkles,
  Sun,
  Unlock,
  Upload,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Field, Modal, Select } from '../components/controls.js';
import { Badge, Button, Card, Input, PageHeader } from '../components/ui.js';
import { useAdmin } from '../hooks/useAdmin.js';
import { useConfirm } from '../lib/confirm.js';
import { useData } from '../lib/data-context.js';
import { downloadText } from '../lib/export.js';
import { useFirma } from '../lib/firma-context.js';
import { useI18n } from '../lib/i18n.js';
import { DOCUMENTE_LEGALE, type DocumentLegal } from '../lib/legal.js';
import { useLicense } from '../lib/license-context.js';
import { useTheme } from '../lib/theme.js';
import { useToast } from '../lib/toast.js';

export function SetariPage() {
  const { theme, toggle } = useTheme();
  const { lang, setLang } = useI18n();
  const { ent, activeaza, seteazaEditie, reset } = useLicense();
  const toast = useToast();
  const confirmDialog = useConfirm();
  const [mod, setMod] = useState(() => localStorage.getItem('gr-deployment-mode') ?? 'local');
  const [serverUrl, setServerUrl] = useState(() => localStorage.getItem('gr-server-url') ?? '');
  const [stareServer, setStareServer] = useState<'necunoscuta' | 'verificare' | 'ok' | 'eroare'>(
    'necunoscuta',
  );
  const [detaliiServer, setDetaliiServer] = useState('');
  const [cheie, setCheie] = useState('');
  const [aiUrl, setAiUrl] = useState(() => localStorage.getItem('gr-ai-url') ?? '');
  const [docLegal, setDocLegal] = useState<DocumentLegal | null>(null);
  const db = useData();
  const admin = useAdmin();
  const fisierRef = useRef<HTMLInputElement>(null);
  const { firmaCurenta, reincarca: reincarcaFirme } = useFirma();
  const [dataInchidere, setDataInchidere] = useState('');

  type FirmaForm = Pick<
    Firma,
    'denumire' | 'cui' | 'adresa' | 'judet' | 'localitate' | 'iban' | 'banca' | 'logoDataUrl'
  > & {
    // Editate ca text simplu (nu string | null) — convertite in null la salvare doar daca raman goale.
    numeAplicatie: string;
    culoarePrimara: string;
  };
  const [firmaForm, setFirmaForm] = useState<FirmaForm>({
    denumire: '',
    cui: '',
    adresa: '',
    judet: '',
    localitate: '',
    iban: '',
    banca: '',
    numeAplicatie: '',
    culoarePrimara: '',
    logoDataUrl: null,
  });
  const logoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!firmaCurenta) return;
    setFirmaForm({
      denumire: firmaCurenta.denumire,
      cui: firmaCurenta.cui,
      adresa: firmaCurenta.adresa,
      judet: firmaCurenta.judet,
      localitate: firmaCurenta.localitate,
      iban: firmaCurenta.iban,
      banca: firmaCurenta.banca,
      numeAplicatie: firmaCurenta.numeAplicatie ?? '',
      culoarePrimara: firmaCurenta.culoarePrimara ?? '',
      logoDataUrl: firmaCurenta.logoDataUrl,
    });
  }, [firmaCurenta]);

  const salveazaFirma = async () => {
    if (!firmaCurenta) return;
    try {
      await db.firme.update(firmaCurenta.id, {
        ...firmaForm,
        numeAplicatie: firmaForm.numeAplicatie.trim() || null,
        culoarePrimara: firmaForm.culoarePrimara || null,
      });
      reincarcaFirme();
      toast.success('Datele firmei au fost salvate.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Salvarea datelor firmei a esuat.');
    }
  };

  const LIMITA_LOGO_BYTES = 400_000; // logo mic, incarcat direct (fara upload pe server) si pastrat ca data URL in baza de date
  const incarcaLogo = (fisier: File) => {
    if (fisier.size > LIMITA_LOGO_BYTES) {
      toast.error(
        `Logo prea mare (${Math.round(fisier.size / 1024)} KB) — maxim ${Math.round(LIMITA_LOGO_BYTES / 1000)} KB.`,
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setFirmaForm((f) => ({ ...f, logoDataUrl: reader.result as string }));
    reader.readAsDataURL(fisier);
  };

  const inchidePerioada = async () => {
    if (!firmaCurenta || !dataInchidere) return;
    await db.firme.update(firmaCurenta.id, { perioadaBlocataPanaLa: dataInchidere });
    reincarcaFirme();
    toast.success(
      `Perioada inchisa pana la ${dataInchidere} — documentele din aceasta perioada nu mai pot fi validate/editate/sterse de niciun rol.`,
    );
  };
  const deschidePerioada = async () => {
    if (!firmaCurenta) return;
    await db.firme.update(firmaCurenta.id, { perioadaBlocataPanaLa: null });
    reincarcaFirme();
    toast.info('Perioada redeschisa — toate documentele pot fi editate din nou.');
  };

  const salveazaAi = () => {
    if (aiUrl.trim()) localStorage.setItem('gr-ai-url', aiUrl.trim());
    else localStorage.removeItem('gr-ai-url');
  };

  const descarcaBackup = async () => {
    try {
      // Mod retea: instantaneu COMPLET al bazei de pe server (incl. registrele —
      // jurnal, stoc, evenimente fiscale), verificat prin proba de restaurare.
      // Mod local: exportul DataProvider (nomenclatoare + documente + casa + audit).
      const snapshot = admin ? await admin.backup() : await exportDate(db);
      const tip = admin ? 'complet' : 'date';
      const fisier = `backup-${tip}-${new Date().toISOString().slice(0, 10)}.json`;
      downloadText(fisier, JSON.stringify(snapshot, null, 2), 'application/json');
      toast.success(`Backup descarcat: ${fisier}`);
    } catch (e) {
      toast.error(`Backup esuat: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const restaureazaBackup = async (fisier: File) => {
    const ok = await confirmDialog({
      title: 'Restaureaza din backup',
      message:
        'Restaurarea INLOCUIESTE toate datele curente cu cele din backup. Aceasta actiune nu poate fi anulata.',
      confirmLabel: 'Restaureaza',
      danger: true,
    });
    if (!ok) return;
    try {
      const text = await fisier.text();
      const snapshot = JSON.parse(text);
      // Mod retea: restaurare COMPLETA pe server (atomica, verificata — jurnalul
      // trebuie sa ramana echilibrat, altfel rollback). Mod local: importul DataProvider.
      let mesaj: string;
      if (admin) {
        const r = await admin.restaureaza(snapshot);
        mesaj = `Restaurat pe server: ${r.tabeleRestaurate} tabele, ${r.randuriRestaurate} randuri.`;
      } else {
        const r = await importDate(db, snapshot, 'inlocuieste');
        mesaj = `Restaurat: ${r.tabeleRestaurate} tabele, ${r.inregistrariRestaurate} inregistrari.`;
      }
      // Nu reincarcam pagina: in modul local (SQLite) datele sunt persistente,
      // dar in modul demo (in-memory) un reload ar sterge tocmai ce am restaurat.
      // Ecranele deja deschise cu liste isi reincarca datele la urmatoarea navigare.
      toast.success(`${mesaj} Navigheaza catre alt ecran pentru a vedea datele restaurate.`);
    } catch (e) {
      toast.error(`Eroare la restaurare: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const activeazaLicenta = async () => {
    const ok = await activeaza(cheie);
    if (ok) toast.success('Licenta activata.');
    else toast.error('Cheie invalida sau expirata.');
  };

  const schimbaMod = (m: string) => {
    setMod(m);
    localStorage.setItem('gr-deployment-mode', m);
  };

  const salveazaServerUrl = () => {
    if (serverUrl.trim()) localStorage.setItem('gr-server-url', serverUrl.trim());
    else localStorage.removeItem('gr-server-url');
    setStareServer('necunoscuta');
    setDetaliiServer('');
  };

  const verificaServer = async () => {
    const url = serverUrl.trim().replace(/\/$/, '');
    if (!url) {
      setStareServer('eroare');
      setDetaliiServer('Introdu URL-ul serverului.');
      return;
    }
    setStareServer('verificare');
    const start = performance.now();
    try {
      const [health, ready] = await Promise.all([fetch(`${url}/health`), fetch(`${url}/ready`)]);
      const latenta = Math.round(performance.now() - start);
      if (!health.ok || !ready.ok) throw new Error(`HTTP ${health.status}/${ready.status}`);
      const readyJson = (await ready.json()) as { gata: boolean; persistent: boolean };
      setStareServer(readyJson.gata ? 'ok' : 'eroare');
      setDetaliiServer(
        `${latenta} ms · stocare: ${readyJson.persistent ? 'PostgreSQL (persistenta)' : 'memorie (demo, nepersistenta)'}`,
      );
    } catch (e) {
      setStareServer('eroare');
      setDetaliiServer(e instanceof Error ? e.message : 'Server inaccesibil.');
    }
  };

  return (
    <div>
      <PageHeader title="Setari" subtitle="Configurarea aplicatiei si a firmei" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-4 flex items-center gap-2 font-semibold text-fg">
            <Building2 className="h-5 w-5 text-primary" /> Date firma
          </h3>
          {firmaCurenta ? (
            <div className="space-y-3">
              <Field label="Denumire">
                <Input
                  value={firmaForm.denumire}
                  onChange={(e) => setFirmaForm((f) => ({ ...f, denumire: e.target.value }))}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="CUI">
                  <Input
                    value={firmaForm.cui}
                    onChange={(e) => setFirmaForm((f) => ({ ...f, cui: e.target.value }))}
                  />
                </Field>
                <Field label="Banca">
                  <Input
                    value={firmaForm.banca}
                    onChange={(e) => setFirmaForm((f) => ({ ...f, banca: e.target.value }))}
                  />
                </Field>
              </div>
              <Field label="Adresa">
                <Input
                  value={firmaForm.adresa}
                  onChange={(e) => setFirmaForm((f) => ({ ...f, adresa: e.target.value }))}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Judet">
                  <Input
                    value={firmaForm.judet}
                    onChange={(e) => setFirmaForm((f) => ({ ...f, judet: e.target.value }))}
                  />
                </Field>
                <Field label="Localitate">
                  <Input
                    value={firmaForm.localitate}
                    onChange={(e) => setFirmaForm((f) => ({ ...f, localitate: e.target.value }))}
                  />
                </Field>
              </div>
              <Field label="IBAN">
                <Input
                  value={firmaForm.iban}
                  onChange={(e) => setFirmaForm((f) => ({ ...f, iban: e.target.value }))}
                />
              </Field>
              <Button onClick={salveazaFirma}>Salveaza datele firmei</Button>
            </div>
          ) : (
            <p className="text-sm text-fg-muted">Nicio firma configurata inca.</p>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="mb-4 flex items-center gap-2 font-semibold text-fg">
            <Palette className="h-5 w-5 text-primary" /> Branding (marca proprie)
          </h3>
          <p className="mb-4 text-sm text-fg-muted">
            Aplicatia poate fi prezentata/vanduta sub identitatea vizuala a fiecarui client: logo si
            culoare in Sidebar, si pe documentele tiparite (factura, deviz). Fara logo si culoare
            setate, ramane brandingul generic al aplicatiei.
          </p>
          {firmaCurenta ? (
            <div className="space-y-4">
              <Field label="Nume aplicatie afisat" hint="Gol = denumirea generica a aplicatiei">
                <Input
                  value={firmaForm.numeAplicatie}
                  onChange={(e) => setFirmaForm((f) => ({ ...f, numeAplicatie: e.target.value }))}
                  placeholder="ex. Titan ERP"
                />
              </Field>
              <Field label="Culoare primara" hint="Aplicata in navigare, butoane si accente">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={firmaForm.culoarePrimara || '#2563eb'}
                    onChange={(e) =>
                      setFirmaForm((f) => ({ ...f, culoarePrimara: e.target.value }))
                    }
                    className="h-9 w-14 cursor-pointer rounded border border-border bg-transparent p-0.5"
                  />
                  <Input
                    value={firmaForm.culoarePrimara}
                    onChange={(e) =>
                      setFirmaForm((f) => ({ ...f, culoarePrimara: e.target.value }))
                    }
                    placeholder="implicita (albastru)"
                  />
                  {firmaForm.culoarePrimara && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setFirmaForm((f) => ({ ...f, culoarePrimara: '' }))}
                    >
                      Reseteaza
                    </Button>
                  )}
                </div>
              </Field>
              <Field label="Logo">
                <div className="flex items-center gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/30">
                    {firmaForm.logoDataUrl ? (
                      <img
                        src={firmaForm.logoDataUrl}
                        alt="Logo firma"
                        className="h-full w-full rounded-lg object-contain"
                      />
                    ) : (
                      <ImageOff className="h-5 w-5 text-fg-muted" />
                    )}
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => logoRef.current?.click()}>
                    <Upload className="h-4 w-4" /> Incarca logo
                  </Button>
                  {firmaForm.logoDataUrl && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setFirmaForm((f) => ({ ...f, logoDataUrl: null }))}
                    >
                      Sterge logo
                    </Button>
                  )}
                  <input
                    ref={logoRef}
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) incarcaLogo(f);
                      e.target.value = '';
                    }}
                  />
                </div>
                <p className="mt-1 text-xs text-fg-muted">PNG/JPG/SVG, maxim 400 KB.</p>
              </Field>
              <Button onClick={salveazaFirma}>Salveaza brandingul</Button>
            </div>
          ) : (
            <p className="text-sm text-fg-muted">Nicio firma configurata inca.</p>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="mb-4 flex items-center gap-2 font-semibold text-fg">
            <Server className="h-5 w-5 text-primary" /> Mod de functionare
          </h3>
          <Field label="Deployment" hint="Local (SQLite) · Retea (PostgreSQL) · Cloud">
            <Select
              options={[
                { value: 'local', label: 'Local demo — date in memorie (se pierd la refresh)' },
                {
                  value: 'local-sqlite',
                  label: 'Local — un calculator (SQLite persistent, motor real)',
                },
                { value: 'lan', label: 'Retea locala — mai multe terminale (PostgreSQL)' },
                { value: 'cloud', label: 'Cloud — mai multe locatii' },
              ]}
              value={mod}
              onChange={(e) => schimbaMod(e.target.value)}
            />
          </Field>

          {mod !== 'local' && mod !== 'local-sqlite' && (
            <Field
              label="URL server API"
              hint="Serverul @gr/server (docker-compose / rulare directa) pentru modul retea/cloud."
              className="mt-4"
            >
              <div className="flex gap-2">
                <Input
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder="http://server-local:8787"
                />
                <Button variant="secondary" onClick={salveazaServerUrl}>
                  Salveaza
                </Button>
                <Button
                  variant="secondary"
                  onClick={verificaServer}
                  disabled={stareServer === 'verificare'}
                >
                  <RefreshCw
                    className={`h-4 w-4 ${stareServer === 'verificare' ? 'animate-spin' : ''}`}
                  />
                  Verifica
                </Button>
              </div>
              {stareServer !== 'necunoscuta' && (
                <div className="mt-2 flex items-center gap-2 text-sm">
                  <Badge
                    tone={
                      stareServer === 'ok'
                        ? 'success'
                        : stareServer === 'verificare'
                          ? 'muted'
                          : 'danger'
                    }
                  >
                    {stareServer === 'ok'
                      ? 'Conectat'
                      : stareServer === 'verificare'
                        ? 'Se verifica...'
                        : 'Inaccesibil'}
                  </Badge>
                  <span className="text-fg-muted">{detaliiServer}</span>
                </div>
              )}
            </Field>
          )}

          <div className="mt-5 flex items-center gap-3">
            <Button variant="secondary" onClick={toggle}>
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              Tema: {theme === 'dark' ? 'intunecata' : 'luminoasa'}
            </Button>
            <Button variant="secondary" onClick={() => setLang(lang === 'ro' ? 'en' : 'ro')}>
              <Globe className="h-4 w-4" /> Limba: {lang.toUpperCase()}
            </Button>
          </div>
        </Card>
      </div>

      <Card className="mt-6 p-5">
        <h3 className="mb-4 flex items-center gap-2 font-semibold text-fg">
          <ShieldCheck className="h-5 w-5 text-primary" /> Licenta si module
        </h3>
        <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
          <div>
            <div className="text-fg-muted">Client</div>
            <div className="font-medium text-fg">{ent.client}</div>
          </div>
          <div>
            <div className="text-fg-muted">Editie</div>
            <div className="font-medium text-fg">{EDITIONS[ent.editie].label}</div>
          </div>
          <div>
            <div className="text-fg-muted">Stare</div>
            <Badge tone={ent.licentiat ? 'success' : 'warning'}>
              {ent.licentiat ? 'Licentiat' : 'Nelicentiat (demo)'}
            </Badge>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-1.5 text-sm text-fg-muted">Module active</div>
          <div className="flex flex-wrap gap-2">
            {[...ent.module].map((m) => (
              <Badge key={m} tone="success">
                {ETICHETE_MODULE[m]}
              </Badge>
            ))}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Cheie de licenta" hint="Furnizata de furnizor la achizitie">
            <div className="flex gap-2">
              <Input
                value={cheie}
                onChange={(e) => setCheie(e.target.value)}
                placeholder="xxxxx.yyyyy"
              />
              <Button onClick={activeazaLicenta}>
                <KeyRound className="h-4 w-4" /> Activeaza
              </Button>
            </div>
          </Field>
          {!ent.licentiat && (
            <Field label="Editie (demo, doar nelicentiat)">
              <Select
                options={Object.entries(EDITIONS).map(([id, e]) => ({ value: id, label: e.label }))}
                value={ent.editie}
                onChange={(e) => seteazaEditie(e.target.value as EditionId)}
              />
            </Field>
          )}
        </div>
        {ent.licentiat && (
          <Button variant="secondary" className="mt-4" onClick={reset}>
            Dezactiveaza licenta
          </Button>
        )}
      </Card>

      <Card className="mt-6 p-5">
        <h3 className="mb-4 flex items-center gap-2 font-semibold text-fg">
          <Sparkles className="h-5 w-5 text-primary" /> Asistent AI
        </h3>
        <Field
          label="URL server AI (optional)"
          hint="Gol = asistent offline (reguli). Setat = asistent Claude prin server (cheia API ramane pe server)."
        >
          <div className="flex gap-2">
            <Input
              value={aiUrl}
              onChange={(e) => setAiUrl(e.target.value)}
              placeholder="https://server.exemplu.ro"
            />
            <Button onClick={salveazaAi}>Salveaza</Button>
          </div>
        </Field>
      </Card>

      <Card className="mt-6 p-5">
        <h3 className="mb-4 flex items-center gap-2 font-semibold text-fg">
          <Lock className="h-5 w-5 text-primary" /> Inchidere de perioada
        </h3>
        <p className="mb-4 text-sm text-fg-muted">
          Documentele cu data pana la (inclusiv) data de mai jos nu mai pot fi validate, editate sau
          sterse de <b>niciun rol</b>, inclusiv administrator — controlul se ridica doar de aici.
          Util dupa inchiderea contabila a unei luni/an.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Inchisa pana la">
            <Input
              type="date"
              value={dataInchidere}
              onChange={(e) => setDataInchidere(e.target.value)}
            />
          </Field>
          <Button onClick={inchidePerioada} disabled={!dataInchidere}>
            <Lock className="h-4 w-4" /> Inchide perioada
          </Button>
          {firmaCurenta?.perioadaBlocataPanaLa && (
            <Button variant="secondary" onClick={deschidePerioada}>
              <Unlock className="h-4 w-4" /> Redeschide
            </Button>
          )}
        </div>
        <p className="mt-3 text-sm text-fg-muted">
          Stare curenta:{' '}
          {firmaCurenta?.perioadaBlocataPanaLa ? (
            <Badge tone="warning">inchisa pana la {firmaCurenta.perioadaBlocataPanaLa}</Badge>
          ) : (
            <Badge tone="success">nicio perioada inchisa</Badge>
          )}
        </p>
      </Card>

      <Card className="mt-6 p-5">
        <h3 className="mb-4 flex items-center gap-2 font-semibold text-fg">
          <DatabaseBackup className="h-5 w-5 text-primary" /> Backup si restaurare
        </h3>
        <p className="mb-4 text-sm text-fg-muted">
          {admin
            ? 'Descarca un backup COMPLET al bazei de pe server — nomenclatoare, documente si toate registrele (jurnal contabil, stoc, evenimente fiscale) — verificat prin proba de restaurare, intr-un fisier JSON. Restaurarea inlocuieste atomic baza serverului.'
            : 'Descarca un backup (nomenclatoare, documente, casa si jurnalul de audit) intr-un fisier JSON, sau restaureaza dintr-un backup anterior.'}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={descarcaBackup}>
            <Download className="h-4 w-4" /> Descarca backup
          </Button>
          <Button variant="secondary" onClick={() => fisierRef.current?.click()}>
            <Upload className="h-4 w-4" /> Restaureaza din fisier
          </Button>
          <input
            ref={fisierRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) restaureazaBackup(f);
              e.target.value = '';
            }}
          />
        </div>
      </Card>

      <Card className="mt-6 p-5">
        <h3 className="mb-4 flex items-center gap-2 font-semibold text-fg">
          <Scale className="h-5 w-5 text-primary" /> Legal
        </h3>
        <p className="mb-4 text-sm text-fg-muted">
          Conditiile de utilizare si informarea privind prelucrarea datelor cu caracter personal.
          Aplicatia prelucreaza CNP-uri de angajati si date ale partenerilor, deci aceste informatii
          trebuie sa fie oricand la indemana.
        </p>
        <div className="flex flex-wrap gap-2">
          {DOCUMENTE_LEGALE.map((d) => (
            <Button key={d.id} variant="secondary" onClick={() => setDocLegal(d)}>
              {d.titlu}
            </Button>
          ))}
        </div>
      </Card>

      <Modal
        open={docLegal !== null}
        onClose={() => setDocLegal(null)}
        title={docLegal?.titlu ?? ''}
        wide
        footer={
          <Button variant="secondary" onClick={() => setDocLegal(null)}>
            Inchide
          </Button>
        }
      >
        {docLegal && (
          <div className="space-y-5">
            <p className="text-xs text-fg-muted">
              Ultima actualizare: {docLegal.actualizat} · Sablon care trebuie revizuit juridic
              inainte de prima vanzare.
            </p>
            {docLegal.sectiuni.map((s) => (
              <section key={s.titlu}>
                <h4 className="mb-1.5 font-medium text-fg">{s.titlu}</h4>
                {s.paragrafe.map((p) => (
                  <p key={p.slice(0, 40)} className="mb-2 text-sm leading-relaxed text-fg-muted">
                    {p}
                  </p>
                ))}
              </section>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
