// Assemble apps/desktop/src/i18n/uk.ts from _loc/out/<section>.ts fragments.
// Each fragment is a `<section>: { ... }` object-literal slice translated from en.ts.
// Output wraps them in defineLocale({ ... }) so untranslated keys fall back to English.
// Sections are emitted in en.ts source order. Validates brace balance per fragment.
// Usage: node _loc/assemble.mjs

import fs from 'node:fs';

const EN = 'apps/desktop/src/i18n/en.ts';
const OUT = 'apps/desktop/src/i18n/uk.ts';
const DIR = '_loc/out';

const enLines = fs.readFileSync(EN, 'utf8').split('\n');
// section order = order of `  <name>: {` in en.ts
const order = enLines
  .map((l) => l.match(/^  ([a-zA-Z]+): \{/))
  .filter(Boolean)
  .map((m) => m[1]);

function balanced(s) { let d = 0; for (const c of s) { if (c === '{') d++; else if (c === '}') d--; } return d === 0 && s.includes('{'); }

const fragments = [];
const missing = [];
const unbalanced = [];
let usesFieldCopy = false;

for (const name of order) {
  const p = `${DIR}/${name}.ts`;
  if (!fs.existsSync(p)) { missing.push(name); continue; }
  let body = fs.readFileSync(p, 'utf8').trim();
  // Strip accidental markdown fences if any slipped through.
  body = body.replace(/^```[a-z]*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
  // Keep from `name:` onward (drop any preamble the model added).
  const idx = body.indexOf(name + ':');
  if (idx > 0) body = body.slice(idx);
  // Drop a single trailing comma; assembler re-adds separators.
  body = body.replace(/,\s*$/, '');
  if (!balanced(body)) { unbalanced.push(name); }
  if (/\bdefineFieldCopy\s*\(/.test(body)) usesFieldCopy = true;
  fragments.push(body);
}

if (missing.length) console.error('MISSING sections:', missing.join(', '));
if (unbalanced.length) console.error('UNBALANCED sections:', unbalanced.join(', '));

const imports = [`import { defineLocale } from './define-locale'`];
if (usesFieldCopy) imports.unshift(`import { defineFieldCopy } from '@/app/settings/field-copy'`);

const out =
  imports.join('\n') +
  '\n\n' +
  'export const uk = defineLocale({\n' +
  fragments.map((f) => '  ' + f.split('\n').join('\n  ')).join(',\n') +
  '\n})\n';

fs.writeFileSync(OUT, out);
console.log(`Assembled ${fragments.length}/${order.length} sections -> ${OUT} (${out.length}b)` +
  (usesFieldCopy ? ' [+defineFieldCopy import]' : ''));
if (missing.length || unbalanced.length) process.exitCode = 2;
