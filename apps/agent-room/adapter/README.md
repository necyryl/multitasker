# Agent Room Adapter

`core/` and `webview-ui/` are vendored from pixel-agents and should stay upstream-tracking. This `adapter/` directory is the Multitasker-owned seam.

Phase 1 intentionally does not connect live Hermes events. The stubs here define where Phase 2 should translate `docs/event-bridge-spec.md` events into pixel-agents `ServerMessage` values and expose them through the same `MessageTransport` interface used by `webview-ui/src/transport`.

Expected Phase 2 ownership:

- `eventMap.ts` maps Hermes agent, tool, and subagent events to pixel-agents messages.
- `multitaskerTransport.ts` subscribes to the Multitasker event bridge and emits mapped messages to the renderer.
- The renderer should continue to depend only on the transport interface, not on Hermes internals.
