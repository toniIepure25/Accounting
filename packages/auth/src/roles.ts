/**
 * Roluri și permisiuni (RBAC). Un rol deblochează un set de permisiuni;
 * UI-ul și serverul verifică `arePermisiune` înainte de acțiuni sensibile.
 */
export type Rol = 'admin' | 'contabil' | 'casier' | 'gestionar' | 'vanzator';

export type Permisiune =
  | 'nomenclatoare.editare'
  | 'documente.creare'
  | 'documente.validare'
  | 'casa.operare'
  | 'contabilitate.vizualizare'
  | 'fiscal.trimitere'
  | 'rapoarte.vizualizare'
  | 'setari.administrare'
  | 'utilizatori.administrare'
  | 'audit.vizualizare'
  | 'personal.vizualizare';

const TOATE: Permisiune[] = [
  'nomenclatoare.editare',
  'documente.creare',
  'documente.validare',
  'casa.operare',
  'contabilitate.vizualizare',
  'fiscal.trimitere',
  'rapoarte.vizualizare',
  'setari.administrare',
  'utilizatori.administrare',
  'audit.vizualizare',
  'personal.vizualizare',
];

export const PERMISIUNI_ROL: Record<Rol, ReadonlySet<Permisiune>> = {
  admin: new Set(TOATE),
  contabil: new Set([
    'nomenclatoare.editare',
    'documente.creare',
    'documente.validare',
    'contabilitate.vizualizare',
    'fiscal.trimitere',
    'rapoarte.vizualizare',
    'personal.vizualizare',
  ]),
  gestionar: new Set([
    'nomenclatoare.editare',
    'documente.creare',
    'documente.validare',
    'rapoarte.vizualizare',
  ]),
  casier: new Set(['documente.creare', 'casa.operare', 'rapoarte.vizualizare']),
  vanzator: new Set(['documente.creare', 'rapoarte.vizualizare']),
};

export const ETICHETE_ROL: Record<Rol, string> = {
  admin: 'Administrator',
  contabil: 'Contabil',
  gestionar: 'Gestionar',
  casier: 'Casier',
  vanzator: 'Vanzator',
};

export function arePermisiune(rol: Rol, permisiune: Permisiune): boolean {
  return PERMISIUNI_ROL[rol].has(permisiune);
}
