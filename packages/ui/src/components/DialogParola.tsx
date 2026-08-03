import { useState } from 'react';
import { schimbaParola } from '../lib/api-cont.js';
import { useAuth } from '../lib/auth-context.js';
import { useToast } from '../lib/toast.js';
import { Field, Modal } from './controls.js';
import { Button, Input } from './ui.js';

const LUNGIME_MINIMA = 8;

/**
 * Schimbarea propriei parole. Serverul REVOCA tokenul curent la succes (o
 * schimbare de parola trebuie sa invalideze sesiunile existente), asa ca
 * dupa confirmare utilizatorul e deconectat explicit si trebuie sa se
 * reautentifice — comportament asteptat, comunicat inainte in dialog.
 */
export function DialogParola({
  open,
  onClose,
  serverUrl,
}: {
  open: boolean;
  onClose: () => void;
  serverUrl: string;
}) {
  const { user, logout } = useAuth();
  const toast = useToast();
  const [veche, setVeche] = useState('');
  const [noua, setNoua] = useState('');
  const [confirmare, setConfirmare] = useState('');
  const [seTrimite, setSeTrimite] = useState(false);

  const inchide = () => {
    setVeche('');
    setNoua('');
    setConfirmare('');
    onClose();
  };

  const trimite = async () => {
    if (noua.length < LUNGIME_MINIMA) {
      return toast.error(`Parola noua trebuie sa aiba cel putin ${LUNGIME_MINIMA} caractere.`);
    }
    if (noua !== confirmare) return toast.error('Confirmarea nu coincide cu parola noua.');
    if (noua === veche) return toast.error('Parola noua trebuie sa fie diferita de cea actuala.');
    if (!user?.token) return;

    setSeTrimite(true);
    const r = await schimbaParola(serverUrl, user.token, veche, noua);
    setSeTrimite(false);
    if (!r.ok) return toast.error(r.eroare);

    toast.success('Parola a fost schimbata. Autentifica-te din nou cu parola noua.');
    inchide();
    logout();
  };

  return (
    <Modal
      open={open}
      onClose={inchide}
      title="Schimba parola"
      footer={
        <>
          <Button variant="secondary" onClick={inchide}>
            Renunta
          </Button>
          <Button onClick={trimite} disabled={seTrimite}>
            {seTrimite ? 'Se schimba...' : 'Schimba parola'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-fg-muted">
          Dupa schimbare vei fi deconectat si va trebui sa te autentifici din nou, cu parola noua.
        </p>
        <Field label="Parola actuala">
          <Input
            type="password"
            value={veche}
            onChange={(e) => setVeche(e.target.value)}
            autoFocus
          />
        </Field>
        <Field label="Parola noua" hint={`Minim ${LUNGIME_MINIMA} caractere.`}>
          <Input type="password" value={noua} onChange={(e) => setNoua(e.target.value)} />
        </Field>
        <Field label="Confirma parola noua">
          <Input
            type="password"
            value={confirmare}
            onChange={(e) => setConfirmare(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && trimite()}
          />
        </Field>
      </div>
    </Modal>
  );
}
