// Structural integrity check for the assembled uk.ts (no tsc needed).
// Verifies backtick parity and ${...} balance — the failure modes brace-check misses.
import fs from 'node:fs';
const s = fs.readFileSync('apps/desktop/src/i18n/uk.ts', 'utf8');

const backticks = (s.match(/`/g) || []).length;
const opens = (s.match(/\$\{/g) || []).length;

// Per-line odd single/double quote counts, ignoring escaped quotes.
let oddSingle = 0, oddDouble = 0;
const bad = [];
const lines = s.split('\n');
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const sq = (line.replace(/\\'/g, '').match(/'/g) || []).length;
  const dq = (line.replace(/\\"/g, '').match(/"/g) || []).length;
  if (sq % 2 !== 0) { oddSingle++; bad.push(`L${i + 1} odd ': ${line.trim().slice(0, 70)}`); }
  if (dq % 2 !== 0) { oddDouble++; }
}

console.log('backticks:', backticks, '(balanced=' + (backticks % 2 === 0) + ')');
console.log('${ template openings:', opens);
console.log('lines with odd single-quote count:', oddSingle);
console.log('lines with odd double-quote count:', oddDouble);
if (bad.length) console.log('first odd-quote lines (may be legit apostrophes inside dq strings):\n  ' + bad.slice(0, 15).join('\n  '));
