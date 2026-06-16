# Agent Room spec

Live pixel office for Multitasker agents.

Active direction:
- Vendor and maintain `pixel-agents-hq/pixel-agents` under `apps/agent-room/`.
- Use the shipped Pixel Agents renderer and assets from `apps/agent-room/webview-ui/public/assets/`.
- Wire real Multitasker/Hermes events into the renderer through the adapter layer.

Not active:
- Do not generate new art for this integration.
- Do not use the old local `assets/agent-room/` prototype as the production path.
- Do not add external image-generation API work unless the owner explicitly reopens asset generation.

Architecture:
- `apps/agent-room/core/` stays close to upstream Pixel Agents.
- `apps/agent-room/webview-ui/` is the vendored React/Vite renderer.
- `apps/agent-room/adapter/` is Multitasker-specific code: event mapping and transport.
- `hermes_cli/agent_room_events.py` publishes normalized runtime events.
- `apps/desktop/src/app/agent-room/` embeds the room in Multitasker.

Next implementation work:
1. Finish `apps/agent-room/adapter/multitaskerTransport.ts`.
2. Finish and validate `hermes_cli/agent_room_events.py`.
3. Typecheck/build `apps/agent-room/webview-ui`.
4. Verify the desktop panel can load the Agent Room without relying on standalone dev mocks.
