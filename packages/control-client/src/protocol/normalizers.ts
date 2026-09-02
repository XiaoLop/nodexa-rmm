import type { Device, DeviceGroup, GatewayEvent, UserInfo } from '../types';

type UnknownRecord = Record<string, unknown>;
export const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
export const stringValue = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

export function timestampValue(value: unknown): string | undefined {
  if (typeof value === 'string' && value.length > 0) {
    const numeric = Number(value);
    if (!Number.isNaN(numeric)) return timestampValue(numeric);
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? undefined : new Date(parsed).toISOString();
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return undefined;
  return new Date(value < 1_000_000_000_000 ? value * 1000 : value).toISOString();
}

export function normalizeDevice(
  value: unknown,
  fallbackId?: string,
  fallbackGroupId?: string,
): Device | undefined {
  if (!isRecord(value)) return undefined;
  const id =
    stringValue(value._id) ?? stringValue(value.id) ?? stringValue(value.nodeid) ?? fallbackId;
  if (!id) return undefined;
  let online: boolean | undefined;
  if (typeof value.online === 'boolean') online = value.online;
  else if (typeof value.conn === 'number') online = value.conn > 0;
  else if (typeof value.pwr === 'number') online = value.pwr > 0;
  let agentVersion = stringValue(value.agentVersion) ?? stringValue(value.agentvers);
  if (
    !agentVersion &&
    isRecord(value.agent) &&
    (typeof value.agent.ver === 'number' || typeof value.agent.ver === 'string')
  ) {
    agentVersion = String(value.agent.ver);
  }
  return {
    id,
    name: stringValue(value.name) ?? stringValue(value.rname) ?? stringValue(value.host) ?? id,
    groupId: stringValue(value.groupId) ?? stringValue(value.meshid) ?? fallbackGroupId,
    groupName: stringValue(value.groupName) ?? stringValue(value.meshname),
    online: online as boolean,
    agentVersion,
    platform: stringValue(value.platform) ?? stringValue(value.osdesc),
    lastSeenAt: timestampValue(value.lastSeenAt) ?? timestampValue(value.lastconnect),
    raw: value,
  };
}

export function normalizeDevices(value: unknown): Device[] {
  if (Array.isArray(value))
    return value
      .map((item) => normalizeDevice(item))
      .filter((item): item is Device => Boolean(item));
  if (!isRecord(value)) return [];
  const result: Device[] = [];
  for (const [key, item] of Object.entries(value)) {
    if (Array.isArray(item)) {
      for (const nested of item) {
        const device = normalizeDevice(nested, undefined, key);
        if (device) result.push(device);
      }
    } else {
      const device = normalizeDevice(item, key);
      if (device) result.push(device);
    }
  }
  return result;
}

export function normalizeGroup(value: unknown, fallbackId?: string): DeviceGroup | undefined {
  if (!isRecord(value)) return undefined;
  const id =
    stringValue(value._id) ?? stringValue(value.id) ?? stringValue(value.meshid) ?? fallbackId;
  if (!id) return undefined;
  return {
    id,
    name: stringValue(value.name) ?? stringValue(value.meshname) ?? id,
    description: stringValue(value.description) ?? stringValue(value.desc),
    raw: value,
  };
}

export function normalizeGroups(value: unknown): DeviceGroup[] {
  if (Array.isArray(value))
    return value
      .map((item) => normalizeGroup(item))
      .filter((item): item is DeviceGroup => Boolean(item));
  if (!isRecord(value)) return [];
  return Object.entries(value)
    .map(([key, item]) => normalizeGroup(item, key))
    .filter((item): item is DeviceGroup => Boolean(item));
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

function eventId(raw: UnknownRecord, action: string, deviceId?: string): string {
  const serverId = stringValue(raw.id) ?? stringValue(raw._id) ?? stringValue(raw.eventid);
  if (serverId) return serverId;

  const fingerprint = stableValue([
    action,
    deviceId ?? null,
    stringValue(raw.userid) ?? stringValue(raw.user) ?? null,
    raw.time ?? raw.occurredAt ?? null,
    raw.msgid ?? null,
    raw.msgArgs ?? null,
  ]);
  let hash = 0x811c9dc5;
  for (let index = 0; index < fingerprint.length; index += 1) {
    hash ^= fingerprint.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `event-${(hash >>> 0).toString(36)}`;
}

export function normalizeEvent(value: unknown): GatewayEvent | undefined {
  if (!isRecord(value)) return undefined;
  const raw = isRecord(value.event) ? value.event : value;
  const action = stringValue(raw.action) ?? 'unknown';
  const deviceId = stringValue(raw.deviceId) ?? stringValue(raw.nodeid);
  const node = isRecord(raw.node) ? raw.node : undefined;
  const conn =
    typeof raw.conn === 'number' ? raw.conn : typeof raw.pwr === 'number' ? raw.pwr : undefined;
  let type: GatewayEvent['type'] = 'unknown';
  if (action === 'nodeconnect' || action === 'connect' || action === 'connected')
    type = conn !== undefined && conn <= 0 ? 'deviceOffline' : 'deviceOnline';
  else if (action === 'nodedisconnect' || action === 'disconnect' || action === 'disconnected')
    type = 'deviceOffline';
  else if (action === 'changenode') type = 'deviceChanged';
  else if (action === 'removenode' || action === 'deletenode') type = 'deviceRemoved';
  else if (action === 'relaylog' || raw.etype === 'relay') type = 'relayLog';
  else if (action === 'agentlog') type = 'agentLog';
  else if (action === 'manual') type = 'manualOperation';
  else if (action === 'runcommands') type = 'commandExecution';
  else if (action === 'batchupload') type = 'batchUpload';
  else if (action === 'wssessioncount') type = 'userSessionCount';
  return {
    id: eventId(raw, action, deviceId),
    type,
    action,
    deviceId,
    deviceName: stringValue(raw.deviceName) ?? stringValue(raw.nodename) ?? stringValue(node?.name),
    user:
      stringValue(raw.username) ??
      stringValue(raw.user) ??
      stringValue(raw.userid)?.replace(/^user\/\//, ''),
    ip: stringValue(raw.ip) ?? stringValue(raw.remoteaddr),
    message: stringValue(raw.message) ?? stringValue(raw.msg),
    occurredAt:
      timestampValue(raw.occurredAt) ?? timestampValue(raw.time) ?? new Date().toISOString(),
    raw,
  };
}

export function normalizeUserInfo(value: unknown): UserInfo | undefined {
  if (!isRecord(value)) return undefined;
  const raw = isRecord(value.userinfo) ? value.userinfo : value;
  const id = stringValue(raw._id) ?? stringValue(raw.id) ?? stringValue(raw.userid);
  if (!id) return undefined;
  return {
    id,
    name:
      stringValue(raw.name) ??
      stringValue(raw.username) ??
      id.replace(/^user\/\/[^/]*\//, '').replace(/^user\/\//, ''),
    email: stringValue(raw.email),
    siteadmin: typeof raw.siteadmin === 'number' ? raw.siteadmin : undefined,
    creationAt: timestampValue(raw.creation),
    lastLoginAt: timestampValue(raw.login),
    lastAccessAt: timestampValue(raw.access),
    previousLoginAt: timestampValue(raw.pastlogin),
    language: stringValue(raw.llang),
    raw,
  };
}

export function normalizeLastConnects(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  const result: Record<string, string> = {};
  for (const [deviceId, raw] of Object.entries(value)) {
    const timestamp = timestampValue(raw);
    if (timestamp) result[deviceId] = timestamp;
  }
  return result;
}
