"""Agent Room event bridge — translate gateway events → pixel-agents BridgeEvents.

The vendored pixel-agents office (`apps/agent-room/`) consumes a normalized
``BridgeEvent`` wire contract (defined in `apps/agent-room/adapter/eventMap.ts`),
delivered as newline-delimited JSON over the dashboard WebSocket channel
``agent-room`` (subscribed via ``/api/events?channel=agent-room``; see
`apps/agent-room/webview-ui/src/transport/multitaskerTransport.ts`).

This module turns the *existing* `tui_gateway` event stream — the same
JSON-RPC ``{"method": "event", "params": {...}}`` frames the dashboard chat
sidebar already receives (emitted by `tui_gateway/server.py::_emit`) — into
``BridgeEvent`` dicts. We tap the events that already flow to the web server,
so there is no need to wrap `tool_progress_callback` on the agent (which runs
in worker threads); translation happens at the async web-server relay layer.

Design notes / why this shape:
- hermes identifies agents by string ``session_id`` / ``subagent_id``. The
  office's JS ``AgentRoomEventMapper`` assigns stable numeric ids itself, so we
  pass the string ids straight through as ``sessionId`` and let JS own numbering.
- ``AgentRoomBridge`` is stateful only to (a) emit ``agentAdded`` the first time
  a session id is seen, and (b) suppress duplicates. It holds NO numeric ids.
- Pure translation lives in ``translate_event``; the class wraps it with the
  "seen agents" bookkeeping. Both are unit-testable with no hermes runtime.

BridgeEvent kinds emitted here (subset of the TS union — see eventMap.ts):
  agentAdded, agentRemoved, toolStart, toolDone,
  subagentToolStart, subagentToolDone, tokenUsage
``snapshot`` is reserved for a future REST hydrate; the live stream uses
incremental ``agentAdded`` instead.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

CHANNEL = "agent-room"


def _agent(session_id: str, name: Optional[str] = None, *, is_external: bool = False) -> Dict[str, Any]:
    """Build a BridgeAgent dict (eventMap.ts::BridgeAgent)."""
    agent: Dict[str, Any] = {"sessionId": session_id}
    if name:
        agent["name"] = name
    if is_external:
        agent["isExternal"] = True
    return agent


def translate_event(method_params: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Translate ONE gateway ``event`` frame's params into BridgeEvent dicts.

    ``method_params`` is the ``params`` object of a tui_gateway JSON-RPC
    ``{"method": "event", "params": {...}}`` notification. Its shape (from
    ``tui_gateway/server.py``):
        { "event": "<type>", "sid": "<session id>", "payload": {...} }

    Returns a (possibly empty) list of BridgeEvent dicts. Pure: emits NO
    agentAdded — that bookkeeping belongs to ``AgentRoomBridge`` which knows
    which sessions have already been announced.
    """
    event_type = str(method_params.get("event") or "")
    sid = str(method_params.get("sid") or "")
    payload = method_params.get("payload") or {}
    if not event_type or not sid or not isinstance(payload, dict):
        return []

    if event_type == "tool.start":
        tool_id = payload.get("tool_id")
        if not tool_id:
            return []
        ev: Dict[str, Any] = {
            "kind": "toolStart",
            "sessionId": sid,
            "toolId": str(tool_id),
        }
        if payload.get("name"):
            ev["toolName"] = str(payload["name"])
        return [ev]

    if event_type == "tool.complete":
        tool_id = payload.get("tool_id")
        if not tool_id:
            return []
        return [{"kind": "toolDone", "sessionId": sid, "toolId": str(tool_id)}]

    if event_type.startswith("subagent."):
        return _translate_subagent(event_type, sid, payload)

    # reasoning.available / other event types carry no office-visible state.
    return []


def _translate_subagent(event_type: str, sid: str, payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Translate ``subagent.*`` events.

    The office models sub-agent work as tool rows under the PARENT agent
    (subagentToolStart/Done with a parentToolId), matching eventMap.ts. We key
    the parent tool id on the subagent_id so all of one child's activity nests
    under a single row.
    """
    subagent_id = str(payload.get("subagent_id") or "")
    if not subagent_id:
        return []
    parent_tool_id = f"sa:{subagent_id}"
    out: List[Dict[str, Any]] = []

    if event_type in ("subagent.start", "subagent.tool"):
        out.append(
            {
                "kind": "subagentToolStart",
                "sessionId": sid,
                "parentToolId": parent_tool_id,
                "toolId": f"{parent_tool_id}:{payload.get('tool_name') or event_type}",
                "status": str(payload.get("status") or payload.get("goal") or ""),
            }
        )
    elif event_type == "subagent.complete":
        out.append(
            {
                "kind": "subagentToolDone",
                "sessionId": sid,
                "parentToolId": parent_tool_id,
                "toolId": parent_tool_id,
            }
        )
        in_tok = payload.get("input_tokens")
        out_tok = payload.get("output_tokens")
        if in_tok is not None and out_tok is not None:
            try:
                out.append(
                    {
                        "kind": "tokenUsage",
                        "sessionId": sid,
                        "inputTokens": int(in_tok),
                        "outputTokens": int(out_tok),
                    }
                )
            except (TypeError, ValueError):
                pass
    return out


class AgentRoomBridge:
    """Stateful wrapper: announces new agents, then forwards translated events.

    Usage (in the web server's /api/pub → /api/events relay):
        bridge = AgentRoomBridge()           # one per dashboard process
        for line in bridge.ingest(params):   # params = JSON-RPC event params
            await _broadcast_event(app, CHANNEL, line)   # line is NDJSON text

    Not thread-safe; call only from the asyncio event loop that owns the relay.
    """

    def __init__(self) -> None:
        self._seen: set[str] = set()

    def ingest(self, method_params: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Return BridgeEvent dicts for one gateway event, announcing new sids."""
        sid = str(method_params.get("sid") or "")
        if not sid:
            return []
        events = translate_event(method_params)
        if not events:
            return []
        out: List[Dict[str, Any]] = []
        if sid not in self._seen:
            self._seen.add(sid)
            out.append({"kind": "agentAdded", "agent": _agent(sid)})
        out.extend(events)
        return out

    def forget(self, session_id: str) -> List[Dict[str, Any]]:
        """Emit agentRemoved when a session ends (call on on_session_end)."""
        if session_id in self._seen:
            self._seen.discard(session_id)
            return [{"kind": "agentRemoved", "sessionId": session_id}]
        return []
