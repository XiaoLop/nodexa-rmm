import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type {
  RelayInboundData,
  RelayOutboundData,
  RelayWebSocketLike,
} from '@meshcentral/relay';
import type { WebSocketLike } from '@meshcentral/control-client';

export type CaptureScenario = 'terminal' | 'permission-denied' | 'relaylog';

export interface CaptureEntry {
  elapsedMs: number;
  channel: 'gateway' | 'relay' | 'event' | 'result';
  direction?: 'client-to-server' | 'server-to-client';
  kind: string;
  data?: unknown;
}

const SECRET_KEYS = /^(?:password|token|accessToken|authorization|cookie|rcookie|auth|rauth|x-meshauth)$/i;
const ID_KEYS = /^(?:_id|id|nodeid|meshid|userid|relayid|sessionid|responseid|deviceId|userId)$/i;
const PRIVATE_KEYS = /^(?:name|rname|username|user|users|lusers|email|ip|remoteaddr|host|hostname|mpsname|magenturl|tlshash|agentCertHash|msg|msgArgs)$/i;

function stableAlias(value: string): string {
  return `redacted-${createHash('sha256').update(value).digest('hex').slice(0, 10)}`;
}

function sanitizedUrl(value: string): string {
  try {
    const absolute = /^(?:wss?|https?):\/\//i.test(value);
    const url = new URL(value, 'https://capture.invalid');
    for (const key of [
      'auth',
      'rauth',
      'x-meshauth',
      'token',
      'access_token',
      'id',
      'nodeid',
      'meshid',
      'userid',
    ]) {
      if (url.searchParams.has(key)) url.searchParams.set(key, '<redacted>');
    }
    return absolute ? url.toString() : `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '<redacted-url>';
  }
}

function sanitizeString(value: string, key: string): string {
  if (ID_KEYS.test(key)) return stableAlias(value);
  if (/^(?:wss?|https?):\/\//i.test(value) || /[?&](?:auth|rauth|x-meshauth|token|access_token)=/i.test(value)) {
    return sanitizedUrl(value);
  }
  return value.replace(
    /((?:auth|rauth|x-meshauth|token|access_token)=)[^&\s]+/gi,
    '$1<redacted>',
  );
}

export function sanitize(value: unknown, key = ''): unknown {
  if (SECRET_KEYS.test(key)) return '<redacted>';
  if (PRIVATE_KEYS.test(key)) return '<redacted>';
  if (typeof value === 'string') return sanitizeString(value, key);
  if (Array.isArray(value)) return value.map((item) => sanitize(item));
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => {
        const safeKey = /^(?:node|mesh|user|ugrp)\/\//i.test(entryKey)
          ? stableAlias(entryKey)
          : entryKey;
        return [safeKey, sanitize(entryValue, entryKey)];
      }),
    );
  }
  return value;
}

function byteLength(data: RelayInboundData | RelayOutboundData): number {
  if (typeof data === 'string') return new TextEncoder().encode(data).byteLength;
  if (data instanceof ArrayBuffer) return data.byteLength;
  if (ArrayBuffer.isView(data)) return data.byteLength;
  return data.size;
}

function summarizeFrame(data: RelayInboundData | RelayOutboundData): unknown {
  if (typeof data !== 'string') {
    return { frameType: 'binary', byteLength: byteLength(data) };
  }
  try {
    return {
      frameType: 'text',
      byteLength: byteLength(data),
      payload: sanitize(JSON.parse(data)),
    };
  } catch {
    return {
      frameType: 'text',
      byteLength: byteLength(data),
      payload: data === 'c' || data === 'cr' || data === '1' ? data : '<terminal-text-redacted>',
    };
  }
}

export class CaptureRecorder {
  private readonly startedAt = Date.now();
  readonly entries: CaptureEntry[] = [];

  add(entry: Omit<CaptureEntry, 'elapsedMs'>): void {
    this.entries.push({ elapsedMs: Date.now() - this.startedAt, ...entry });
  }

  frame(
    channel: 'gateway' | 'relay',
    direction: 'client-to-server' | 'server-to-client',
    data: RelayInboundData | RelayOutboundData,
  ): void {
    this.add({ channel, direction, kind: 'frame', data: summarizeFrame(data) });
  }

  async write(scenario: CaptureScenario): Promise<string> {
    const directory = resolve(process.env.MANUAL_CAPTURE_DIR || 'captures');
    await mkdir(directory, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const path = resolve(directory, `${timestamp}-${scenario}.json`);
    const document = {
      schemaVersion: 1,
      scenario,
      capturedAt: new Date().toISOString(),
      environment: {
        meshcentralVersion: process.env.MESH_VERSION || 'unknown',
        agentVersion: process.env.MESH_AGENT_VERSION || 'unknown',
        platform: process.env.MESH_DEVICE_PLATFORM || 'unknown',
        shell: process.env.MESH_SHELL || 'unknown',
      },
      entries: this.entries,
    };
    await writeFile(path, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
    return path;
  }
}

export function controlUrl(): string {
  const base = requiredEnvironment('GATEWAY_WS_URL');
  const meshAuth = process.env.GATEWAY_MESHAUTH?.trim();
  if (!meshAuth) return base;
  return `${base}${base.includes('?') ? '&' : '?'}x-meshauth=${meshAuth}`;
}

export function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function environmentNumber(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export function wait(milliseconds: number): Promise<void> {
  return new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));
}

export function createGatewayWebSocketFactory(recorder: CaptureRecorder): (url: string) => WebSocketLike {
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
        recorder.frame('gateway', 'client-to-server', data);
        socket.send(data);
      },
      close(code, reason) {
        recorder.add({ channel: 'gateway', direction: 'client-to-server', kind: 'close-intent', data: { code, reason } });
        socket.close(code, reason);
      },
    };
    socket.onopen = () => wrapper.onopen?.();
    socket.onmessage = (event) => {
      const data = typeof event.data === 'string' ? event.data : String(event.data);
      recorder.frame('gateway', 'server-to-client', data);
      wrapper.onmessage?.({ data });
    };
    socket.onerror = (event) => wrapper.onerror?.(event);
    socket.onclose = (event) => {
      recorder.add({ channel: 'gateway', direction: 'server-to-client', kind: 'close', data: { code: event.code, reason: event.reason, wasClean: event.wasClean } });
      wrapper.onclose?.({ code: event.code, reason: event.reason });
    };
    return wrapper;
  };
}

export function createRelayWebSocketFactory(recorder: CaptureRecorder): (url: string) => RelayWebSocketLike {
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
        recorder.frame('relay', 'client-to-server', data);
        if (ArrayBuffer.isView(data)) {
          socket.send(new Uint8Array(data.buffer, data.byteOffset, data.byteLength).slice());
        } else {
          socket.send(data);
        }
      },
      close(code, reason) {
        recorder.add({ channel: 'relay', direction: 'client-to-server', kind: 'close-intent', data: { code, reason } });
        socket.close(code, reason);
      },
    };
    socket.onopen = () => wrapper.onopen?.();
    socket.onmessage = (event) => {
      const data = event.data as RelayInboundData;
      recorder.frame('relay', 'server-to-client', data);
      wrapper.onmessage?.({ data });
    };
    socket.onerror = (event) => wrapper.onerror?.(event);
    socket.onclose = (event) => {
      recorder.add({ channel: 'relay', direction: 'server-to-client', kind: 'close', data: { code: event.code, reason: event.reason, wasClean: event.wasClean } });
      wrapper.onclose?.({ code: event.code, reason: event.reason, wasClean: event.wasClean });
    };
    return wrapper;
  };
}

export function resemblesRelayLog(value: unknown): boolean {
  try {
    return /relaylog|relayLog/i.test(JSON.stringify(value));
  } catch {
    return false;
  }
}

export interface TunnelRouteResult {
  responseId?: string;
  result: string;
  failed: boolean;
}

export function tunnelRouteResult(value: unknown): TunnelRouteResult | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const message = value as Record<string, unknown>;
  if (message.action !== 'msg' || typeof message.result !== 'string') return undefined;
  return {
    responseId: typeof message.responseid === 'string' ? message.responseid : undefined,
    result: message.result,
    failed: /unable to route|not found|offline|denied|permission/i.test(message.result),
  };
}