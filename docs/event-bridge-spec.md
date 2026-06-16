# Event Bridge — Multitasker → Agent Room spec

Connects the Multitasker agent runtime to the Agent Room isometric dashboard
(`docs/agent-room-spec.md`) via a live event stream. This is a research +
design document — no code changes.

## 1. Map of event sources (what emits, where, and when)

### 1.1 Tool-call lifecycle

The primary event source is `tool_progress_callback`, a callable installed on
`AIAgent` and invoked throughout the conversation loop. It receives an
`event_type` string and keyword payload.

| Event type | File:line | Emitter function | Meaning |
|---|---|---|---|
| `tool.started` | `agent/tool_executor.py:437` | `execute_tool_calls_concurrent` | Tool execution begins; carries `name`, `preview`, `args` |
| `tool.completed` | `agent/tool_executor.py:689` | `execute_tool_calls_concurrent` | Tool finished; carries `name`, `duration`, `is_error`, `result` |
| `tool.started` | `agent/tool_executor.py:895` | `execute_tool_calls_sequential` | Same as above, sequential path |
| `tool.completed` | `agent/tool_executor.py:1339` | `execute_tool_calls_sequential` | Same as above, sequential path |
| `_thinking` | `agent/conversation_loop.py:3573` | `run_conversation` | AI is producing reasoning tokens |
| `reasoning.available` | `agent/conversation_loop.py:3578` | `run_conversation` | Reasoning text finalized (first 500 chars) |

### 1.2 Subagent lifecycle

Subagent events are emitted via the same `tool_progress_callback` channel but
with `subagent.*` prefixes. The emitter is inside `_run_single_child`
(`tools/delegate_tool.py:1412`).

| Event type | Emitter file:line | Key fields |
|---|---|---|
| `subagent.start` | `tools/delegate_tool.py:1563` | `goal` (string preview) |
| `subagent.progress` | `tools/delegate_tool.py:1942` (approx.) | `subagent_id`, `api_calls`, `tool_count` |
| `subagent.tool` | `tools/delegate_tool.py` (via child's own callback relay) | `subagent_id`, `tool_name`, `preview` |
| `subagent.thinking` | relayed from child | `subagent_id`, `preview` |
| `subagent.complete` | `tools/delegate_tool.py:1948` (finally block) | `subagent_id`, `summary`, `duration_seconds`, `input_tokens`, `output_tokens`, `cost_usd`, `files_read`, `files_written`, `output_tail` |

The identity fields threading through every subagent event:
- `subagent_id` — unique per child, format `sa-{task_index}-{uuid8}` (line 981)
- `parent_id` — the parent's `_subagent_id` if this child is a grandchild (line 982)
- `depth` — delegation depth (0 = direct child of main agent)
- `model` — the model the subagent is using

### 1.3 Subagent registry (for discovering topology mid-flight)

Module-level state in `tools/delegate_tool.py:154-157`:

```python
_active_subagents: Dict[str, Dict[str, Any]] = {}
# Each record: {subagent_id, parent_id, depth, goal, model, started_at, tool_count, status, agent}
```

`list_active_subagents()` (line 213) returns a snapshot of all currently
running subagents. `_register_subagent()` (line 177) adds entries on spawn;
`_unregister_subagent()` (line 185) removes them on completion.

### 1.4 Plugin hook system

`hermes_cli/plugins.py` defines `VALID_HOOKS` (line 128) — an observer-only
extension point. Relevant hooks for the Agent Room:

| Hook | Invoked from | Data available |
|---|---|---|
| `pre_tool_call` | `model_tools.py:857` | `tool_name`, `args`, `task_id`, `session_id`, `tool_call_id` |
| `post_tool_call` | `model_tools.py:856` | same + `result`, `duration_ms`, `status`, `error_type` |
| `on_session_start` | `run_agent.py` (per session lifecycle) | `session_id`, `platform` |
| `on_session_end` | `run_agent.py` | `session_id`, `platform` |
| `subagent_start` | (declared in VALID_HOOKS but search finds no invoker in current code — uncertain) | — |
| `subagent_stop` | (declared but no invoker found — uncertain) | — |
| `pre_llm_call` | `run_agent.py` before each API call | `session_id`, `user_message`, `messages` |
| `post_llm_call` | `run_agent.py` after each API call | `session_id`, `response` |

**IMPORTANT — UNCERTAIN:** The `subagent_start` and `subagent_stop` hooks are
declared in `VALID_HOOKS` (line 147-148) but a grep for `invoke_hook` with those
hook names did not find invokers in the current codebase. They may be
intention-only (reserved/planned). The `subagent.*` `tool_progress_callback`
events (section 1.2) are the **actually working** mechanism today.

## 2. Existing event transport infrastructure

### 2.1 The `/api/pub` + `/api/events` WebSocket relay (chat tab sidebar)

Already in production for the dashboard Chat tab's React sidebar:

- `hermes_cli/web_server.py:10547` — `/api/pub` (publisher): the PTY child
  connects here and pipes `tui_gateway.entry` dispatcher emits.
- `hermes_cli/web_server.py:10575` — `/api/events` (subscriber): the React
  frontend opens this to receive tool-call events.
- Both are keyed on a channel ID generated at page mount.
- `_broadcast_event()` (line 10331) fans frames from one publisher to N
  subscribers.

**Exactly how it works:**
1. Browser opens `/api/pty?channel=<id>` (WebSocket) to launch the TUI.
2. The server spawns `hermes --tui` with `HERMES_TUI_SIDECAR_URL` pointing at
   `/api/pub?channel=<id>`, so `tui_gateway.entry` mirrors dispatcher emits.
3. Browser opens `/api/events?channel=<id>` to subscribe to those events.
4. Events flow as newline-delimited JSON frames: publisher → server → fan out.

### 2.2 The `/api/ws` JSON-RPC WebSocket

`hermes_cli/web_server.py:10516` — a separate WebSocket sidecar that drives the
full `tui_gateway` dispatch surface. Used by the embedded TUI for
`gateway.ready`, `tool.start`, `tool.complete`, etc. This is the **structured
metadata** path alongside the raw PTY bytes.

### 2.3 api_server.py SSE stream

`gateway/platforms/api_server.py:19,761` — `GET /v1/runs/{run_id}/events` provides
an SSE stream of structured lifecycle events for the Codex-compatible API server.
Includes:
- `run_id` → status tracking (`_run_statuses` dict, line 3570)
- `tool_progress_callback` adapted to SSE (`_make_run_event_callback`, line 3585)
- Events: `{"type": "tool.started", "tool_name": ..., "run_id": ...}` etc.

This is an **independent implementation** (not shared with the dashboard) and
targets the API server's own HTTP clients.

### 2.4 tui_gateway event relay

`tui_gateway/server.py:2620-2790` — translates `tool_progress_callback` calls
into structured JSON-RPC notifications:

- `tool.start` (line 2630) — `{tool_id, name, context}`
- `tool.complete` (line 2677) — `{tool_id, name, args, result, summary, duration_s, todos}`
- `subagent.*` events (line 2701) — relayed with forwarding to child session
  mirrors (`_mirror_subagent_to_child`)

This is the **canonical bridge implementation** to study — it already translates
the raw `tool_progress_callback` events into structured JSON payloads that a
renderer can consume.

## 3. Proposed event schema for Agent Room

The old prototype schema file is not part of the active integration. Proposed schema
below, designed to match the Agent Room data model
(`{id, name, color, type: main|sub, parent, status, task}` — from
`docs/agent-room-spec.md:44`):

### 3.1 Agent state events (topology changes)

```jsonc
// agent_added — a new agent appears
{
  "event": "agent_added",
  "agent": {
    "id": "string",           // stable identifier
    "name": "string",         // display name (model name or "Subagent N")
    "color": "string",        // hex color for visual identity
    "agentType": "main" | "sub",
    "parent": "string | null",// parent agent id for sub-agents
    "status": "idle" | "working" | "done" | "error",
    "task": "string | null"   // current task description
  }
}

// agent_update — status or task changes
{
  "event": "agent_update",
  "id": "string",
  "changes": {
    "status": "working",      // only changed fields
    "task": "string"
  }
}

// agent_removed — agent left the room
{
  "event": "agent_removed",
  "id": "string"
}
```

### 3.2 Agent list snapshot (initial sync)

```jsonc
{
  "event": "agent_snapshot",
  "agents": [
    { "id": "...", "name": "Claude", "color": "#...", "agentType": "main", "parent": null, "status": "working", "task": "Building dashboard" },
    { "id": "...", "name": "Subagent 1", "color": "#...", "agentType": "sub", "parent": "claude-id", "status": "working", "task": "Fetching data" }
  ]
}
```

### 3.3 Room topology event

```jsonc
{
  "event": "room_layout",
  "rooms": [
    { "id": "room-main", "agents": ["id1", "id2", ...] },
    { "id": "room-br-1", "agents": ["id3", "id4"], "breakoutOf": "room-main" }
  ]
}
```

## 4. Bridge design

### 4.1 Approach: tap into existing `tool_progress_callback`

The `tool_progress_callback` is already the universal event spine. Every
agent (main + subagents) already routes its events through it. The bridge
should:

1. **Wrap `tool_progress_callback`** at the top-level agent (the one driving
   the conversation). The wrapper intercepts `tool.*` and `subagent.*` event
   types and translates them into Agent Room events.

2. **Poll `list_active_subagents()`** periodically (e.g. every 1s via
   `setInterval` on the frontend, or push on subagent start/stop) to maintain
   the full agent tree snapshot.

3. **Derive main-agent status** from conversation state:
   - `idle` → no active turn
   - `working` → turn in progress (tool calls happening)
   - `done` → turn completed
   - `error` → turn errored

### 4.2 Transport: WebSocket (extend existing `/api/events`)

**Recommendation: WebSocket.** SSE would also work but the codebase already
has a battle-tested WebSocket relay (`/api/pub` + `/api/events`). The Agent
Room frontend can open a dedicated `/api/events?channel=<agent-room-channel>`
and receive the same framed JSON model that the Chat tab sidebar already uses.

**Where to host it:** Extend `hermes_cli/web_server.py`. The web server is
already the dashboard backend. No standalone process needed.

**Justification:**
- `/api/events` already exists and is production-tested for exactly this
  pattern (publisher → channel → subscriber fan-out).
- The web server already owns the HTTP/WS bind, auth, CORS, and middleware.
- A standalone process would duplicate auth, add another port/process to
  manage, and create a second deployment topology.
- The Agent Room bridge is a new *publisher* on the same channel system — it
  writes events to a channel that the Agent Room renderer subscribes to.

### 4.3 Bridge module placement

Create a new module: `hermes_cli/agent_room_events.py`. It exposes:

- `AgentRoomBridge` — a class that wraps `tool_progress_callback` and
  `stream_delta_callback`, translating raw events into Agent Room JSON
  events and publishing to the web server's event channel infrastructure.
- `start_agent_room_bridge(app, channel)` — registers the bridge as a
  publisher on the given channel.
- `stop_agent_room_bridge(app, channel)` — unregisters.

The bridge is activated when the dashboard's Agent Room page mounts (the
frontend calls a new REST endpoint or the `/api/pub` + `/api/events` channel
system with a dedicated channel name like `agent-room`).

### 4.4 Data flow diagram

```
AIAgent.run_conversation()
    │
    ├─ tool_progress_callback("tool.started", ...)
    ├─ tool_progress_callback("tool.completed", ...)
    ├─ tool_progress_callback("subagent.start", ...)
    ├─ tool_progress_callback("subagent.progress", ...)
    ├─ tool_progress_callback("subagent.complete", ...)
    │
    ▼
AgentRoomBridge (wraps callback)
    │
    ├─ translate to agent_added/agent_update/agent_removed
    ├─ maintain agent state map
    │
    ▼
hermes_cli/web_server.py._broadcast_event()
    │
    ▼
/api/events WebSocket subscribers (Agent Room renderer)
```

## 5. Phased implementation plan

### Phase 1: Static agent list → dashboard proof-of-life
- The Agent Room renderer hardcodes a sample agent list.
- Verifies the isometric rendering, cameras, and room layout with mock data.
- **Risk: none.** Isolated frontend work.

### Phase 2: Agent room REST endpoint
- `GET /api/agent-room/agents` — returns the current agent snapshot from
  `list_active_subagents()` plus the main agent status.
- The renderer polls this endpoint every 2–5 seconds.
- **Risk: low.** Read-only, no mutation. Falls back gracefully if no
  conversation is running.

### Phase 3: Live WebSocket bridge
- Create `hermes_cli/agent_room_events.py` with `AgentRoomBridge`.
- Wire it into the existing `/api/pub` + `/api/events` channel system.
- The Agent Room page opens `/api/events?channel=agent-room` and receives
  real-time events.
- **Risk: medium.** Requires the bridge to be activated/deactivated in sync
  with the conversation lifecycle. Must handle reconnection.

### Phase 4: Sub-agent breakout rooms
- Extend `agent_added`/`agent_removed` events with room routing info.
- Renderer assigns sub-agents to breakout rooms as specified in
  `docs/agent-room-spec.md:48-53`.
- **Risk: medium.** Room layout logic lives partly in the renderer and
  partly in the bridge. Need clear ownership.

### Phase 5: Room layout engine
- Implement the dynamic room layout rules (main room cap at ~6, overflow
  spawns new rooms, sub-agent groups get separate breakout rooms).
- Bridge publishes `room_layout` events on topology changes.
- **Risk: medium-high.** Layout algorithm is non-trivial; scope it
  carefully.

## 6. Risk notes

1. **Subagent hooks `subagent_start`/`subagent_stop` may NOT fire.**
   These are declared in `VALID_HOOKS` but grep finds no `invoke_hook` calls
   for them. Use `tool_progress_callback("subagent.*")` events instead,
   which are confirmed working.

2. **Subagents run in threads, not asyncio.** The `AgentRoomBridge` must be
   thread-safe. `_broadcast_event` uses `asyncio.Lock` and `send_text`,
   which must be called from the event loop. The bridge should push events
   into an `asyncio.Queue` consumed by a dedicated task, or use
   `loop.call_soon_threadsafe`.

3. **No shared event bus exists.** There is no centralized pub/sub system
   across all agents. The `tool_progress_callback` is per-agent,
   per-invocation. The bridge must capture the callback at agent creation
   time. For sub-agents this means intercepting the parent's callback and
   forwarding relevant child events.

4. **Agent identification.** Main agents are identified by the session's
   model/provider. Sub-agents get `_subagent_id` and `_parent_subagent_id`
   attributes. There is no globally unique "agent identity" across the
   system — the bridge must assign and track its own stable ids.

5. **Gateway sessions don't use `/api/events`.** The pub/events channel
   system is dashboard-only (inside `hermes_cli/web_server.py`). Gateway
   conversations (Telegram, Discord, etc.) don't currently have a WebSocket
   dashboard. The Agent Room is a dashboard feature, so this is acceptable
   for now. If gateway visibility is needed later, the SSE stream from
   `api_server.py` is the right path.

6. **Color assignment.** `docs/agent-room-spec.md` says each agent has a
   `color`. The bridge needs a deterministic color palette for main agents
   (could be a fixed mapping of model → color). Sub-agents could inherit
   their parent's hue with a lightness variation. This is a UX detail best
   resolved early to avoid breaking visual changes later.

7. **Historical prototype schema is not active.** The schema proposed in section 3 is the starting
   point; it should be vetted by the human reviewer before implementation.

## 7. Uncertainties flagged for reviewer

- **Subagent hook invocations:** Are `subagent_start`/`subagent_stop` hooks
  meant to fire somewhere that grep missed, or are they reserved for future
  use? If they don't fire, the bridge should not depend on them.
- **Event schema agreement:** Is the proposed `agent_added`/`agent_update`/
  `agent_removed` schema aligned with the renderer's needs? The Agent Room
  spec doesn't define exact event shapes.
- **Desired granularity:** Should the bridge emit per-tool events (every
  tool call = agent status "working" with a new task description) or only
  status transitions? The current `tool_progress_callback` is very granular
  — this could flood the Agent Room renderer with updates.
- **Gateway integration scope:** Should the bridge work for gateway sessions
  (Telegram, Discord) or only for dashboard sessions? The web-server-hosted
  bridge works for dashboard only unless explicitly extended.
