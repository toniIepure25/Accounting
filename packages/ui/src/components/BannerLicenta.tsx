import { AlertTriangle, Clock, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLicense } from '../lib/license-context.js';

/**
 * Banda de stare a licentei, afisata deasupra continutului. Apare DOAR cand
 * exista ceva de comunicat (trial, apropierea expirarii, perioada de gratie,
 * expirare) — o licenta comerciala valabila nu genereaza zgomot vizual.
 *
 * Tonul creste gradual: informativ (trial) -> avertisment (expira curand,
 * gratie) -> blocant (expirata). Fiecare stare spune explicit ce se intampla
 * cu datele, ca sa nu existe teama ca ar putea fi pierdute.
 */
export function BannerLicenta() {
  const { stare, ent } = useLicense();

  if (stare.stare === 'demo' || stare.stare === 'activa') return null;

  const zile = (n: number) => `${n} ${n === 1 ? 'zi' : 'zile'}`;

  const config = {
    trial: {
      Icon: Clock,
      clasa: 'border-primary/30 bg-primary/10 text-primary',
      text:
        stare.stare === 'trial'
          ? `Versiune de evaluare — ${zile(stare.zileRamase)} ramase din perioada de test.`
          : '',
    },
    expira_curand: {
      Icon: AlertTriangle,
      clasa: 'border-warning/30 bg-warning/10 text-warning',
      text:
        stare.stare === 'expira_curand'
          ? `Licenta expira in ${zile(stare.zileRamase)}. Reinnoieste ca sa eviti intreruperea.`
          : '',
    },
    gratie: {
      Icon: AlertTriangle,
      clasa: 'border-warning/30 bg-warning/10 text-warning',
      text:
        stare.stare === 'gratie'
          ? `Licenta a expirat. Aplicatia functioneaza normal inca ${zile(stare.zileRamase)} (perioada de gratie).`
          : '',
    },
    expirata: {
      Icon: Lock,
      clasa: 'border-danger/30 bg-danger/10 text-danger',
      text:
        'Licenta a expirat. Datele raman disponibile pentru consultare si export, ' +
        'dar inregistrarile noi sunt blocate pana la reinnoire.',
    },
  }[stare.stare];

  const { Icon, clasa, text } = config;

  return (
    // <output> e elementul semantic pentru un mesaj de stare live (echivalent
    // cu role="status"), fara sa fie nevoie de rol ARIA explicit.
    <output className={`flex items-center gap-2 border-b px-6 py-2 text-sm ${clasa}`}>
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1">{text}</span>
      <span className="hidden shrink-0 opacity-80 sm:inline">{ent.client}</span>
      <Link to="/setari" className="shrink-0 font-medium underline underline-offset-2">
        Gestioneaza licenta
      </Link>
    </output>
  );
}
