import type { ClientMessage, ServerMessage } from '../../../core/src/messages.js';
import type { MessageTransport } from './types.js';

/**
 * Vite dev transport. The browser mock injects server-like messages through
 * window MessageEvents, so dev mode needs a matching in-page receiver.
 */
export class BrowserMockTransport implements MessageTransport {
  send(message: ClientMessage): void {
    if (message.type !== 'webviewReady') {
      console.debug('[BrowserMockTransport] Ignored client message', message.type);
    }
  }

  onMessage(handler: (message: ServerMessage) => void): () => void {
    const listener = (e: MessageEvent) => handler(e.data as ServerMessage);
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }

  dispose(): void {
    // Listeners are removed by the unsubscribe returned from onMessage().
  }
}
