#!/usr/bin/env node
// Genereaza O SINGURA DATA (offline, la furnizor) perechea de chei ECDSA
// P-256 folosita pentru licentiere. Cheia PRIVATA se scrie intr-un fisier
// local (NU se distribuie, NU se comite in control de versiuni — vezi
// .gitignore: packages/license/.chei-furnizor/). Cheia PUBLICA se afiseaza
// pentru a fi lipita in packages/ui/src/lib/license-context.tsx
// (VENDOR_CHEIE_PUBLICA) — sigur de distribuit, verifica dar nu poate semna.
//
// Rulare:  node packages/license/scripts/genereaza-chei.mjs

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dirScript = dirname(fileURLToPath(import.meta.url));
const dirChei = join(dirScript, '..', '.chei-furnizor');
const fisierPrivata = join(dirChei, 'privata.json');

if (existsSync(fisierPrivata)) {
  console.error(
    `Exista deja o cheie privata la ${fisierPrivata}.\nSterge fisierul manual daca chiar vrei sa generezi o pereche noua (ATENTIE: orice licenta emisa cu perechea veche devine invalida).`,
  );
  process.exit(1);
}

const perechea = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
  'sign',
  'verify',
]);
const cheiePublica = await crypto.subtle.exportKey('jwk', perechea.publicKey);
const cheiePrivata = await crypto.subtle.exportKey('jwk', perechea.privateKey);

mkdirSync(dirChei, { recursive: true });
writeFileSync(fisierPrivata, `${JSON.stringify(cheiePrivata, null, 2)}\n`, { mode: 0o600 });

console.log(`Cheie PRIVATA scrisa in ${fisierPrivata} (pastreaz-o secreta, NU o distribui).\n`);
console.log(
  'Cheie PUBLICA — lipeste in packages/ui/src/lib/license-context.tsx (VENDOR_CHEIE_PUBLICA):\n',
);
console.log(JSON.stringify(cheiePublica, null, 2));
