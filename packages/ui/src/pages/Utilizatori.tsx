import { ETICHETE_ROL, type Rol, hashParola } from '@gr/auth';
import type { Utilizator } from '@gr/core-domain';
import { KeyRound, ShieldAlert, UserPlus, Users } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { type Column, DataTable } from '../components/DataTable.js';
import { Field, Modal, Select } from '../components/controls.js';
import { Badge, Button, Card, Input, PageHeader } from '../components/ui.js';
import { useCollection } from '../hooks/useCollection.js';
import {
  type StareLicentaServer,
  reseteazaParola,
  serverConfigurat,
  stareLicentaServer,
} from '../lib/api-cont.js';
import { useAuth } from '../lib/auth-context.js';
import { useConfirm } from '../lib/confirm.js';
import { useData } from '../lib/data-context.js';
import { useToast } from '../lib/toast.js';

const ROLURI: Rol[] = ['admin', 'contabil', 'gestionar', 'casier', 'vanzator'];
const OPTIUNI_ROL = ROLURI.map((r) => ({ value: r, label: ETICHETE_ROL[r] }));
const LUNGIME_MINIMA_PAROLA = 8;

/**
 * Administrarea conturilor de utilizator ale clientului. Pana la acest ecran,
 * permisiunea `utilizatori.administrare` exista in matricea de roluri si era
 * impusa de server, dar nu avea NICIO interfata — adica un client care cumpara
 * produsul nu-si putea crea singur colegii, ceea ce facea imposibila o vanzare
 * multi-utilizator fara interventie manuala in baza de date.
 *
 * Regulile de siguranta (cel putin un administrator activ, limita de
 * utilizatori din licenta) sunt impuse AUTORITATIV de server; aici sunt
 * reflectate in UI ca sa dea feedback imediat, nu ca sa inlocuiasca verificarea.
 */
export function UtilizatoriPage() {
  const db = useData();
  const { rows, loading, create, update, remove } = useCollection(db.utilizatori);
  const { user } = useAuth();
  const toast = useToast();
  const confirma = useConfirm();

  const serverUrl = serverConfigurat();
  const [licenta, setLicenta] = useState<StareLicentaServer | null>(null);

  const reincarcaLicenta = useCallback(() => {
    if (!serverUrl || !user?.token) return;
    stareLicentaServer(serverUrl, user.token).then(setLicenta);
  }, [serverUrl, user?.token]);

  useEffect(() => {
    reincarcaLicenta();
  }, [reincarcaLicenta]);

  const [formOpen, setFormOpen] = useState(false);
  const [nume, setNume] = useState('');
  const [rol, setRol] = useState<Rol>('vanzator');
  const [parola, setParola] = useState('');
  const [seSalveaza, setSeSalveaza] = useState(false);

  const [resetPentru, setResetPentru] = useState<Utilizator | null>(null);
  const [parolaReset, setParolaReset] = useState('');

  const activi = rows.filter((u) => u.activ).length;
  const limita = licenta?.utilizatoriMax ?? null;
  const licentaPlina = limita !== null && activi >= limita;

  const deschideForm = () => {
    setNume('');
    setRol('vanzator');
    setParola('');
    setFormOpen(true);
  };

  const salveazaNou = async () => {
    if (!nume.trim()) return toast.error('Numele de utilizator este obligatoriu.');
    if (parola.length < LUNGIME_MINIMA_PAROLA) {
      return toast.error(`Parola trebuie sa aiba cel putin ${LUNGIME_MINIMA_PAROLA} caractere.`);
    }
    if (rows.some((u) => u.nume.toLowerCase() === nume.trim().toLowerCase())) {
      return toast.error('Exista deja un utilizator cu acest nume.');
    }
    setSeSalveaza(true);
    try {
      // Parola se hash-uieste in client, ca sa nu circule niciodata in clar
      // catre server — acelasi PBKDF2 (@gr/auth) folosit si la verificare.
      await create({
        nume: nume.trim(),
        parolaHash: await hashParola(parola),
        rol,
        firmaId: user?.firmaId ?? null,
        activ: true,
      });
      toast.success(`Utilizatorul "${nume.trim()}" a fost creat.`);
      setFormOpen(false);
      reincarcaLicenta();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Eroare la crearea utilizatorului.');
    } finally {
      setSeSalveaza(false);
    }
  };

  const schimbaRol = async (u: Utilizator, nou: Rol) => {
    try {
      await update(u.id, { rol: nou });
      toast.success(`Rolul lui ${u.nume} este acum ${ETICHETE_ROL[nou]}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Eroare la schimbarea rolului.');
    }
  };

  const comutaActiv = async (u: Utilizator) => {
    if (u.activ) {
      const ok = await confirma({
        title: 'Dezactivezi contul?',
        message: `${u.nume} nu se va mai putea autentifica. Istoricul si documentele lui raman neatinse, iar locul din licenta se elibereaza.`,
        confirmLabel: 'Dezactiveaza',
        danger: true,
      });
      if (!ok) return;
    }
    try {
      await update(u.id, { activ: !u.activ });
      toast.success(`Contul lui ${u.nume} a fost ${u.activ ? 'dezactivat' : 'reactivat'}.`);
      reincarcaLicenta();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Eroare la schimbarea starii contului.');
    }
  };

  const sterge = async (u: Utilizator) => {
    const ok = await confirma({
      title: 'Stergi definitiv contul?',
      message: `Contul lui ${u.nume} va fi sters. Daca vrei doar sa-i blochezi accesul pastrand istoricul, foloseste "Dezactiveaza".`,
      confirmLabel: 'Sterge',
      danger: true,
    });
    if (!ok) return;
    try {
      await remove(u.id);
      toast.success(`Contul lui ${u.nume} a fost sters.`);
      reincarcaLicenta();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Eroare la stergerea contului.');
    }
  };

  const trimiteReset = async () => {
    if (!resetPentru || !serverUrl || !user?.token) return;
    if (parolaReset.length < LUNGIME_MINIMA_PAROLA) {
      return toast.error(`Parola trebuie sa aiba cel putin ${LUNGIME_MINIMA_PAROLA} caractere.`);
    }
    const r = await reseteazaParola(serverUrl, user.token, resetPentru.id, parolaReset);
    if (r.ok) {
      toast.success(`Parola lui ${resetPentru.nume} a fost resetata. Comunica-i-o in siguranta.`);
      setResetPentru(null);
      setParolaReset('');
    } else {
      toast.error(r.eroare);
    }
  };

  const columns: Column<Utilizator>[] = [
    {
      key: 'nume',
      header: 'Utilizator',
      render: (u) => (
        <span className="font-medium text-fg">
          {u.nume}
          {u.id === user?.nume || u.nume === user?.nume ? (
            <span className="ml-2 text-xs text-fg-muted">(tu)</span>
          ) : null}
        </span>
      ),
    },
    {
      key: 'rol',
      header: 'Rol',
      render: (u) => (
        <Select
          className="h-8 w-40 text-xs"
          options={OPTIUNI_ROL}
          value={u.rol}
          aria-label={`Rolul utilizatorului ${u.nume}`}
          onChange={(e) => schimbaRol(u, e.target.value as Rol)}
        />
      ),
    },
    {
      key: 'activ',
      header: 'Stare',
      render: (u) =>
        u.activ ? <Badge tone="success">Activ</Badge> : <Badge tone="muted">Dezactivat</Badge>,
    },
    {
      key: 'id',
      header: 'Actiuni',
      render: (u) => (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => comutaActiv(u)}
            title={u.activ ? 'Dezactiveaza contul' : 'Reactiveaza contul'}
            aria-label={u.activ ? `Dezactiveaza contul ${u.nume}` : `Reactiveaza contul ${u.nume}`}
          >
            {u.activ ? 'Dezactiveaza' : 'Reactiveaza'}
          </Button>
          {serverUrl && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setResetPentru(u);
                setParolaReset('');
              }}
              title="Reseteaza parola"
              aria-label={`Reseteaza parola pentru ${u.nume}`}
            >
              <KeyRound className="h-3.5 w-3.5" /> Parola
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => sterge(u)}
            title="Sterge contul"
            aria-label={`Sterge contul ${u.nume}`}
          >
            Sterge
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Utilizatori"
        subtitle="Conturile care pot accesa aplicatia si drepturile fiecaruia"
        actions={
          <Button onClick={deschideForm} disabled={licentaPlina}>
            <UserPlus className="h-4 w-4" /> Utilizator nou
          </Button>
        }
      />

      <Card className="mb-5 flex flex-wrap items-center gap-x-8 gap-y-3 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-fg-muted">Utilizatori activi</p>
            <p className="font-semibold text-fg">
              {activi}
              {limita !== null ? ` din ${limita}` : ''}
            </p>
          </div>
        </div>
        {limita !== null && (
          <p className="text-sm text-fg-muted">
            Locurile ocupate sunt cele ale conturilor <strong>active</strong>. Un cont dezactivat
            elibereaza locul, dar isi pastreaza istoricul.
          </p>
        )}
        {!serverUrl && (
          <p className="flex items-center gap-2 text-sm text-warning">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            Mod local (demo): conturile nu sunt folosite la autentificare si nu exista parole.
            Configureaza un server in Setari pentru autentificare reala.
          </p>
        )}
      </Card>

      {licentaPlina && (
        <Card className="mb-5 border-warning/40 bg-warning/5 p-4 text-sm text-warning">
          Ai atins limita de {limita} utilizatori activi din licenta. Dezactiveaza un cont existent
          sau treci la un plan superior pentru a adauga altul.
        </Card>
      )}

      <Card className="p-1">
        <DataTable rows={rows} columns={columns} loading={loading} getRowKey={(u) => u.id} />
      </Card>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Utilizator nou"
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              Renunta
            </Button>
            <Button onClick={salveazaNou} disabled={seSalveaza}>
              {seSalveaza ? 'Se creeaza...' : 'Creeaza contul'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Nume utilizator" hint="Numele cu care se autentifica (ex. ion.popescu)">
            <Input value={nume} onChange={(e) => setNume(e.target.value)} autoFocus />
          </Field>
          <Field label="Rol" hint="Determina ce ecrane si actiuni are permise">
            <Select
              options={OPTIUNI_ROL}
              value={rol}
              onChange={(e) => setRol(e.target.value as Rol)}
            />
          </Field>
          <Field
            label="Parola initiala"
            hint={`Minim ${LUNGIME_MINIMA_PAROLA} caractere. Utilizatorul si-o poate schimba dupa prima autentificare.`}
          >
            <Input
              type="password"
              value={parola}
              onChange={(e) => setParola(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && salveazaNou()}
            />
          </Field>
        </div>
      </Modal>

      <Modal
        open={resetPentru !== null}
        onClose={() => setResetPentru(null)}
        title={`Reseteaza parola — ${resetPentru?.nume ?? ''}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setResetPentru(null)}>
              Renunta
            </Button>
            <Button onClick={trimiteReset}>Reseteaza</Button>
          </>
        }
      >
        <Field
          label="Parola noua"
          hint={`Minim ${LUNGIME_MINIMA_PAROLA} caractere. Comunic-o utilizatorului printr-un canal sigur — nu prin e-mail nesecurizat.`}
        >
          <Input
            type="password"
            value={parolaReset}
            onChange={(e) => setParolaReset(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && trimiteReset()}
            autoFocus
          />
        </Field>
      </Modal>
    </div>
  );
}
