# Agent Room

Agent Room vendors the pixel-agents office renderer into Multitasker under an isolated app folder.

## Structure

- `core/` is the upstream pixel-agents schema and core message code. Keep it upstream-tracking.
- `webview-ui/` is the upstream React and Vite office renderer. Keep it upstream-tracking except for local packaging cleanup needed for this vendored copy.
- `adapter/` is Multitasker-owned code. Phase 1 contains stubs only; real Hermes event wiring belongs to the later event bridge phase.

## Standalone Preview

Install and run the vendored UI directly:

```bash
cd apps/agent-room/webview-ui
npm install
npm run dev
```

The Vite dev server uses `browserMockTransport` in browser development mode, so it should render the office with mock agents without any Hermes backend.

From `apps/agent-room`, the wrapper scripts are:

```bash
npm run dev
npm run build
npm run typecheck
```
