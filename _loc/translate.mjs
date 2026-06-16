// Localization helper: translate one top-level section of en.ts to Ukrainian via Qwen (ollama).
// Usage: node _loc/translate.mjs <sectionName>
// Reads apps/desktop/src/i18n/en.ts, extracts the named section's object literal by brace matching,
// asks Qwen to translate string VALUES to Ukrainian while preserving keys/structure/placeholders/functions,
// prints the resulting TS object literal to stdout.

import fs from 'node:fs';

const section = process.argv[2];
const backend = process.argv[3] || 'qwen'; // qwen | gemma | mistral
if (!section) { console.error('usage: node _loc/translate.mjs <section> [qwen|gemma|mistral]'); process.exit(1); }
const OLLAMA_MODEL = backend === 'gemma' ? 'gemma3:27b' : 'qwen3-coder:30b';

const src = fs.readFileSync('apps/desktop/src/i18n/en.ts', 'utf8');
const lines = src.split('\n');

// find `  <section>: {` and its matching closing `  },` (2-space indent block)
const startIdx = lines.findIndex(l => new RegExp('^  ' + section + ': \\{').test(l));
if (startIdx < 0) { console.error('section not found:', section); process.exit(1); }
let depth = 0, endIdx = -1;
for (let i = startIdx; i < lines.length; i++) {
  for (const ch of lines[i]) { if (ch === '{') depth++; else if (ch === '}') depth--; }
  if (depth === 0) { endIdx = i; break; }
}
const block = lines.slice(startIdx, endIdx + 1).join('\n');

const GLOSSARY = `Glossary (use consistently):
Apply=Застосувати; Save=Зберегти; Saving=Збереження; Cancel=Скасувати; Delete=Видалити; Close=Закрити;
Settings=Налаштування; Search=Пошук; Loading=Завантаження; Error=Помилка; Failed=Не вдалося; Done=Готово;
Connect=Підключити; Copy=Копіювати; Confirm=Підтвердити; Continue=Продовжити; Back=Назад; Edit=Редагувати;
Agent=Агент; Skill=Навичка; Model=Модель; Prompt=Промпт; Message=Повідомлення; Profile=Профіль; Update=Оновлення.`;

const prompt = `You are a professional UI localizer translating an app from English to Ukrainian (uk).
Translate ONLY the natural-language STRING VALUES in this TypeScript object literal to Ukrainian.

STRICT RULES:
- Keep every key name EXACTLY as-is (do NOT translate keys/identifiers).
- Preserve the exact structure, nesting, commas, quotes, and TypeScript syntax.
- Preserve ALL placeholders verbatim: \${...}, {0}, %s, <b>...</b>, \\n, etc.
- For function values like \`(n) => \\\`...\\\`\`, keep the function signature and code; translate only the human-readable text inside.
- Keep proper nouns / brand names (Hermes, Claude, GitHub, MCP, etc.) untranslated.
- Use natural, concise Ukrainian UI wording. Use the formal/neutral register.
- Output ONLY the TypeScript object literal starting with \`${section}: {\` and ending with \`}\`. No markdown fences, no commentary.

${GLOSSARY}

Translate this section:
${block}`;

// Stream the response: with stream:false ollama withholds HTTP headers until the
// FULL generation finishes, which trips undici's 5-min headersTimeout on a big
// cold-loaded model. Streaming delivers headers immediately and we accumulate chunks.
const res = await fetch('http://127.0.0.1:11434/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: OLLAMA_MODEL,
    stream: true,
    keep_alive: '30m',
    options: { temperature: 0.2, num_ctx: 16384 },
    messages: [{ role: 'user', content: prompt }]
  })
});
if (!res.ok || !res.body) { console.error('ollama HTTP', res.status); process.exit(1); }
let out = '';
let buf = '';
const decoder = new TextDecoder();
for await (const chunk of res.body) {
  buf += decoder.decode(chunk, { stream: true });
  let nl;
  while ((nl = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    try { const o = JSON.parse(line); if (o.message && o.message.content) out += o.message.content; } catch {}
  }
}
// strip accidental markdown fences
out = out.replace(/^```[a-z]*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
process.stdout.write(out + '\n');
