import type { ClientMessage, ServerMessage } from '../core/src/messages.js';
import type { MessageTransport } from '../core/src/transport.js';

export class MultitaskerTransport implements MessageTransport {
  private readonly handlers = new Set<(message: ServerMessage) => void>();

  send(_message: ClientMessage): void {
    // TODO(docs/event-bridge-spec.md): forward renderer commands to the
    // Multitasker dashboard bridge when Phase 2 defines writable actions.
  }

  onMessage(handler: (message: ServerMessage) => void): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  dispose(): void {
    this.handlers.clear();
    // TODO(docs/event-bridge-spec.md): close bridge subscriptions here.
  }
}
