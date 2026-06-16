---
tags: [knowledge, i18n]
---
# Localization (Ukrainian)

[[HOME]] · gap analysis: `../uk-i18n-coverage.md`

UI language = Ukrainian. `locales/uk.yaml` is complete (289/289 keys).

**Activation (important):** changing only the code DEFAULT is NOT enough — a saved config overrides it.
Run `uv run hermes config set display.language uk` → writes `HERMES_HOME\config.yaml`
(`HERMES_HOME = C:\Users\Kyrylo\AppData\Local\hermes`, shared with the AppData install). VERIFIED.

Resolution order: explicit `lang=` → `HERMES_LANGUAGE` env → `display.language` config → code default.
Loader: `agent/i18n.py`. Desktop switcher: `apps/desktop/src/components/language-switcher.tsx` (+ `uk.ts`).

**State:** the 289-key catalog covers only a slice (gateway slash-commands, stop/restart/status). Most
CLI/TUI text is still hardcoded English — full translation is a phased job (plan in the coverage doc). See [[decisions]].
