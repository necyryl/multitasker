# Agent Room — integration spec (pixel-agents → Multitasker)

Source of truth for vendoring `pixel-agents` into Multitasker as `apps/agent-room/`.
Owner-approved direction (see `docs/brain/decisions.md` s4). Goal: keep it **comfortable to work on
later** — clean seam between upstream `core`/`webview-ui` (tracks pixel-agents) and OUR adapter.

## Why
`pixel-agents` (github.com/pixel-agents-hq/pixel-agents) is a flat-grid pixel "office" that visualizes
AI agents. We adopt its renderer instead of the old baked-isometric prototype (`assets/agent-room/`,
now historical). Multitasker = fork of NousResearch/hermes-agent; we surface live hermes agent activity
in this office.

## Source (vendor FROM the s3 working copy — it has fixes, do NOT re-clone)
`C:\Users\Kyrylo\Documents\Codex\2026-06-15\c-users-kyrylo-multitasker-docs-brain\work\pixel-agents`
That copy already has: `webview-ui/src/transport/browserMockTransport.ts`, renderer scene-centering,
showroom mocks in `browserMock.ts`. Bring those.

## Target structure
```
apps/agent-room/
  core/            # vendored pixel-agents/core (asyncapi.yaml + src: message/asset schemas) — UPSTREAM-TRACKING, do not edit
  webview-ui/      # vendored pixel-agents/webview-ui (React+Vite renderer: office/, transport/, components/, hooks/) — UPSTREAM-TRACKING
  adapter/         # OUR code (the seam) — Multitasker-specific, edit freely
    README.md
    multitaskerTransport.ts   # implements the same transport interface as browserMockTransport/WebSocketTransport,
                              # but sourced from hermes events
    eventMap.ts               # maps hermes events (docs/event-bridge-spec.md) -> pixel-agents messages (core schema)
  README.md        # how to run standalone + how it plugs into apps/desktop
  package.json     # workspace pkg: dev (vite standalone), build, typecheck
```

## The seam (most important)
- pixel-agents `webview-ui` already abstracts input behind a **transport** (browser mock vs WebSocket).
  That transport boundary is our integration point — we add a `MultitaskerTransport` next to the others.
- DROP `adapters/vscode/` (VS Code extension host) — not needed. Remove vscode-only deps/scripts.
- The renderer/`core` schemas stay byte-for-byte upstream so we can pull pixel-agents updates later.
- All Multitasker-specific logic lives under `apps/agent-room/adapter/` only.

## Phase 1 acceptance (this task)
1. `apps/agent-room/{core,webview-ui,adapter,README.md,package.json}` exist.
2. `adapters/vscode` NOT copied; vscode-specific deps/scripts removed from the vendored package.json.
3. Standalone dev preview runs: from `apps/agent-room/webview-ui`, `npm install` + `npm run dev` serves the
   office (browser mock transport) — same as it ran in the s3 working copy.
4. `npm run build` (webview-ui) passes; typecheck passes.
5. `adapter/` contains STUBS only (interface + TODOs) — real hermes wiring is Phase 2 (event-bridge).
6. Nothing outside `apps/agent-room/` is modified (greenfield, cannot break core app).

## Phase 2 (later, not now)
Implement `multitaskerTransport.ts` against real hermes events per `docs/event-bridge-spec.md`; map
sessions/agents/sub-agents → office agents; surface the office as a panel in `apps/desktop` (Electron).

## Division of labour
- **Codex:** Phase 1 mechanical vendoring + monorepo wiring + get standalone preview building (this spec).
- **Claude:** adapter/event-bridge design (Phase 2), review, machine-verification, desktop embedding.
