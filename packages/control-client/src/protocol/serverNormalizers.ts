import { MeshCentralProtocolError } from '../errors';
import type { ServerConsoleOutput, ServerErrorLog, ServerTrace } from '../types';
import { isRecord } from './normalizers';

export function normalizeServerConsoleOutput(payload: unknown): ServerConsoleOutput | undefined {
  if (
    !isRecord(payload) ||
    payload.action !== 'serverconsole' ||
    typeof payload.value !== 'string' ||
    (payload.tag !== undefined && typeof payload.tag !== 'string')
  )
    return undefined;
  return {
    text: payload.value,
    ...(payload.tag === undefined ? {} : { tag: payload.tag }),
    receivedAt: Date.now(),
  };
}

export function normalizeTraceSources(payload: unknown): readonly string[] | undefined {
  if (!isRecord(payload)) return undefined;
  const record = payload.action === 'event' && isRecord(payload.event) ? payload.event : payload;
  if (record.action !== 'traceinfo') return undefined;
  if (record.traceSources === null) return Object.freeze([]);
  if (
    !Array.isArray(record.traceSources) ||
    !record.traceSources.every((source): source is string => typeof source === 'string')
  )
    return undefined;
  return Object.freeze([...record.traceSources]);
}

export function normalizeServerTrace(payload: unknown): ServerTrace | undefined {
  if (
    !isRecord(payload) ||
    payload.action !== 'trace' ||
    typeof payload.source !== 'string' ||
    !Array.isArray(payload.args) ||
    typeof payload.time !== 'number' ||
    !Number.isFinite(payload.time)
  )
    return undefined;
  return { source: payload.source, args: [...payload.args], time: payload.time };
}

export function normalizeServerErrorLog(payload: unknown): ServerErrorLog {
  if (
    !isRecord(payload) ||
    payload.action !== 'servererrors' ||
    ('data' in payload && typeof payload.data !== 'string')
  ) {
    throw new MeshCentralProtocolError('Invalid server error log response.', {
      action: 'servererrors',
      response: payload,
    });
  }
  return 'data' in payload ? { content: payload.data as string } : {};
}
