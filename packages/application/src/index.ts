/**
 * @gr/application — stratul de COMENZI autoritare. Orchestreaza agregatul de
 * document (pur, din @gr/core-domain) peste persistenta tranzactionala (din
 * @gr/data). UI-ul si serverul trimit comenzi; comenzile detin tranzitiile de
 * stare, validarea invariantelor, recalculul server-side si scrierea atomica.
 */

export * from './types.js';
export * from './load.js';
export * from './locking.js';
export * from './idempotency.js';
export * from './tax-snapshot.js';
export * from './stock.js';
export * from './accounting.js';
export * from './fiscal.js';
export * from './efactura.js';
export * from './saft.js';
export * from './post-document.js';
export * from './lifecycle.js';
export * from './guards.js';
