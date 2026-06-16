# Agent Room (Phase 2) + Ukrainian Localization — Architecture

Reference for the two active workstreams in Multitasker (a fork of
NousResearch/hermes-agent): wiring the vendored **Agent Room** pixel office to
live hermes agent activity, and the **Ukrainian (uk)** localization of the
Electron desktop app. Grounded in the source files listed in the file map at the
end — no invented APIs.

---

## 1. Overview

**Ukrainian localization.** The product is being made fully Ukrainian across two
independent catalogs: a Python *runtime* catalog (`agent/i18n.py` +
`locales/*.yaml`, covering gateway/CLI replies) and an Electron *desktop*
TypeScript catalog (`apps/desktop/src/i18n`). The active uk work landed in the
desktop catalog: a new `uk.ts` is registered in `catalog.ts`, and the picker
already offers Ukrainian. `uk.ts` is intentionally *partial* — it is a deep
override of the canonical English `en` catalog, so any key not yet translated
transparently falls back to English (see §3). The broader plan
(`docs/uk-i18n-coverage.md`) is phased: CLI/command metadata, a new TUI catalog,
setup/gateway/platform copy, then full desktop completion and quality gates.

**Agent Room office.** The `pixel-agents` flat-grid pixel "office" renderer is
vendored under `apps/agent-room/` to *visualize live hermes agent activity* —
the main agent and its subagents appear as characters whose tool calls and status
animate in real time. The integration keeps upstream `core/` and `webview-ui/`
byte-for-byte so updates can be pulled later, and confines all Multitasker
glue to `apps/agent-room/adapter/` plus one Python publisher
(`hermes_cli/agent_room_events.py`). Live data rides the dashboard's existing
WebSocket relay on a dedicated `agent-room` channel; the office is built with a
relative base so the same bundle can be served same-origin from the web server
and embedded in the desktop app via an `<iframe>`.

---

## 2. Agent Room — end-to-end architecture

### 2.1 Data flow (hermes → pixel office)

```
 hermes agent (main + subagents)
   │  tool_progress_callback("tool.started" / "tool.completed" / "subagent.*", ...)
   ▼
 tui_gateway  _emit()
   │  JSON-RPC notification: {"method":"event","params":{event, sid, payload}}
   ▼
 PTY child  ──(HERMES_TUI_SIDECAR_URL)──►  /api/pub?channel=<chat-id>   (WebSocket publisher)
   ▼
 web_server.py  pub_ws() relay loop
   │  await _broadcast_event(app, <chat-id>, raw)   ← primary chat relay (source of truth)
   │
   └─[NEW]─► _relay_agent_room(app, raw)            ← parallel, best-effort
                │  parse JSON-RPC "event" frame → params
                │  bridge = _get_agent_room_bridge(app)   (one per process, on app.state)
                │  events = bridge.ingest(params)          (AgentRoomBridge / translate_event)
                ▼
            _broadcast_event(app, "agent-room", json.dumps(ev))   ← channel "agent-room"
                ▼
        /api/events?channel=agent-room   (WebSocket subscribers)
                ▼
   webview-ui  MultitaskerTransport
                │  parse NDJSON frame → BridgeEvent
                │  AgentRoomEventMapper.map(ev) → ServerMessage[]
                ▼
            pixel-agents office renderer  (agentCreated / agentToolStart / ...)
```

Two NDJSON-over-WebSocket frame vocabularies are in play: the **gateway event**
frame (`{"method":"event","params":{event,sid,payload}}`) on the chat channel,
and the normalized **BridgeEvent** frame (`{"kind":...}`) on the `agent-room`
channel. The Python side translates the former into the latter; the JS mapper
translates BridgeEvent into the renderer's `ServerMessage` vocabulary.

### 2.2 The seam — why a normalized `BridgeEvent` contract

`BridgeEvent` (defined in `apps/agent-room/adapter/eventMap.ts`) is a small
normalized union that sits between hermes and the office. It exists because the
two sides identify agents differently:

- **hermes** identifies agents by *string* ids (`session_id` / `subagent_id`).
- **the office** renderer needs *stable numeric* ids.

Rather than have Python invent and track numeric ids, the contract passes the
string id straight through as `sessionId`, and **id assignment lives in the JS
mapper** (`AgentRoomEventMapper`). The mapper holds the `sessionId → numeric id`
registry (`idFor`), the known-agent set, and per-agent metadata, so it can emit
`existingAgents` / `agentCreated` / `agentClosed` correctly across a live stream.
This keeps the publisher stateless about numbering and gives two clean decoupling
benefits: the Python side can change without touching the renderer, and the
mapper is unit-testable with no hermes runtime (`eventMap.test.ts`). The Python
`AgentRoomBridge` is stateful *only* to (a) emit `agentAdded` the first time a
`sid` is seen and (b) suppress duplicates — it holds **no** numeric ids.

### 2.3 Key design decision — tap the existing stream, don't wrap the callback

The original event-bridge research (`docs/event-bridge-spec.md` §4.1) proposed
*wrapping* `tool_progress_callback` directly on the agent. The shipped design
deliberately does **not** do that. Instead the publisher taps the **already
flowing** `tui_gateway` event stream at the web server's async relay layer
(`pub_ws` → `_relay_agent_room`). Rationale:

- **Thread safety.** Subagents run in worker threads, not on the asyncio loop
  (`docs/event-bridge-spec.md` §6.2). Wrapping the per-agent callback would force
  cross-thread marshaling into the event loop. The relay layer is *already* on
  the loop, so translation and `_broadcast_event` happen where they are safe.
- **Reuse.** The same gateway events already flow to the dashboard chat sidebar
  via `/api/pub` → `/api/events`. The office is simply a second subscriber on a
  parallel channel — no new agent instrumentation, no new process, no duplicated
  auth/CORS/bind (the web server already owns all of that).
- **Isolation.** `_relay_agent_room` is best-effort and fully guarded: every
  failure path returns quietly, and it short-circuits when there are no
  `agent-room` subscribers (office closed). It can never disturb the primary chat
  relay, which remains the source of truth. `pub_ws` also skips relaying frames
  that arrive *on* the `agent-room` channel to avoid loops.

### 2.4 Channel system recap (`/api/pub`, `/api/events`, `_broadcast_event`)

The dashboard already runs a publisher→channel→subscriber fan-out:

- **`pub_ws` (`/api/pub`)** — a publisher WebSocket. The PTY child connects here
  (URL injected via `HERMES_TUI_SIDECAR_URL`) and pipes the `tui_gateway` event
  frames. Its loop calls `_broadcast_event(app, channel, raw)` per frame.
- **`events_ws` (`/api/events`)** — subscriber WebSockets, keyed by `?channel=`.
- **`_broadcast_event(app, channel, payload)`** — snapshots the current
  subscriber set for `channel` under an `asyncio.Lock` and `send_text`s the
  payload to each; dead subscribers are reaped by the `/api/events` finally
  clause.

The Agent Room work adds three helpers on top of this: `_get_agent_room_bridge`
(lazy, process-wide `AgentRoomBridge` on `app.state` so the "announced agents"
set spans every chat publisher and the office shows all live agents at once),
`_relay_agent_room` (the translate-and-fan-out step above), and the one-line tap
inside `pub_ws`.

### 2.5 Asset bootstrap is client-side (no backend)

Sprites, floor/wall tiles, and furniture are **not** delivered by the backend.
`MultitaskerTransport.bootstrapAssets()` calls `initBrowserMock()` then
`dispatchAssetMessages()` (`apps/agent-room/webview-ui/src/browserMock.ts`),
which fetches the vendored asset bundles and decodes the PNGs in-browser (via
`createImageBitmap` + canvas `getImageData`), emitting `characterSpritesLoaded`,
`floorTilesLoaded`, `wallTilesLoaded`, `furnitureAssetsLoaded`, `layoutLoaded`,
and `settingsLoaded`. `dispatchAssetMessages` was deliberately split out from the
showroom/mock-activity dispatch so the live transport can reuse *only* the asset
half and get live agent state from the WebSocket. Net effect: the bridge only
has to carry live agent/tool state; visual assets need no server support.

### 2.6 BridgeEvent kinds and their mappings

`BridgeEvent` union (TS) → `ServerMessage[]` via `AgentRoomEventMapper.map`. The
"Emitted by Python" column shows what `translate_event` /
`AgentRoomBridge.ingest` actually produces today.

| BridgeEvent kind | Source gateway event (Python) | Emitted by Python? | → ServerMessage(s) (JS mapper) |
|---|---|---|---|
| `snapshot` | — (reserved for future REST hydrate) | No | `existingAgents` + `agentTeamInfo` per named agent |
| `agentAdded` | first time a `sid` is seen (`ingest`) | Yes | `agentCreated` (+ `agentTeamInfo` if named) |
| `agentRemoved` | `forget(sid)` on session end | Yes (via `forget`) | `agentClosed` |
| `agentStatus` | — | No | `agentStatus` (`active` / `waiting`) |
| `toolStart` | `tool.start` | Yes | `agentToolStart` (+ `agentToolPermission` if `permission`) |
| `toolDone` | `tool.complete` | Yes | `agentToolDone` |
| `toolsClear` | — | No | `agentToolsClear` |
| `subagentToolStart` | `subagent.start`, `subagent.tool` | Yes | `subagentToolStart` (parentToolId = `sa:<subagent_id>`) |
| `subagentToolDone` | `subagent.complete` | Yes | `subagentToolDone` |
| `subagentClear` | — | No | `subagentClear` |
| `tokenUsage` | `subagent.complete` (when in/out tokens present) | Yes | `agentTokenUsage` |

Notes: subagent work is modeled as tool rows nested under the **parent** agent
(keyed by `parentToolId = "sa:<subagent_id>"`), matching the office data model.
`snapshot`, `agentStatus`, `toolsClear`, and `subagentClear` are part of the wire
contract and handled by the mapper, but not yet emitted by the current Python
publisher (live stream uses incremental `agentAdded`).

### 2.7 Transport selection

`apps/agent-room/webview-ui/src/transport/index.ts` is the factory.
`MultitaskerTransport` is **opt-in**: it activates only when
`VITE_AGENT_ROOM_SOURCE === 'multitasker'` **or** the URL carries
`?source=multitasker`. Otherwise the default pixel-agents behavior is preserved
(browser mock in dev, plain `/ws` WebSocket in a standalone build, postMessage in
a non-browser host). This keeps the vendored renderer upstream-compatible while
letting the desktop iframe request the live bridge explicitly.

### 2.8 Desktop embedding plan (in progress)

- The office is built with a **relative base** so its bundle is path-agnostic.
- `web_server.py` serves the built bundle **same-origin** at `/agent-room/`
  (route `serve_agent_room`, bundle at
  `apps/agent-room/dist/webview/index.html`; returns 404 JSON if not built, and
  resolves sub-paths safely under the dist root, else falls back to `index.html`
  for SPA routing).
- The desktop app shows it in an `<iframe>` panel pointed at `/agent-room/?source=multitasker`,
  so the iframe opens the live `MultitaskerTransport` and shares the dashboard
  origin (and thus its WebSocket auth) for `/api/events?channel=agent-room`.
- Live end-to-end verification with a running hermes conversation is the
  remaining open item.

---

## 3. Localization — architecture (desktop TS catalog)

### 3.1 Two catalogs

| Catalog | Location | Scope |
|---|---|---|
| Python runtime | `agent/i18n.py` + `locales/en.yaml`, `locales/uk.yaml` | gateway slash-command replies, restart/stop/status, safety/session messages |
| Electron desktop | `apps/desktop/src/i18n/*.ts` | desktop UI: settings, onboarding, notifications, model picker, sidebars, composer, approvals, etc. |

The two are independent (no shared keys). This document scopes to the desktop TS
catalog, where the active uk work landed.

### 3.2 `defineLocale()` deep-merge with English fallback

`apps/desktop/src/i18n/define-locale.ts` exports `defineLocale(overrides)`, which
deep-merges a *partial* override object onto the canonical `en` catalog:

- `mergeTranslations(base, overrides)` recurses object-by-object. For each key,
  if both base and override are plain records it recurses; otherwise the override
  value wins. `undefined` override values are skipped (treated as "not
  translated").
- The result is typed as the full `Translations`, so **any key absent from the
  override falls back to the English string**. This is exactly why `uk.ts` can be
  shipped partial: `export const uk = defineLocale({ common: { … }, … })`.
- The override type `TranslationOverrides` makes every leaf optional while
  preserving function-valued and array-valued leaves intact (those must be
  replaced wholesale, not partially merged).

`uk` is then registered in `apps/desktop/src/i18n/catalog.ts`'s `TRANSLATIONS`
record alongside `en`, `zh`, `zh-hant`, `ja`.

### 3.3 Translation pipeline (`_loc/`)

The uk strings were produced by a local LLM pipeline, not by hand:

```
en.ts  ──►  _loc/run.mjs  (orchestrates all 30 sections)
                 │  per section:
                 ▼
            _loc/translate.mjs <section> [qwen|gemma|mistral]
                 │  extract `  <section>: { … }` from en.ts by brace matching
                 │  prompt local model via ollama  (run used gemma → gemma3:27b)
                 ▼
            _loc/out/<section>.ts        (one translated object-literal fragment)
                 │
                 ▼
            _loc/assemble.mjs  (wraps all 30 fragments in en.ts source order,
                 │              validates per-fragment brace balance)
                 ▼
   apps/desktop/src/i18n/uk.ts  →  registered in catalog.ts
```

Notes: `translate.mjs` defaults its backend arg to `qwen` (qwen3-coder:30b), but
the production run used the **gemma** backend (`gemma3:27b` via ollama), per
`_loc/run.log` ("backend: gemma", 30 sections). `assemble.mjs` reports any
missing or brace-unbalanced sections, which drove the targeted re-translation of
sections that failed `tsc`.

---

## 4. File map

| File | Purpose | Owner tag |
|---|---|---|
| `docs/agent-room-integration.md` | Vendoring spec; defines the upstream/adapter "seam" and phase plan | Claude |
| `docs/event-bridge-spec.md` | Event-source research, channel relay rationale, thread-safety notes | Claude |
| `docs/uk-i18n-coverage.md` | Localization inventory + phased plan | Claude |
| `apps/agent-room/core/` | Vendored pixel-agents schemas (`messages.ts`, asset types/constants) | UPSTREAM-tracking |
| `apps/agent-room/webview-ui/` | Vendored React+Vite office renderer | UPSTREAM-tracking |
| `apps/agent-room/adapter/eventMap.ts` | `BridgeEvent` union + `AgentRoomEventMapper` (string→numeric id, BridgeEvent→ServerMessage) | Claude |
| `apps/agent-room/webview-ui/src/transport/multitaskerTransport.ts` | Live transport: WS to `agent-room` channel + mapper + asset bootstrap + reconnect | Claude |
| `apps/agent-room/webview-ui/src/transport/index.ts` | Transport factory; `?source=multitasker` / `VITE_AGENT_ROOM_SOURCE` opt-in | Claude |
| `apps/agent-room/webview-ui/src/browserMock.ts` | Client-side PNG asset decode; `dispatchAssetMessages` split from mock activity | Codex / UPSTREAM-tracking |
| `hermes_cli/agent_room_events.py` | Python publisher: `translate_event`, `_translate_subagent`, `AgentRoomBridge`, `CHANNEL` | Claude |
| `hermes_cli/web_server.py` (`_get_agent_room_bridge`, `_relay_agent_room`, `pub_ws` tap, `serve_agent_room`) | Channel relay tap + same-origin `/agent-room/` bundle serving | Codex / Claude |
| `apps/desktop/src/i18n/define-locale.ts` | `defineLocale` deep-merge with English fallback | Claude |
| `apps/desktop/src/i18n/catalog.ts` | `TRANSLATIONS` registry; registers `uk` | Claude |
| `apps/desktop/src/i18n/en.ts` | Canonical English catalog (source of all keys/types) | UPSTREAM-tracking |
| `apps/desktop/src/i18n/uk.ts` | Partial Ukrainian override (assembled, 30 sections) | Gemma (generated) |
| `_loc/run.mjs` | Orchestrates the 30-section translation run | Claude |
| `_loc/translate.mjs` | Per-section translate via ollama (gemma3:27b / qwen) | Claude |
| `_loc/assemble.mjs` | Wraps `_loc/out/*.ts` fragments into `uk.ts`, validates braces | Claude |
| `agent/i18n.py` + `locales/{en,uk}.yaml` | Python runtime catalog (out of scope here; parallel track) | UPSTREAM-tracking / Claude |
