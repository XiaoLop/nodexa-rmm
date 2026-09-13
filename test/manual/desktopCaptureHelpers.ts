import { createHash } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type {
  RelayInboundData,
  RelayOutboundData,
  RelayWebSocketLike,
} from '@meshcentral/relay';
import type { WebSocketLike } from '@meshcentral/control-client';
import { sanitize } from './captureHelpers';

export type DesktopCaptureChannel = 'gateway' | 'relay';
export type DesktopCaptureDirection = 'browser-to-gateway' | 'gateway-to-browser' | 'browser-to-relay' | 'relay-to-browser';

export interface DesktopCaptureManifest {
  schemaVersion: 1;
  caseId: string;
  scenario: string;
  protocol: 2;
  transport: 'websocket';
  expectedActions: string[];
  expectedObservations: string[];
  observations?: Record<string, unknown>;
}

export interface DesktopCaptureMessage {
  seq: number;
  elapsedMs: number;
  channel: DesktopCaptureChannel;
  direction: DesktopCaptureDirection;
  kind: 'text' | 'binary';
  byteLength: number;
  sha256: string;
  text?: string;
  payloadFile?: string;
}

export interface DesktopCaptureAction {
  actionId: string;
  kind: string;
  startedAtMs: number;
  parameters: Record<string, unknown>;
  firstMessageSeq?: number;
  lastMessageSeq?: number;
}

export interface DesktopCaptureClose {
  elapsedMs: number;
  channel: DesktopCaptureChannel;
  direction: DesktopCaptureDirection;
  kind: 'intent' | 'event';
  code?: number;
  reason?: string;
  wasClean?: boolean;
}

function elapsedMilliseconds(startedAt: bigint): number {
  return Number((process.hrtime.bigint() - startedAt) / 1_000_000n);
}

function sha256(data: Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

async function copyBytes(data: Exclude<RelayInboundData | RelayOutboundData, string>): Promise<Uint8Array> {
  if (data instanceof ArrayBuffer) return new Uint8Array(data).slice();
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength).slice();
  }
  return new Uint8Array(await data.arrayBuffer());
}

function snapshotBinary(
  data: Exclude<RelayInboundData | RelayOutboundData, string>,
): Uint8Array | Blob {
  if (data instanceof ArrayBuffer) return new Uint8Array(data).slice();
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength).slice();
  }
  return data;
}

function sanitizeText(text: string): string {
  try {
    return JSON.stringify(sanitize(JSON.parse(text)));
  } catch {
    return String(sanitize(text));
  }
}

function jsonLines(values: readonly unknown[]): string {
  return values.length === 0 ? '' : `${values.map((value) => JSON.stringify(value)).join('\n')}\n`;
}

export class DesktopCaptureRecorder {
  private readonly startedAt = process.hrtime.bigint();
  private readonly messages: DesktopCaptureMessage[] = [];
  private readonly actions: DesktopCaptureAction[] = [];
  private readonly closes: DesktopCaptureClose[] = [];
  private pendingWrite = Promise.resolve();
  private nextSeq = 1;

  constructor(
    readonly manifest: DesktopCaptureManifest,
    private readonly captureRoot = resolve(process.env.MANUAL_CAPTURE_DIR || 'captures', 'desktop'),
  ) {}

  get caseDirectory(): string {
    return resolve(this.captureRoot, this.manifest.caseId);
  }

  get lastMessageSeq(): number {
    return this.nextSeq - 1;
  }

  async prepare(replace = false): Promise<void> {
    if (replace) await rm(this.caseDirectory, { recursive: true, force: true });
    await mkdir(resolve(this.caseDirectory, 'payloads'), { recursive: true });
    await mkdir(resolve(this.caseDirectory, 'screenshots'), { recursive: true });
  }

  recordMessage(
    channel: DesktopCaptureChannel,
    direction: DesktopCaptureDirection,
    data: RelayInboundData | RelayOutboundData,
  ): number {
    const seq = this.nextSeq++;
    const elapsedMs = elapsedMilliseconds(this.startedAt);
    const capturedData = typeof data === 'string' ? data : snapshotBinary(data);
    this.pendingWrite = this.pendingWrite.then(async () => {
      if (typeof capturedData === 'string') {
        const originalBytes = new TextEncoder().encode(capturedData);
        this.messages.push({
          seq,
          elapsedMs,
          channel,
          direction,
          kind: 'text',
          byteLength: originalBytes.byteLength,
          sha256: sha256(originalBytes),
          text: sanitizeText(capturedData),
        });
        return;
      }

      const bytes = await copyBytes(capturedData);
      const payloadFile = `payloads/${String(seq).padStart(6, '0')}.bin`;
      await mkdir(resolve(this.caseDirectory, 'payloads'), { recursive: true });
      await writeFile(resolve(this.caseDirectory, payloadFile), bytes);
      this.messages.push({
        seq,
        elapsedMs,
        channel,
        direction,
        kind: 'binary',
        byteLength: bytes.byteLength,
        sha256: sha256(bytes),
        payloadFile,
      });
    });
    return seq;
  }

  startAction(actionId: string, kind: string, parameters: Record<string, unknown> = {}): DesktopCaptureAction {
    const action = {
      actionId,
      kind,
      startedAtMs: elapsedMilliseconds(this.startedAt),
      parameters: sanitize(parameters) as Record<string, unknown>,
    };
    this.actions.push(action);
    return action;
  }

  linkAction(action: DesktopCaptureAction, firstMessageSeq: number, lastMessageSeq = firstMessageSeq): void {
    action.firstMessageSeq = firstMessageSeq;
    action.lastMessageSeq = lastMessageSeq;
  }

  recordClose(close: Omit<DesktopCaptureClose, 'elapsedMs'>): void {
    this.closes.push({ elapsedMs: elapsedMilliseconds(this.startedAt), ...close });
  }

  async write(): Promise<string> {
    await this.pendingWrite;
    await this.prepare();
    await Promise.all([
      writeFile(resolve(this.caseDirectory, 'manifest.json'), `${JSON.stringify(this.manifest, null, 2)}\n`, 'utf8'),
      writeFile(resolve(this.caseDirectory, 'messages.jsonl'), jsonLines(this.messages), 'utf8'),
      writeFile(resolve(this.caseDirectory, 'actions.jsonl'), jsonLines(this.actions), 'utf8'),
      writeFile(resolve(this.caseDirectory, 'closes.jsonl'), jsonLines(this.closes), 'utf8'),
    ]);
    return this.caseDirectory;
  }
}

export function createDesktopGatewayWebSocketFactory(
  recorder: DesktopCaptureRecorder,
): (url: string) => WebSocketLike {
  return (url) => {
    const socket = new WebSocket(url);
    const wrapper: WebSocketLike = {
      get readyState() {
        return socket.readyState;
      },
      onopen: null,
      onmessage: null,
      onerror: null,
      onclose: null,
      send(data) {
        recorder.recordMessage('gateway', 'browser-to-gateway', data);
        socket.send(data);
      },
      close(code, reason) {
        recorder.recordClose({ channel: 'gateway', direction: 'browser-to-gateway', kind: 'intent', code, reason });
        socket.close(code, reason);
      },
    };
    socket.onopen = () => wrapper.onopen?.();
    socket.onmessage = (event) => {
      const data = typeof event.data === 'string' ? event.data : String(event.data);
      recorder.recordMessage('gateway', 'gateway-to-browser', data);
      wrapper.onmessage?.({ data });
    };
    socket.onerror = (event) => wrapper.onerror?.(event);
    socket.onclose = (event) => {
      recorder.recordClose({
        channel: 'gateway',
        direction: 'gateway-to-browser',
        kind: 'event',
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
      });
      wrapper.onclose?.({ code: event.code, reason: event.reason });
    };
    return wrapper;
  };
}

export function createDesktopRelayWebSocketFactory(
  recorder: DesktopCaptureRecorder,
): (url: string) => RelayWebSocketLike {
  return (url) => {
    const socket = new WebSocket(url);
    const wrapper: RelayWebSocketLike = {
      get readyState() {
        return socket.readyState;
      },
      get binaryType() {
        return socket.binaryType;
      },
      set binaryType(value) {
        socket.binaryType = value as BinaryType;
      },
      onopen: null,
      onmessage: null,
      onerror: null,
      onclose: null,
      send(data) {
        recorder.recordMessage('relay', 'browser-to-relay', data);
        socket.send(ArrayBuffer.isView(data)
          ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength).slice()
          : data);
      },
      close(code, reason) {
        recorder.recordClose({ channel: 'relay', direction: 'browser-to-relay', kind: 'intent', code, reason });
        socket.close(code, reason);
      },
    };
    socket.onopen = () => wrapper.onopen?.();
    socket.onmessage = (event) => {
      const data = event.data as RelayInboundData;
      recorder.recordMessage('relay', 'relay-to-browser', data);
      wrapper.onmessage?.({ data });
    };
    socket.onerror = (event) => wrapper.onerror?.(event);
    socket.onclose = (event) => {
      recorder.recordClose({
        channel: 'relay',
        direction: 'relay-to-browser',
        kind: 'event',
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
      });
      wrapper.onclose?.({ code: event.code, reason: event.reason, wasClean: event.wasClean });
    };
    return wrapper;
  };
}