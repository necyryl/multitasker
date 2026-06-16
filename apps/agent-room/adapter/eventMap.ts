import type { AgentSeatMeta, ServerMessage } from '../core/src/messages.js';

/**
 * Multitasker → Agent Room event mapping.
 *
 * THE SEAM: hermes (Python) emits raw `tool_progress_callback` events. The Multitasker
 * publisher (`hermes_cli/agent_room_events.py`, Phase 2b) normalizes those into the
 * `BridgeEvent` contract below. THIS module translates `BridgeEvent`s into the
 * pixel-agents `ServerMessage` vocabulary the office renderer consumes.
 *
 * Why a normalized contract instead of mapping raw hermes events directly:
 * - hermes identifies agents by string `session_id` / `subagent_id`; the office needs
 *   stable numeric `id`s. Id assignment is stateful and lives here.
 * - Decoupling lets the Python side change without touching the renderer, and lets this
 *   mapper be unit-tested with no hermes runtime (see eventMap.test.ts).
 *
 * Asset/layout bootstrap (characterSpritesLoaded, floorTilesLoaded, ...) is NOT here —
 * it is pure client-side PNG decoding (see webview-ui browserMock) and needs no backend.
 */

export interface BridgeAgent {
  /** Stable string identity from hermes (session id, or subagent id). */
  sessionId: string;
  /** Display name (model/provider or "Subagent N"). */
  name?: string;
  /** Workspace folder label shown under the agent. */
  folderName?: string;
  /** Sprite palette index + hue (visual identity). */
  palette?: number;
  hueShift?: number;
  /** True for sub-agents / external sessions. */
  isExternal?: boolean;
}

export type BridgeEvent =
  | { kind: 'snapshot'; agents: BridgeAgent[] }
  | { kind: 'agentAdded'; agent: BridgeAgent }
  | { kind: 'agentRemoved'; sessionId: string }
  | { kind: 'agentStatus'; sessionId: string; status: 'active' | 'waiting' }
  | {
      kind: 'toolStart';
      sessionId: string;
      toolId: string;
      toolName?: string;
      status?: string;
      runInBackground?: boolean;
      permission?: boolean;
    }
  | { kind: 'toolDone'; sessionId: string; toolId: string }
  | { kind: 'toolsClear'; sessionId: string }
  | { kind: 'subagentToolStart'; sessionId: string; parentToolId: string; toolId: string; status?: string }
  | { kind: 'subagentToolDone'; sessionId: string; parentToolId: string; toolId: string }
  | { kind: 'subagentClear'; sessionId: string; parentToolId: string }
  | { kind: 'tokenUsage'; sessionId: string; inputTokens: number; outputTokens: number };

/**
 * Stateful translator. Holds the sessionId → numeric-id registry and known-agent set so it
 * can emit `agentCreated` / `existingAgents` / `agentClosed` correctly across a live stream.
 */
export class AgentRoomEventMapper {
  private readonly ids = new Map<string, number>();
  private nextId = 1;
  private readonly known = new Set<number>();
  private readonly meta: Record<string, AgentSeatMeta> = {};
  private readonly folderNames: Record<string, string> = {};
  private readonly externalAgents: Record<string, boolean> = {};

  /** Resolve (and assign on first sight) a stable numeric id for a hermes session id. */
  private idFor(sessionId: string): number {
    let id = this.ids.get(sessionId);
    if (id === undefined) {
      id = this.nextId++;
      this.ids.set(sessionId, id);
    }
    return id;
  }

  private registerAgent(a: BridgeAgent): number {
    const id = this.idFor(a.sessionId);
    this.known.add(id);
    if (a.palette !== undefined || a.hueShift !== undefined) {
      this.meta[id] = { palette: a.palette, hueShift: a.hueShift };
    }
    if (a.folderName) this.folderNames[id] = a.folderName;
    if (a.isExternal) this.externalAgents[id] = true;
    return id;
  }

  map(ev: BridgeEvent): ServerMessage[] {
    switch (ev.kind) {
      case 'snapshot': {
        this.known.clear();
        for (const a of ev.agents) this.registerAgent(a);
        const out: ServerMessage[] = [
          {
            type: 'existingAgents',
            agents: [...this.known],
            agentMeta: { ...this.meta },
            folderNames: { ...this.folderNames },
            externalAgents: { ...this.externalAgents },
          },
        ];
        // Names ride on agentTeamInfo (the office reads agentName from it).
        for (const a of ev.agents) {
          if (a.name) out.push({ type: 'agentTeamInfo', id: this.idFor(a.sessionId), agentName: a.name });
        }
        return out;
      }
      case 'agentAdded': {
        const id = this.registerAgent(ev.agent);
        const out: ServerMessage[] = [
          { type: 'agentCreated', id, folderName: ev.agent.folderName, isExternal: ev.agent.isExternal },
        ];
        if (ev.agent.name) out.push({ type: 'agentTeamInfo', id, agentName: ev.agent.name });
        return out;
      }
      case 'agentRemoved': {
        const id = this.ids.get(ev.sessionId);
        if (id === undefined) return [];
        this.known.delete(id);
        return [{ type: 'agentClosed', id }];
      }
      case 'agentStatus':
        return [{ type: 'agentStatus', id: this.idFor(ev.sessionId), status: ev.status }];
      case 'toolStart': {
        const id = this.idFor(ev.sessionId);
        const out: ServerMessage[] = [
          {
            type: 'agentToolStart',
            id,
            toolId: ev.toolId,
            status: ev.status ?? '',
            toolName: ev.toolName,
            permissionActive: ev.permission,
            runInBackground: ev.runInBackground,
          },
        ];
        if (ev.permission) out.push({ type: 'agentToolPermission', id });
        return out;
      }
      case 'toolDone':
        return [{ type: 'agentToolDone', id: this.idFor(ev.sessionId), toolId: ev.toolId }];
      case 'toolsClear':
        return [{ type: 'agentToolsClear', id: this.idFor(ev.sessionId) }];
      case 'subagentToolStart':
        return [
          {
            type: 'subagentToolStart',
            id: this.idFor(ev.sessionId),
            parentToolId: ev.parentToolId,
            toolId: ev.toolId,
            status: ev.status ?? '',
          },
        ];
      case 'subagentToolDone':
        return [
          {
            type: 'subagentToolDone',
            id: this.idFor(ev.sessionId),
            parentToolId: ev.parentToolId,
            toolId: ev.toolId,
          },
        ];
      case 'subagentClear':
        return [{ type: 'subagentClear', id: this.idFor(ev.sessionId), parentToolId: ev.parentToolId }];
      case 'tokenUsage':
        return [
          {
            type: 'agentTokenUsage',
            id: this.idFor(ev.sessionId),
            inputTokens: ev.inputTokens,
            outputTokens: ev.outputTokens,
          },
        ];
    }
  }
}

/** Back-compat thin wrapper kept for the Codex stub signature. Prefer AgentRoomEventMapper. */
export function mapHermesEventToPixelMessages(event: BridgeEvent, mapper: AgentRoomEventMapper): ServerMessage[] {
  return mapper.map(event);
}
