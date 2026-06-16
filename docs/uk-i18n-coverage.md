# Ukrainian i18n Coverage Audit

This audit tracks what is currently covered by the runtime i18n catalog and
what still needs to be routed through it before the whole Multitasker/Hermes
interface can be considered Ukrainian.

## Current State

- Runtime i18n lives in `agent/i18n.py`. It resolves the active language from
  explicit `lang=`, `HERMES_LANGUAGE`, `display.language` in config, then the
  module default.
- `locales/en.yaml` and `locales/uk.yaml` are the Python runtime catalogs. They
  should stay in strict flattened-key parity.
- The Python catalog is a thin slice of the product surface. It mostly covers
  gateway slash-command replies, restart/stop/status flows, and several safety
  or session-management messages.
- The Electron desktop app has a separate TypeScript catalog under
  `apps/desktop/src/i18n`. Ukrainian is now selectable there, but the new
  `uk.ts` is intentionally partial and falls back to English for desktop-only
  strings that have not been translated yet.

## Covered Today

- `agent/i18n.py`: language resolution, catalog loading, English fallback, and
  formatting via `t(key, **kwargs)`.
- `gateway/slash_commands.py`: many gateway slash-command replies already call
  `t(...)`, including reset/new, profile, kanban, status, agents, stop,
  restart, help, commands, model, personality, retry, goal, undo, set-home,
  voice, rollback, background, reasoning, fast, yolo, verbose, footer,
  compress, topic, title, resume, branch, credits, and usage flows.
- `gateway/run.py`: a small set of gateway runtime replies use `t(...)`,
  including stop/reload-MCP/session-db-unavailable text. The rest of the file
  still contains many direct English replies.
- `apps/desktop/src/i18n`: desktop strings already have a typed catalog
  pattern, but only English, Chinese, Traditional Chinese, and Japanese are
  broadly translated today. Ukrainian currently covers the language picker copy
  and uses English fallback elsewhere.

## Major Hardcoded Surfaces

1. CLI command registry and help text
   - `hermes_cli/commands.py` stores command descriptions, categories, aliases,
     and usage hints as English literals. These feed CLI help, gateway help,
     Telegram bot command descriptions, Slack subcommand routing, autocomplete,
     and desktop slash-command catalogs.
   - `cli.py` renders `/help`, `/tools`, `/toolsets`, tips, warnings, command
     feedback, image-analysis notices, editor errors, worktree messages, and
     status output directly in English.

2. CLI configuration and operational commands
   - `hermes_cli/config.py` has English output in `show_config()`, migration
     notices, deprecated-env warnings, editor prompts, and config display
     labels.
   - Command modules such as `hermes_cli/models.py`,
     `hermes_cli/tools_config.py`, `hermes_cli/skills_config.py`,
     `hermes_cli/mcp_config.py`, `hermes_cli/plugins_cmd.py`,
     `hermes_cli/logs.py`, `hermes_cli/doctor.py`, and related files use
     direct `print`, Rich table/panel labels, and exception strings.

3. Setup and onboarding flows
   - `hermes_cli/setup.py` is one of the largest hardcoded surfaces: provider
     setup, terminal backend setup, messaging platform setup, TTS/STT prompts,
     service installation, migration previews, and final "ready" guidance are
     all English.
   - Related setup helpers such as `hermes_cli/model_setup_flows.py`,
     `hermes_cli/providers.py`, `hermes_cli/memory_setup.py`,
     `hermes_cli/setup_whatsapp_cloud.py`, and platform-specific auth helpers
     should be wrapped after the core setup patterns are established.

4. TUI frontend
   - `ui-tui/src/app/slash/commands/*.ts` contains English command help,
     confirmations, status messages, page titles, and errors.
   - `ui-tui/src/content/hotkeys.ts`, `placeholders.ts`, `setup.ts`,
     `fortunes.ts`, and component files under `ui-tui/src/components` contain
     visible labels, hints, empty states, and overlay copy.
   - The TUI currently has no dedicated i18n layer equivalent to the desktop
     `apps/desktop/src/i18n` catalog.

5. TUI Python gateway
   - `tui_gateway/server.py` and `tui_gateway/entry.py` expose JSON-RPC error
     messages, startup/crash messages, state labels, command output wrappers,
     and session-management messages directly in English.
   - Some of this output is consumed by both the Ink TUI and the Electron
     desktop app, so ownership should be decided before translating.

6. Messaging gateway runtime and platform adapters
   - `gateway/run.py` still has English provider-error rewrites, processing
     failure messages, config bridge warnings, interruption reasons, and
     status/fallback text.
   - `gateway/platforms/*.py` and `gateway/platforms/qqbot/*.py` include
     platform-specific onboarding, auth, delivery, error, and help text that is
     not consistently routed through `gateway/slash_commands.py`.

7. Electron desktop catalog
   - `apps/desktop/src/i18n/en.ts` is the source contract for desktop UI copy.
     Ukrainian needs a real `uk.ts` translation pass for settings, onboarding,
     notifications, model picker, sidebars, composer, approvals, preview,
     artifacts, cron, and error-boundary text.
   - The desktop selector itself is ready for `uk`, but most desktop UI will
     intentionally fall back to English until this catalog is filled in.

## Prioritized Plan

### Phase 0: Guardrails and Inventory

- Add a small catalog-parity check for `locales/en.yaml` and `locales/uk.yaml`
  so missing Python runtime keys fail fast.
- Add a smoke test for `agent.i18n.t(..., lang="uk")` on a representative key.
- Document a convention for new user-facing strings: Python runtime text uses
  `agent.i18n.t`; desktop text uses `apps/desktop/src/i18n`; TUI text gets a
  new TUI catalog rather than borrowing desktop-only keys.
- Keep canonical command names, config keys, and internal state values in
  English. Translate only presentation strings.

### Phase 1: Python CLI and Shared Command Metadata

- Introduce optional translation keys on `CommandDef` for descriptions,
  categories, and usage hints while preserving English literals as fallback.
- Translate command help at presentation time in CLI/gateway/Telegram/Slack
  renderers. Do not mutate command registry data mid-conversation.
- Wrap high-traffic CLI surfaces first: `/help`, `/status`, `/config`,
  `/model`, `/tools`, `/skills`, `/sessions`, `/usage`, `/credits`, and common
  error/warning helpers.
- Add `cli.*`, `commands.*`, and `common.*` catalog sections to
  `locales/en.yaml` and `locales/uk.yaml`.

### Phase 2: TUI Catalog

- Add a typed TUI i18n module under `ui-tui/src/i18n` with English defaults and
  Ukrainian translations.
- Pass the active language to the TUI at startup through the existing gateway
  ready/config path, then keep it stable for the running session unless the TUI
  explicitly reloads display settings.
- Migrate `ui-tui/src/content/*`, slash-command help/results, confirmations,
  overlays, status labels, and component empty/error states to the TUI catalog.
- Add focused tests around locale selection, command help rendering, and key
  confirmation dialogs.

### Phase 3: Setup, Gateway Runtime, and Platform Adapters

- Move setup wizard copy into `setup.*` keys by flow: provider, terminal,
  messaging, voice, service install, and migration.
- Wrap `gateway/run.py` runtime errors and provider-safe replies in
  `gateway.runtime.*` keys.
- Wrap platform adapter copy under `gateway.platforms.<platform>.*`, starting
  with Telegram, Slack, Discord, Matrix, WhatsApp, webhook/API, and SMS because
  those are highest visibility.

### Phase 4: Desktop Ukrainian Completion

- Translate `apps/desktop/src/i18n/en.ts` into a full `uk.ts` instead of the
  current partial locale.
- Keep `defineLocale()` during the transition so missing desktop keys fall back
  to English, then move to a full `Translations` export once coverage is
  complete.
- Run the desktop i18n tests and add one coverage test that asserts `uk` has no
  fallback gaps once the translation is declared complete.

### Phase 5: Quality Gates

- Add a lightweight lint or test that flags new direct user-facing strings in
  selected high-signal files after those files are migrated.
- Use pseudo-locale or marker-based checks for layout-sensitive UI surfaces
  before doing broad Ukrainian copy updates.
- Validate with real CLI, TUI, gateway, and desktop smoke tests using
  `display.language: uk`.
- Keep agent-generated content, logs, raw provider/tool errors, command names,
  config keys, and protocol values out of the translation catalog unless they
  are explicitly rendered as user-facing UI copy.
