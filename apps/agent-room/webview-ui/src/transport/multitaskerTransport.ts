import type { BridgeEvent } from '../../../adapter/eventMap.js';
import { AgentRoomEventMapper } from '../../../adapter/eventMap.js';
import type { ClientMessage, ServerMessage } from '../../../core/src/messages.js';
import { dispatchAssetMessages, initBrowserMock } from '../browserMock.js';
import type { MessageTransport } from './types.js';

const BRIDGE_EVENT_KINDS = new Set([
  'snapshot',
  'agentAdded',
  'agentRemoved',
  'agentStatus',
  'toolStart',
  'toolDone',
  'toolsClear',
  'subagentToolStart',
  'subagentToolDone',
  'subagentClear',
  'tokenUsage',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isBridgeEvent(value: unknown): value is BridgeEvent {
  return isRecord(value) && typeof value.kind === 'string' && BRIDGE_EVENT_KINDS.has(value.kind);
}

/**
 * Multitasker dashboard transport.
 *
 * Assets are still decoded client-side from the vendored pixel-agents bundles.
 * Live agent state comes from the dashboard event bridge and is translated by
 * adapter/eventMap.ts into the pixel-agents ServerMessage vocabulary.
 */
export class MultitaskerTransport implements MessageTransport {
  private ws: WebSocket | null = null;
  private readonly handlers = new Set<(message: ServerMessage) => void>();
  private readonly mapper = new AgentRoomEventMapper();
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  private connecting = false;
  private bootstrapped = false;

  connect(): void {
    if (this.disposed || this.connecting || this.ws) return;
    void this.bootstrapAndConnect();
  }

  send(message: ClientMessage): void {
    if (message.type !== 'webviewReady') {
      console.debug('[MultitaskerTransport] Ignored client message', message.type);
    }
  }

  onMessage(handler: (message: ServerMessage) => void): () => void {
    this.handlers.add(handler);
    this.connect();
    return () => {
      this.handlers.delete(handler);
    };
  }

  dispose(): void {
    this.disposed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
    this.handlers.clear();
  }

  private async bootstrapAndConnect(): Promise<void> {
    this.connecting = true;
    try {
      await this.bootstrapAssets();
      if (this.disposed) return;
      this.openSocket();
    } catch (err) {
      console.error('[MultitaskerTransport] Failed to start', err);
      this.scheduleReconnect();
    } finally {
      this.connecting = false;
    }
  }

  private async bootstrapAssets(): Promise<void> {
    if (this.bootstrapped) return;
    await initBrowserMock();
    if (this.disposed) return;
    dispatchAssetMessages((data) => this.emit(data as ServerMessage));
    this.bootstrapped = true;
  }

  private openSocket(): void {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}/api/events?channel=agent-room`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      console.log('[MultitaskerTransport] WebSocket connected');
    };

    this.ws.onmessage = (e: MessageEvent) => {
      if (typeof e.data !== 'string') {
        console.debug('[MultitaskerTransport] Ignored non-text frame');
        return;
      }
      this.handleFrame(e.data);
    };

    this.ws.onclose = () => {
      this.ws = null;
      if (!this.disposed) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      // onclose will fire after onerror, triggering reconnect.
    };
  }

  private handleFrame(frame: string): void {
    for (const line of frame.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      let parsed: unknown;
      try {
        parsed = JSON.parse(trimmed);
      } catch (err) {
        console.warn('[MultitaskerTransport] Skipping malformed event frame', err);
        continue;
      }

      if (!isBridgeEvent(parsed)) {
        console.debug('[MultitaskerTransport] Ignored control frame', parsed);
        continue;
      }

      for (const message of this.mapper.map(parsed)) {
        this.emit(message);
      }
    }
  }

  private emit(message: ServerMessage): void {
    for (const handler of this.handlers) handler(message);
  }

  private scheduleReconnect(): void {
    if (this.disposed || this.reconnectTimer) return;

    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30000);
    this.reconnectAttempts++;
    console.log(
      `[MultitaskerTransport] WebSocket reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`,
    );
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }
}
