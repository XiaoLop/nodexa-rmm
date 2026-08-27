import type {
  RelayCloseEventLike,
  RelayInboundData,
  RelayMessageEventLike,
  RelayOutboundData,
  RelayWebSocketLike,
} from '../types';

export class FakeRelayWebSocket implements RelayWebSocketLike {
  readyState = 0;
  binaryType?: string;
  onopen: (() => void) | null = null;
  onmessage: ((event: RelayMessageEventLike) => void) | null = null;
  onerror: ((error: unknown) => void) | null = null;
  onclose: ((event: RelayCloseEventLike) => void) | null = null;
  readonly sent: RelayOutboundData[] = [];
  closeCode?: number;
  closeReason?: string;

  open(): void {
    this.readyState = 1;
    this.onopen?.();
  }

  message(data: RelayInboundData): void {
    this.onmessage?.({ data });
  }

  error(error: unknown = new Error('Fake relay error.')): void {
    this.onerror?.(error);
  }

  send(data: RelayOutboundData): void {
    this.sent.push(data);
  }

  close(code = 1000, reason = ''): void {
    if (this.readyState === 3) return;
    this.closeCode = code;
    this.closeReason = reason;
    this.readyState = 3;
    this.onclose?.({ code, reason, wasClean: code === 1000 });
  }
}
