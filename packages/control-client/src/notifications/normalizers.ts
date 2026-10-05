import type {
  DeviceSessions,
  MeshCentralNotification,
  NotificationSeverity,
  NotificationSource,
  RecordingReady,
  ServerWarning,
} from './types';
import { isRecord, stringValue, timestampValue } from '../protocol/normalizers';

type UnknownRecord = Record<string, unknown>;

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function stableValue(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return `[${value.map(stableValue).join(',')}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableValue(value[key])}`)
      .join(',')}}`;
  }
  return String(value);
}

function fingerprint(parts: unknown[]): string {
  const value = stableValue(parts);
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `notification-${(hash >>> 0).toString(36)}`;
}

function notificationId(raw: UnknownRecord, source: NotificationSource): string {
  const serverId = raw.id;
  if (typeof serverId === 'string' && serverId) return serverId;
  if (typeof serverId === 'number' && Number.isFinite(serverId)) return String(serverId);
  return fingerprint([
    source,
    raw.nodeid ?? null,
    raw.userid ?? null,
    raw.time ?? null,
    raw.titleid ?? null,
    raw.msgid ?? null,
    raw.msgArgs ?? raw.args ?? null,
    raw.title ?? null,
    raw.value ?? raw.msg ?? null,
  ]);
}

function notificationSeverity(source: NotificationSource, messageId?: number): NotificationSeverity {
  if (source === 'help-request' || source === 'chat-request') return 'warning';
  if (source === 'security') return messageId === 12 ? 'warning' : 'info';
  return 'info';
}

function notificationSource(raw: UnknownRecord, envelope: UnknownRecord): NotificationSource | undefined {
  if (raw.action === 'agentlog' && raw.msgid === 98) return 'help-request';
  if (envelope.action === 'msg' && envelope.type === 'notify') {
    const tag = stringValue(envelope.tag);
    if (envelope.msgid === 11 || tag?.startsWith('meshmessenger/')) return 'chat-request';
    if (envelope.msgid === 12) return 'security';
    return 'msg-notify';
  }
  if (envelope.action === 'event' && raw.action === 'notify') return 'event-notify';
  return undefined;
}

export function normalizeNotification(value: unknown): MeshCentralNotification | undefined {
  if (!isRecord(value)) return undefined;
  const raw = isRecord(value.event) ? value.event : value;
  const source = notificationSource(raw, value);
  if (!source) return undefined;
  const messageId = finiteNumber(raw.msgid);
  const args = Array.isArray(raw.args)
    ? raw.args
    : Array.isArray(raw.msgArgs)
      ? raw.msgArgs
      : undefined;
  return {
    id: notificationId(raw, source),
    source,
    title: stringValue(raw.title),
    message: stringValue(raw.value) ?? stringValue(raw.msg) ?? stringValue(raw.message),
    titleId: finiteNumber(raw.titleid),
    messageId,
    args,
    tag: stringValue(raw.tag),
    icon:
      typeof raw.icon === 'string' || typeof raw.icon === 'number' ? raw.icon : undefined,
    deviceId: stringValue(raw.nodeid) ?? stringValue(raw.deviceId),
    groupId: stringValue(raw.meshid) ?? stringValue(raw.groupId),
    userId: stringValue(raw.userid) ?? stringValue(raw.userId),
    username: stringValue(raw.username),
    sessionId: stringValue(raw.sessionid) ?? stringValue(raw.sessionId),
    targetUrl: stringValue(raw.url) ?? stringValue(raw.targetUrl),
    maxTimeSeconds: finiteNumber(raw.maxtime),
    occurredAt:
      timestampValue(raw.time) ?? timestampValue(raw.occurredAt) ?? new Date().toISOString(),
    severity: notificationSeverity(source, messageId),
    raw,
  };
}

export function normalizeServerWarnings(value: unknown): ServerWarning[] | undefined {
  if (!isRecord(value) || value.action !== 'serverwarnings' || !Array.isArray(value.warnings)) {
    return undefined;
  }
  return value.warnings.flatMap((warning) => {
    if (!isRecord(warning) || !Number.isInteger(warning.id)) return [];
    const message = stringValue(warning.msg) ?? stringValue(warning.message);
    if (!message) return [];
    return [{
      id: warning.id as number,
      message,
      args: Array.isArray(warning.args) ? warning.args : undefined,
      raw: warning,
    }];
  });
}

export function normalizeDeviceSessions(value: unknown): DeviceSessions | undefined {
  if (!isRecord(value)) return undefined;
  const raw = isRecord(value.event) ? value.event : value;
  if (raw.action !== 'devicesessions') return undefined;
  const deviceId = stringValue(raw.nodeid) ?? stringValue(raw.deviceId);
  if (!deviceId) return undefined;
  const sessions = isRecord(raw.sessions) ? raw.sessions : {};
  const rawHelp = isRecord(sessions.help) ? sessions.help : {};
  const help: Record<string, string> = {};
  for (const [username, request] of Object.entries(rawHelp)) {
    if (typeof request === 'string') help[username] = request;
  }
  return {
    deviceId,
    help,
    sessions,
    occurredAt:
      timestampValue(raw.time) ?? timestampValue(raw.occurredAt) ?? new Date().toISOString(),
    raw,
  };
}

export function normalizeRecordingReady(value: unknown): RecordingReady | undefined {
  if (!isRecord(value)) return undefined;
  const raw = isRecord(value.event) ? value.event : value;
  if (raw.action !== 'recording') return undefined;
  return {
    deviceId: stringValue(raw.nodeid) ?? stringValue(raw.deviceId),
    groupId: stringValue(raw.meshid) ?? stringValue(raw.groupId),
    deviceName: stringValue(raw.name) ?? stringValue(raw.nodename),
    filename: stringValue(raw.filename),
    protocol: finiteNumber(raw.protocol),
    sizeBytes: finiteNumber(raw.size),
    startedAt: timestampValue(raw.startTime),
    durationSeconds: finiteNumber(raw.lengthTime),
    occurredAt:
      timestampValue(raw.time) ?? timestampValue(raw.occurredAt) ?? new Date().toISOString(),
    raw,
  };
}