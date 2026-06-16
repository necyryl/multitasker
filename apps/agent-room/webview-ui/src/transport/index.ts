import { isBrowserRuntime } from '../runtime.js';
import { BrowserMockTransport } from './browserMockTransport.js';
import { MultitaskerTransport } from './multitaskerTransport.js';
import { PostMessageTransport } from './postMessageTransport.js';
import type { MessageTransport } from './types.js';
import { WebSocketTransport } from './webSocketTransport.js';

function createTransport(): MessageTransport {
  if (!isBrowserRuntime) {
    return new PostMessageTransport();
  }
  // Opt-in live Multitasker bridge; default browser behavior stays pixel-agents-compatible.
  if (
    import.meta.env.VITE_AGENT_ROOM_SOURCE === 'multitasker' ||
    new URLSearchParams(window.location.search).get('source') === 'multitasker'
  ) {
    return new MultitaskerTransport();
  }
  if (import.meta.env.DEV) {
    return new BrowserMockTransport();
  }
  // Standalone browser: connect via WebSocket to the same host serving the SPA
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;
  const ws = new WebSocketTransport(wsUrl);
  ws.connect();
  return ws;
}

/** Singleton transport instance. Import this everywhere instead of vscodeApi. */
export const transport: MessageTransport = createTransport();
export type { MessageTransport } from './types.js';
