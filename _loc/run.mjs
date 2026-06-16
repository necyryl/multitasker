// Full UK localization run: translate every top-level section of en.ts to Ukrainian.
// Splits sections across two backends so BOTH work: Mistral (API, parallel) + Qwen (ollama, local).
// Writes each section to _loc/out/<section>.ts and logs progress. Does NOT assemble uk.ts (separate step).

import fs from 'node:fs';

const MK = (fs.readFileSync('../multitasker-env.safe', 'utf8').match(/^MISTRAL_API_KEY=(.*)$/m)?.[1] || '').trim().replace(/^['"]|['"]$/g, '');

const src = fs.readFileSync('apps/desktop/src/i18n/en.ts', 'utf8');
const lines = src.split('\n');
fs.mkdirSync('_loc/out', { recursive: true });

function extract(section) {
  const start = lines.findIndex(l => new RegExp('^  ' + section + ': \\{').test(l));
  if (start < 0) return null;
  let depth = 0, end = -1;
  for (let i = start; i < lines.length; i++) {
    for (const ch of lines[i]) { if (ch === '{') depth++; else if (ch === '}') depth--; }
    if (depth === 0) { end = i; break; }
  }
  return lines.slice(start, end + 1).join('\n');
}

const sections = lines.filter(l => /^  [a-zA-Z]+: \{/.test(l)).map(l => l.match(/^  ([a-zA-Z]+):/)[1]);

const GLOSSARY = `Glossary (use consistently): Apply=Застосувати; Save=Зберегти; Saving=Збереження; Cancel=Скасувати; Delete=Видалити; Remove=Видалити; Close=Закрити; Settings=Налаштування; Search=Пошук; Loading=Завантаження; Error=Помилка; Failed=Не вдалося; Done=Готово; Connect=Підключити; Disconnect=Відключити; Copy=Копіювати; Confirm=Підтвердити; Continue=Продовжити; Back=Назад; Edit=Редагувати; Agent=Агент; Skill=Навичка; Model=Модель; Prompt=Промпт; Message=Повідомлення; Profile=Профіль; Update=Оновлення; Enable=Увімкнути; Disable=Вимкнути; Run=Запустити; Send=Надіслати.`;

function buildPrompt(section, block) {
  return `You are a professional UI localizer translating an app from English to Ukrainian (uk).
Translate ONLY the natural-language STRING VALUES in this TypeScript object literal to Ukrainian.
STRICT RULES:
- Keep every key name EXACTLY as-is (do NOT translate keys/identifiers).
- Preserve exact structure, nesting, commas, quotes, backticks and TypeScript syntax.
- Preserve ALL placeholders verbatim: \${...}, {0}, %s, <b>...</b>, \\n, html tags, etc.
- For function values like \`(n) => \\\`...\\\`\`, keep the signature and code; translate only human-readable text inside.
- Keep brand/proper nouns untranslated (Hermes, Claude, GitHub, MCP, OpenAI, etc.).
- Natural, concise Ukrainian UI wording, neutral/formal register.
- Output ONLY the TypeScript object literal starting with \`${section}: {\` and ending with the matching \`}\`. No markdown fences, no commentary.
${GLOSSARY}
Translate this section:
${block}`;
}

function clean(out, section) {
  out = out.replace(/^```[a-z]*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
  // keep from `section: {` onward if model added preamble
  const idx = out.indexOf(section + ':');
  if (idx > 0) out = out.slice(idx);
  return out;
}
function balanced(s) { let d = 0; for (const c of s) { if (c === '{') d++; else if (c === '}') d--; } return d === 0 && s.includes('{'); }

async function callMistral(prompt) {
  const r = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST', headers: { 'Authorization': 'Bearer ' + MK, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'mistral-large-latest', temperature: 0.2, messages: [{ role: 'user', content: prompt }] })
  });
  const j = await r.json();
  if (!j.choices) throw new Error('mistral: ' + JSON.stringify(j).slice(0, 160));
  return j.choices[0].message.content;
}
async function callOllama(prompt, model) {
  const r = await fetch('http://127.0.0.1:11434/api/chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, stream: false, options: { temperature: 0.2, num_ctx: 16384 }, messages: [{ role: 'user', content: prompt }] })
  });
  const j = await r.json();
  if (!(j.message && j.message.content)) throw new Error(model + ': ' + JSON.stringify(j).slice(0, 160));
  return j.message.content;
}

async function translate(section, backend) {
  const block = extract(section);
  if (!block) throw new Error('not found: ' + section);
  let raw;
  if (backend === 'mistral') raw = await callMistral(buildPrompt(section, block));
  else if (backend === 'gemma') raw = await callOllama(buildPrompt(section, block), 'gemma3:27b');
  else raw = await callOllama(buildPrompt(section, block), 'qwen3-coder:30b');
  const out = clean(raw, section);
  const ok = balanced(out);
  fs.writeFileSync(`_loc/out/${section}.ts`, out + '\n');
  console.log(`[${backend}] ${section}: ${ok ? 'OK' : 'WARN(unbalanced)'} (${out.length}b)`);
  return ok;
}

// Primary translator = Gemma (gemma3:27b via ollama): better Ukrainian, local, unlimited, no rate limits.
// One retry on failure/unbalanced.
const BACKEND = process.env.LOC_BACKEND || 'gemma';
console.log(`Sections: ${sections.length} | backend: ${BACKEND}`);

async function pool(items, worker, conc) {
  let i = 0; const results = [];
  async function next() { while (i < items.length) { const k = i++; try { results[k] = await worker(items[k]); } catch (e) { console.log('ERR', items[k], String(e.message).slice(0,120)); results[k] = false; } } }
  await Promise.all(Array.from({ length: conc }, next));
  return results;
}

async function withRetry(section) {
  let ok = await translate(section, BACKEND).catch(() => false);
  if (!ok) { console.log(`retry ${section}…`); ok = await translate(section, BACKEND).catch(() => false); }
  return ok;
}

const res = await pool(sections, withRetry, 1);   // ollama: single GPU -> sequential
console.log(`DONE: ${res.filter(Boolean).length}/${sections.length} sections OK`);
