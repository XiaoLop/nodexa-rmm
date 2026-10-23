import type { Device, DeviceGroup, MeshCentralEvent } from '@meshcentral/control-client';

export interface DeviceSummary {
  readonly id: string;
  readonly name: string;
  readonly online: boolean;
  readonly groupId?: string;
  readonly groupName?: string;
  readonly platform?: string;
  readonly agentVersion?: string;
  readonly lastSeenAt?: string;
}

export interface GroupSummary {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly deviceCount?: number;
  readonly onlineCount?: number;
}

export interface EventSummary {
  readonly id: string;
  readonly type: string;
  readonly occurredAt: string;
  readonly action?: string;
  readonly entityType?: string;
  readonly deviceId?: string;
  readonly deviceName?: string;
  readonly user?: string;
  readonly ip?: string;
  readonly message?: string;
}

export interface BudgetResult {
  readonly value: unknown;
  readonly truncated: boolean;
}

const REDACTED_KEY = 'raw';
const STRING_LIMIT = 256;

export function stripRaw<T>(value: T): T {
  return stripValue(value, new WeakSet<object>()) as T;
}

export function projectDevice(device: Device): DeviceSummary {
  return {
    id: device.id,
    name: device.name,
    online: device.online,
    ...(device.groupId ? { groupId: device.groupId } : {}),
    ...(device.groupName ? { groupName: device.groupName } : {}),
    ...(device.platform ? { platform: device.platform } : {}),
    ...(device.agentVersion ? { agentVersion: device.agentVersion } : {}),
    ...(device.lastSeenAt ? { lastSeenAt: device.lastSeenAt } : {}),
  };
}

export function projectGroup(group: DeviceGroup, counts?: { total: number; online: number }): GroupSummary {
  return {
    id: group.id,
    name: group.name,
    ...(group.description ? { description: group.description } : {}),
    ...(counts === undefined ? {} : { deviceCount: counts.total, onlineCount: counts.online }),
  };
}

export function projectEvent(event: MeshCentralEvent): EventSummary {
  return {
    id: event.id,
    type: event.type,
    occurredAt: event.occurredAt,
    ...(event.action ? { action: event.action } : {}),
    ...(event.entityType ? { entityType: event.entityType } : {}),
    ...(event.deviceId ? { deviceId: event.deviceId } : {}),
    ...(event.deviceName ? { deviceName: event.deviceName } : {}),
    ...(event.user ? { user: event.user } : {}),
    ...(event.ip ? { ip: event.ip } : {}),
    ...(event.message ? { message: event.message } : {}),
  };
}

export function pickFields(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const source = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    const item = source[key];
    if (item === undefined || item === null) continue;
    result[key] = item;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

export function fitToBudget(value: unknown, maxBytes: number): BudgetResult {
  if (byteSize(value) <= maxBytes) return { value, truncated: false };

  let candidate: unknown = value;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    candidate = shrink(candidate);
    if (byteSize(candidate) <= maxBytes) return { value: candidate, truncated: true };
  }

  return {
    value: {
      truncated: true,
      note: 'The result exceeded the response budget and was discarded.',
    },
    truncated: true,
  };
}

function stripValue(value: unknown, seen: WeakSet<object>): unknown {
  if (Array.isArray(value)) return value.map((item) => stripValue(item, seen));
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return undefined;
  seen.add(value);

  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (key === REDACTED_KEY) continue;
    result[key] = stripValue(item, seen);
  }
  return result;
}

function shrink(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.length > STRING_LIMIT ? `${value.slice(0, STRING_LIMIT)}...` : value;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return value;
    const keep = Math.max(1, Math.floor(value.length / 2));
    return value.slice(0, keep).map(shrink);
  }
  if (value === null || typeof value !== 'object') return value;

  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    result[key] = shrink(item);
  }
  return result;
}

function byteSize(value: unknown): number {
  try {
    const serialized = JSON.stringify(value);
    return serialized === undefined ? 0 : Buffer.byteLength(serialized, 'utf8');
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}
