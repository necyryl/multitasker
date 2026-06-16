---
tags: [knowledge, agent-room, project]
---
# Agent Room

[[HOME]] | detailed spec: `../agent-room-spec.md` | event feed: `../event-bridge-spec.md`

Live pixel dashboard for Multitasker/Hermes activity. The owner pivoted from a local prototype to the
real `pixel-agents-hq/pixel-agents` codebase, so the active implementation is now the vendored app in
`apps/agent-room/`.

## Active Path
- Renderer: `apps/agent-room/webview-ui/`.
- Shared Pixel Agents schemas/helpers: `apps/agent-room/core/`.
- Multitasker-specific adapter: `apps/agent-room/adapter/`.
- Desktop entry: `apps/desktop/src/app/agent-room/`.
- Event publisher: `hermes_cli/agent_room_events.py`.

## Historical Path
`assets/agent-room/` was a local prototype with custom generated art. It is excluded from GitHub and
should not be resumed unless the owner explicitly reopens asset generation.

## Current Work
- Phase 1 vendoring is done.
- Phase 2 is in progress: event bridge, transport wiring, and desktop embedding.
- Current status lives in [[state]].
