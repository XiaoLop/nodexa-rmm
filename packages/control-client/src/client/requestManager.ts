import {
  MeshCentralConnectionClosedError,
  MeshCentralRequestTimeoutError,
  MeshCentralServerError,
} from '../errors';
import type { MeshCentralDiagnostic } from '../types';
import { isRecord } from '../protocol/normalizers';

interface PendingRequest {
  id: string;
  resolve: (payload: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  action?: string;
  deviceId?: string;
  tag?: string;
}

const RESPONSE_ID_OPTIONAL_ACTIONS = new Set([
  'authcookie',
  'events',
  'getDeviceDetails',
  'meshes',
  'poweraction',
  'previousLogins',
  'report',
  'servertimelinestats',
  'usergroups',
  'users',
  'wakedevices',
  'wssessioncount',
]);

function isSuccessfulResult(action: string | undefined, result: string) {
  const normalized = result.toLowerCase();
  if (normalized === 'ok' || normalized === 'success') return true;
  return action === 'wakedevices' && /^used \d+ device\(s\) to send wake packets$/i.test(result);
}

export class RequestManager {
  private readonly pending = new Map<string, PendingRequest>();
  private readonly responseIdOptionalChains = new Map<string, Promise<void>>();

  constructor(
    private readonly send: (payload: unknown) => void,
    private readonly defaultTimeoutMs: number,
    private readonly diagnostic: (value: MeshCentralDiagnostic) => void,
  ) {}

  request<T>(payload: Record<string, unknown>, timeoutMs = this.defaultTimeoutMs): Promise<T> {
    if (typeof payload.action === 'string' && RESPONSE_ID_OPTIONAL_ACTIONS.has(payload.action))
      return this.requestSequentially<T>(payload, timeoutMs);
    return this.requestNow<T>(payload, timeoutMs);
  }

  consume(payload: unknown): boolean {
    if (!isRecord(payload)) return false;
    const nested = [payload.data, payload.payload, payload.message, payload.event].find(isRecord);
    const isEventEnvelope = payload.action === 'event' && nested !== undefined;
    const record =
      !isEventEnvelope &&
      (typeof payload.action === 'string' || typeof payload.responseid === 'string')
        ? payload
        : (nested ?? payload);
    const responseId = typeof record.responseid === 'string' ? record.responseid : undefined;
    const tag = typeof record.tag === 'string' ? record.tag : undefined;
    let match = responseId ? this.pending.get(responseId) : undefined;
    if (!match && tag)
      match = [...this.pending.values()].find(
        (candidate) => candidate.id === tag || candidate.tag === tag,
      );

    const action =
      typeof record.action === 'string'
        ? record.action
        : typeof record.cookie === 'string' && typeof record.rcookie === 'string'
          ? 'authcookie'
          : undefined;
    if (!match && action) {
      const node = isRecord(record.node) ? record.node : undefined;
      const deviceId =
        typeof record.nodeid === 'string'
          ? record.nodeid
          : typeof node?._id === 'string'
            ? node._id
            : undefined;
      const matches = [...this.pending.values()].filter(
        (candidate) =>
          candidate.action === action &&
          (!deviceId || !candidate.deviceId || candidate.deviceId === deviceId),
      );
      if (matches.length === 1) match = matches[0];
      else if (matches.length > 1) {
        this.diagnostic({
          type: 'unmatched-response',
          message: `Ambiguous response for ${action}.`,
          payload,
        });
        return false;
      }
    }
    if (!match) return false;
    clearTimeout(match.timer);
    this.pending.delete(match.id);
    const explicitError = record.error ?? record.err;
    const resultError =
      typeof record.result === 'string' &&
      record.result &&
      !isSuccessfulResult(action, record.result)
        ? record.result
        : undefined;
    const error = explicitError ?? resultError;
    if (typeof error === 'string' && error)
      match.reject(
        new MeshCentralServerError(error, {
          action: match.action,
          requestId: match.id,
          deviceId: match.deviceId,
          response: payload,
        }),
      );
    else match.resolve(record);
    return true;
  }

  rejectAll(reason = 'MeshCentral control connection closed.'): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(
        new MeshCentralConnectionClosedError(reason, {
          action: pending.action,
          requestId: pending.id,
          deviceId: pending.deviceId,
          retryable: true,
        }),
      );
    }
    this.pending.clear();
  }

  private requestSequentially<T>(payload: Record<string, unknown>, timeoutMs: number): Promise<T> {
    const action = String(payload.action);
    const previous = this.responseIdOptionalChains.get(action) ?? Promise.resolve();
    const request = previous.then(() => this.requestNow<T>(payload, timeoutMs));
    this.responseIdOptionalChains.set(
      action,
      request.then(
        () => undefined,
        () => undefined,
      ),
    );
    return request;
  }

  private requestNow<T>(payload: Record<string, unknown>, timeoutMs: number): Promise<T> {
    const id =
      typeof payload.responseid === 'string' && payload.responseid
        ? payload.responseid
        : `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(
          new MeshCentralRequestTimeoutError(
            `Gateway request timed out: ${String(payload.action ?? id)}`,
            {
              action: typeof payload.action === 'string' ? payload.action : undefined,
              requestId: id,
              deviceId: typeof payload.nodeid === 'string' ? payload.nodeid : undefined,
              retryable: true,
            },
          ),
        );
      }, timeoutMs);
      this.pending.set(id, {
        id,
        resolve: (value) => resolve(value as T),
        reject,
        timer,
        action: typeof payload.action === 'string' ? payload.action : undefined,
        deviceId: typeof payload.nodeid === 'string' ? payload.nodeid : undefined,
        tag: typeof payload.tag === 'string' ? payload.tag : undefined,
      });
      try {
        this.send({ ...payload, responseid: id });
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error instanceof Error ? error : new Error('Gateway request failed.'));
      }
    });
  }
}
