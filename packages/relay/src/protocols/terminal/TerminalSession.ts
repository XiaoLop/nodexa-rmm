import type { RelaySession } from '../../RelaySession';
import type { RelayInboundData } from '../../types';
import { RELAY_PROTOCOLS } from '../types';
import {
  createTerminalResizeMessage,
  createTerminalRttMessage,
  parseTerminalControlMessage,
} from './controlMessages';
import {
  TerminalSessionError,
  type TerminalControlMessage,
  type TerminalSessionOptions,
  type TerminalSessionState,
  type TerminalSize,
} from './types';

const DEFAULT_MAX_PENDING_OUTPUT_BYTES = 4 * 1024 * 1024;
const DEFAULT_RTT_INTERVAL_MS = 10_000;
const DEFAULT_RTT_TIMEOUT_MS = 15_000;

function assertTerminalSize(size: TerminalSize): void {
  if (
    !Number.isInteger(size.cols) ||
    !Number.isInteger(size.rows) ||
    size.cols < 2 ||
    size.cols > 500 ||
    size.rows < 1 ||
    size.rows > 200
  ) {
    throw new TerminalSessionError('Terminal size is outside the supported range.', 'invalid-size');
  }
}

function inboundSize(data: RelayInboundData): number {
  if (typeof data === 'string') return new TextEncoder().encode(data).byteLength;
  if (data instanceof ArrayBuffer) return data.byteLength;
  if (ArrayBuffer.isView(data)) return data.byteLength;
  return data.size;
}

async function toUint8Array(data: Exclude<RelayInboundData, string>): Promise<Uint8Array> {
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  return new Uint8Array(await data.arrayBuffer());
}

export class TerminalSession {
  private stateValue: TerminalSessionState = 'ready';
  private disposed = false;
  private pendingOutputBytes = 0;
  private inboundQueue = Promise.resolve();
  private lastSize: TerminalSize;
  private rttTimer?: ReturnType<typeof setInterval>;
  private rttTimeout?: ReturnType<typeof setTimeout>;
  private pendingRtt?: number;
  private readonly dataListeners = new Set<(data: string | Uint8Array) => void>();
  private readonly stateListeners = new Set<(state: TerminalSessionState) => void>();
  private readonly latencyListeners = new Set<(latencyMs: number | undefined) => void>();
  private readonly removeListeners: Array<() => void> = [];
  private readonly now: () => number;

  readonly recorded: boolean;

  constructor(
    readonly relay: RelaySession,
    private readonly options: TerminalSessionOptions,
  ) {
    if (relay.protocol !== RELAY_PROTOCOLS.terminal) {
      throw new TerminalSessionError('TerminalSession requires a p=1 relay session.', 'protocol');
    }
    if (relay.state !== 'ready') {
      throw new TerminalSessionError('Terminal relay session is not ready.', 'connection-lost');
    }
    assertTerminalSize(options.initialSize);
    this.lastSize = { ...options.initialSize };
    this.recorded = options.recorded ?? false;
    this.now = options.now ?? Date.now;
    this.removeListeners.push(
      relay.onMessage((data) => this.enqueueInbound(data)),
      relay.onError(() => this.finish('error')),
      relay.onClose(() => this.finish(relay.state === 'error' ? 'error' : 'closed')),
    );
    this.startRtt();
  }

  get state(): TerminalSessionState {
    return this.stateValue;
  }

  onData(listener: (data: string | Uint8Array) => void): () => void {
    this.dataListeners.add(listener);
    return () => this.dataListeners.delete(listener);
  }

  onStateChange(listener: (state: TerminalSessionState) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  onLatencyChange(listener: (latencyMs: number | undefined) => void): () => void {
    this.latencyListeners.add(listener);
    return () => this.latencyListeners.delete(listener);
  }

  write(data: string | Uint8Array): void {
    this.assertReady();
    if (typeof data === 'string') this.relay.sendBinary(new TextEncoder().encode(data));
    else this.relay.sendBinary(data);
  }

  resize(size: TerminalSize): void {
    this.assertReady();
    assertTerminalSize(size);
    if (size.cols === this.lastSize.cols && size.rows === this.lastSize.rows) return;
    this.lastSize = { ...size };
    this.relay.sendJson(createTerminalResizeMessage(size));
  }

  close(code?: number, reason?: string): void {
    if (this.disposed) return;
    this.finish('closed');
    this.relay.close(code, reason);
  }

  dispose(): void {
    if (this.disposed) return;
    this.finish(this.relay.state === 'error' ? 'error' : 'closed');
  }

  private enqueueInbound(data: RelayInboundData): void {
    if (this.disposed) return;
    const size = inboundSize(data);
    this.pendingOutputBytes += size;
    const maximum = this.options.maxPendingOutputBytes ?? DEFAULT_MAX_PENDING_OUTPUT_BYTES;
    if (this.pendingOutputBytes > maximum) {
      this.finish('error');
      this.relay.close(4009, 'Terminal output exceeded the pending output limit.');
      return;
    }
    this.inboundQueue = this.inboundQueue
      .then(() => this.handleInbound(data))
      .catch((error) => {
        this.options.onUnhandledMessage?.(data);
        this.finish('error');
        this.relay.close(4002, error instanceof Error ? error.message : 'Unsupported terminal data.');
      })
      .finally(() => {
        this.pendingOutputBytes -= size;
      });
  }

  private async handleInbound(data: RelayInboundData): Promise<void> {
    if (this.disposed) return;
    if (typeof data === 'string') {
      const control = parseTerminalControlMessage(data);
      if (control) {
        this.handleControlMessage(control);
        return;
      }
      this.emitData(data);
      return;
    }
    this.emitData(await toUint8Array(data));
  }

  private handleControlMessage(message: TerminalControlMessage): void {
    this.options.onControlMessage?.(message);
    if (message.type === 'rtt' && typeof message.time === 'number' && message.time === this.pendingRtt) {
      const latency = Math.max(0, this.now() - message.time);
      this.pendingRtt = undefined;
      if (this.rttTimeout) clearTimeout(this.rttTimeout);
      this.rttTimeout = undefined;
      for (const listener of this.latencyListeners) listener(latency);
    }
    if (message.type === 'disconnect') this.finish('closed');
  }

  private startRtt(): void {
    const interval = this.options.rttIntervalMs ?? DEFAULT_RTT_INTERVAL_MS;
    if (interval <= 0) return;
    this.sendRtt();
    this.rttTimer = setInterval(() => this.sendRtt(), interval);
  }

  private sendRtt(): void {
    if (this.disposed || this.pendingRtt !== undefined) return;
    const time = this.now();
    this.pendingRtt = time;
    this.relay.sendJson(createTerminalRttMessage(time));
    const timeout = this.options.rttTimeoutMs ?? DEFAULT_RTT_TIMEOUT_MS;
    this.rttTimeout = setTimeout(() => {
      this.pendingRtt = undefined;
      this.rttTimeout = undefined;
      for (const listener of this.latencyListeners) listener(undefined);
    }, timeout);
  }

  private emitData(data: string | Uint8Array): void {
    for (const listener of this.dataListeners) listener(data);
  }

  private assertReady(): void {
    if (this.disposed || this.stateValue !== 'ready' || this.relay.state !== 'ready') {
      throw new TerminalSessionError('Terminal relay session is not ready.', 'connection-lost');
    }
  }

  private finish(state: TerminalSessionState): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stateValue = state;
    if (this.rttTimer) clearInterval(this.rttTimer);
    if (this.rttTimeout) clearTimeout(this.rttTimeout);
    for (const remove of this.removeListeners.splice(0)) remove();
    for (const listener of this.stateListeners) listener(state);
  }
}