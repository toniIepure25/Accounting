import { Agent } from 'undici';

/**
 * Agent HTTP cu certificat client (mTLS) pentru ANAF. Autentificarea la
 * `logincert.anaf.ro` (OAuth token) cere certificatul digital CALIFICAT cu care
 * firma s-a inrolat in SPV. Acest agent se paseaza ca `dispatcher` la fetch.
 *
 * Nota importanta: emitentul NU semneaza XML-ul e-Facturii — ANAF aplica
 * sigiliul ministerului dupa validare. mTLS + OAuth sunt cerinta reala pentru
 * trimitere; semnarea locala e utila doar pentru arhivare interna (optional).
 */
export interface MtlsOptions {
  /** Certificat + cheie in format PFX/PKCS#12. */
  pfx?: Buffer;
  passphrase?: string;
  /** Sau PEM separat. */
  cert?: string;
  key?: string;
  /** Lant CA (optional). */
  ca?: string;
}

export function agentMTLS(opts: MtlsOptions): Agent {
  return new Agent({
    connect: {
      pfx: opts.pfx,
      passphrase: opts.passphrase,
      cert: opts.cert,
      key: opts.key,
      ca: opts.ca,
    },
  });
}
