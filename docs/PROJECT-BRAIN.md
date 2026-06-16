# Multitasker Project Brain

Active repo: `C:\Users\Kyrylo\multitasker`.

Remote:
- `origin`: `https://github.com/necyryl/multitasker.git`
- `upstream`: `https://github.com/NousResearch/hermes-agent`

## Current Mission

Adapt Multitasker for the owner:
- Ukrainian UI localization.
- Pixel Agents based Agent Room.
- Graphify-backed project memory.

## Agent Room

Active path:
- `apps/agent-room/core/`
- `apps/agent-room/webview-ui/`
- `apps/agent-room/adapter/`
- `apps/desktop/src/app/agent-room/`
- `hermes_cli/agent_room_events.py`

The old local prototype under `assets/agent-room/` is historical only and is excluded from GitHub.
No external asset-generation service is part of the current task.

## Next Work

1. Finish `apps/agent-room/adapter/multitaskerTransport.ts`.
2. Validate `apps/agent-room/adapter/eventMap.ts`.
3. Finish `hermes_cli/agent_room_events.py`.
4. Build/typecheck `apps/agent-room/webview-ui`.
5. Continue Ukrainian localization after Agent Room backup is safely pushed.

Detailed volatile status lives in `docs/brain/state.md`.
