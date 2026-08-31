import type { CloseEventLike, MessageEventLike, WebSocketLike } from '../types';

export class FakeWebSocket implements WebSocketLike {
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEventLike) => void) | null = null;
  onerror: ((error: unknown) => void) | null = null;
  onclose: ((event: CloseEventLike) => void) | null = null;
  readonly sent: string[] = [];
  open(): void {
    this.readyState = 1;
    this.onopen?.();
  }
  message(payload: unknown): void {
    this.onmessage?.({ data: JSON.stringify(payload) });
  }
  send(data: string): void {
    this.sent.push(data);
  }
  close(code = 1000, reason?: string): void {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.onclose?.({ code, reason });
  }
}
