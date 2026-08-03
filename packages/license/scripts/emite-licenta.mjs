#!/usr/bin/env node
// Emite o cheie de licenta semnata cu cheia PRIVATA a furnizorului. Ruleaza
// DOAR pe masina furnizorului (niciodata la client) — vezi genereaza-chei.mjs
// pentru cum se obtine perechea de chei.
//
// Rulare:
//   node packages/license/scripts/emite-licenta.mjs \
//     --client "Mobila SRL" --editie mobila --expira 2027-12-31
//
// Optiuni:
//   --client      <text>             numele clientului (obligatoriu)
//   --editie      <id>               mobila | horeca | florarie | retail | full (obligatoriu)
//   --plan        <id>               esential | profesional | enterprise (optional)
//   --utilizatori <n>                limita de utilizatori activi; are prioritate fata de plan
//   --trial                          marcheaza licenta ca evaluare (UI o semnaleaza distinct)
//   --module      <listă,virgulă>    suprascrie modulele editiei (optional)
//   --expira      <YYYY-MM-DD>       data expirarii (implicit: perpetua)
//   --cheie       <cale>             fisier JSON cu cheia privata (implicit: .chei-furnizor/privata.json)
//
// Exemplu trial de 30 de zile, plan Esential:
//   node packages/license/scripts/emite-licenta.mjs --client "Mobila SRL" \
//     --editie mobila --plan esential --trial --expira 2026-09-01

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dirScript = dirname(fileURLToPath(import.meta.url));

function citesteArgumente(argv) {
  const rezultat = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const cheie = arg.slice(2);
    const urmator = argv[i + 1];
    // Un fanion fara valoare (ex. --trial) nu trebuie sa "inghita" argumentul
    // urmator: daca ce urmeaza e tot o optiune (sau nimic), il tratam ca boolean.
    if (urmator === undefined || urmator.startsWith('--')) {
      rezultat[cheie] = true;
    } else {
      rezultat[cheie] = urmator;
      i++;
    }
  }
  return rezultat;
}

const args = citesteArgumente(process.argv.slice(2));
const EDITII_VALIDE = ['mobila', 'horeca', 'florarie', 'retail', 'full'];
const PLANURI_VALIDE = ['esential', 'profesional', 'enterprise'];

if (!args.client || !args.editie) {
  console.error('Lipsesc argumente obligatorii: --client "<nume>" --editie <id>');
  console.error(`Editii valide: ${EDITII_VALIDE.join(', ')}`);
  process.exit(1);
}
if (!EDITII_VALIDE.includes(args.editie)) {
  console.error(`Editie invalida "${args.editie}". Editii valide: ${EDITII_VALIDE.join(', ')}`);
  process.exit(1);
}
if (args.plan && !PLANURI_VALIDE.includes(args.plan)) {
  console.error(`Plan invalid "${args.plan}". Planuri valide: ${PLANURI_VALIDE.join(', ')}`);
  process.exit(1);
}
if (args.utilizatori !== undefined) {
  const n = Number(args.utilizatori);
  if (!Number.isInteger(n) || n < 1) {
    console.error(
      `--utilizatori trebuie sa fie un numar intreg >= 1 (primit: "${args.utilizatori}")`,
    );
    process.exit(1);
  }
}
if (args.trial && !args.expira) {
  console.error('O licenta de trial trebuie sa aiba si --expira (altfel ar fi un trial perpetuu).');
  process.exit(1);
}

const caleCheie = args.cheie ?? join(dirScript, '..', '.chei-furnizor', 'privata.json');
if (!existsSync(caleCheie)) {
  console.error(
    `Nu gasesc cheia privata la ${caleCheie}.\nRuleaza intai: node packages/license/scripts/genereaza-chei.mjs`,
  );
  process.exit(1);
}
const cheiePrivataJwk = JSON.parse(readFileSync(caleCheie, 'utf8'));

const payload = {
  client: args.client,
  editie: args.editie,
  module: args.module ? args.module.split(',').map((m) => m.trim()) : undefined,
  emisLa: new Date().toISOString(),
  expira: args.expira ? new Date(args.expira).toISOString() : null,
  plan: args.plan ?? undefined,
  utilizatoriMax: args.utilizatori !== undefined ? Number(args.utilizatori) : undefined,
  trial: args.trial ? true : undefined,
};

const enc = new TextEncoder();
function base64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const cheie = await crypto.subtle.importKey(
  'jwk',
  cheiePrivataJwk,
  { name: 'ECDSA', namedCurve: 'P-256' },
  false,
  ['sign'],
);
const body = base64url(enc.encode(JSON.stringify(payload)));
const semnatura = await crypto.subtle.sign(
  { name: 'ECDSA', hash: 'SHA-256' },
  cheie,
  enc.encode(body),
);
const cheieLicenta = `${body}.${base64url(new Uint8Array(semnatura))}`;

const UTILIZATORI_PLAN = { esential: 3, profesional: 10, enterprise: null };
const limita = payload.utilizatoriMax ?? (payload.plan ? UTILIZATORI_PLAN[payload.plan] : null);

console.log('\nLicenta emisa pentru:', payload.client, `(${payload.editie})`);
console.log('Plan:', payload.plan ?? 'fara plan (nelimitat)');
console.log('Utilizatori:', limita === null ? 'nelimitat' : limita);
console.log('Tip:', payload.trial ? 'TRIAL (evaluare)' : 'comerciala');
console.log('Expira:', payload.expira ?? 'niciodata');
console.log('\nCheie de licenta (trimite-o clientului):\n');
console.log(cheieLicenta);
