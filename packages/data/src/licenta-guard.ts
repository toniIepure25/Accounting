import type { Repository } from './repository.js';

/**
 * Eroare aruncata cand se incearca o scriere cu licenta expirata. Tip propriu
 * (nu un Error generic) ca UI-ul sa o poata deosebi de o eroare de retea sau
 * de validare si sa afiseze un mesaj comercial, nu unul tehnic.
 */
export class LicentaExpirataError extends Error {
  constructor(
    mesaj = 'Licenta a expirat. Datele raman disponibile pentru consultare si export, ' +
      'dar inregistrarile noi sunt blocate pana la reinnoire.',
  ) {
    super(mesaj);
    this.name = 'LicentaExpirataError';
  }
}

/**
 * Decoreaza un repository cu o garda de licenta: CITIREA ramane mereu permisa,
 * SCRIEREA (create/update/remove) e blocata cat timp `poateScrie()` e false.
 *
 * Asimetria e deliberata si e regula produsului, nu un detaliu de implementare:
 * datele contabile apartin clientului, iar obligatia legala de a le pastra si
 * de a le putea prezenta (control ANAF, arhivare) e a firmei. O licenta
 * neplatita opreste vanzarea de functionalitate noua, nu accesul la propriul
 * istoric — de aceea consultarea, rapoartele si exporturile (backup, PDF, CSV,
 * XML) continua sa functioneze in mod doar-citire.
 *
 * Aplicata central in data-context.tsx, peste toate repository-urile, ca sa nu
 * depinda de disciplina fiecarui ecran in parte de a verifica licenta.
 */
export function withLicentaGuard<T extends { id: string }, TInput>(
  repo: Repository<T, TInput>,
  poateScrie: () => boolean,
): Repository<T, TInput> {
  const verifica = () => {
    if (!poateScrie()) throw new LicentaExpirataError();
  };
  return {
    ...repo,
    async create(input) {
      verifica();
      return repo.create(input);
    },
    async update(id, input) {
      verifica();
      return repo.update(id, input);
    },
    async remove(id) {
      verifica();
      return repo.remove(id);
    },
  };
}
