import type {
  Device,
  DeviceGroup,
  GatewayEvent,
  GatewayMutation,
  GatewayProtocolAdapter,
} from './types';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function booleanValue(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeDevice(value: unknown, fallbackId?: string): Device | undefined {
  if (!isRecord(value)) return undefined;
  const id = stringValue(value.id) ?? stringValue(value.nodeid) ?? fallbackId;
  if (!id) return undefined;

  const connectionState = typeof value.conn === 'number' ? value.conn : 0;
  return {
    id,
    name: stringValue(value.name) ?? stringValue(value.host) ?? id,
    groupId: stringValue(value.groupId) ?? stringValue(value.meshid),
    groupName: stringValue(value.groupName) ?? stringValue(value.meshname),
    online: booleanValue(value.online, connectionState > 0),
    agentVersion: stringValue(value.agentVersion) ?? stringValue(value.agentvers),
    platform: stringValue(value.platform) ?? stringValue(value.osdesc),
    lastSeenAt: stringValue(value.lastSeenAt) ?? stringValue(value.lastconnect),
    raw: value,
  };
}

function normalizeGroup(value: unknown, fallbackId?: string): DeviceGroup | undefined {
  if (!isRecord(value)) return undefined;
  const id = stringValue(value.id) ?? stringValue(value.meshid) ?? fallbackId;
  if (!id) return undefined;
  return {
    id,
    name: stringValue(value.name) ?? stringValue(value.meshname) ?? id,
    description: stringValue(value.description) ?? stringValue(value.desc),
    raw: value,
  };
}

function normalizeList<T>(
  value: unknown,
  normalizer: (item: unknown, fallbackId?: string) => T | undefined,
): T[] {
  if (Array.isArray(value)) {
    return value.map((item) => normalizer(item)).filter((item): item is T => Boolean(item));
  }
  if (isRecord(value)) {
    return Object.entries(value)
      .flatMap(([key, item]) =>
        Array.isArray(item) ? item.map((nested) => normalizer(nested)) : [normalizer(item, key)],
      )
      .filter((item): item is T => Boolean(item));
  }
  return [];
}

function eventId(action: string, deviceId?: string): string {
  return `${action}-${deviceId ?? 'global'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeEvent(raw: UnknownRecord): GatewayEvent {
  const action = stringValue(raw.action) ?? 'unknown';
  const deviceId = stringValue(raw.deviceId) ?? stringValue(raw.nodeid);
  const eventType =
    action === 'nodeconnect'
      ? 'deviceOnline'
      : action === 'nodedisconnect'
        ? 'deviceOffline'
        : action === 'changenode'
          ? 'deviceChanged'
          : action === 'removenode' || action === 'deletenode'
            ? 'deviceRemoved'
            : 'unknown';

  return {
    id: stringValue(raw.id) ?? eventId(action, deviceId),
    type: eventType,
    deviceId,
    message: stringValue(raw.message) ?? stringValue(raw.msg),
    occurredAt: stringValue(raw.occurredAt) ?? stringValue(raw.time) ?? new Date().toISOString(),
    raw,
  };
}

function decodeEvent(raw: UnknownRecord): GatewayMutation[] {
  const event = normalizeEvent(raw);
  if (!event.deviceId) return [{ type: 'eventReceived', event }];

  if (event.type === 'deviceRemoved') {
    return [{ type: 'deviceRemoved', deviceId: event.deviceId, event }];
  }

  if (event.type === 'deviceOnline' || event.type === 'deviceOffline') {
    const device = normalizeDevice(raw.node ?? raw.device, event.deviceId);
    return device
      ? [
          {
            type: 'deviceUpserted',
            device: { ...device, online: event.type === 'deviceOnline' },
            event,
          },
        ]
      : [
          {
            type: 'deviceStatusChanged',
            deviceId: event.deviceId,
            online: event.type === 'deviceOnline',
            event,
          },
        ];
  }

  if (event.type === 'deviceChanged') {
    const device = normalizeDevice(raw.node ?? raw.device, event.deviceId);
    return device
      ? [{ type: 'deviceUpserted', device, event }]
      : [{ type: 'eventReceived', event }];
  }

  return [{ type: 'eventReceived', event }];
}

export const meshCentralGatewayAdapter: GatewayProtocolAdapter = {
  decode(payload) {
    if (!isRecord(payload)) return [];

    if (payload.type === 'snapshot' || payload.action === 'snapshot') {
      return [
        {
          type: 'snapshot',
          snapshot: {
            devices: normalizeList(payload.devices ?? payload.nodes, normalizeDevice),
            groups: normalizeList(payload.groups ?? payload.meshes, normalizeGroup),
          },
        },
      ];
    }

    if (payload.type === 'devices' || payload.action === 'nodes') {
      return [
        {
          type: 'devicesReplaced',
          devices: normalizeList(payload.devices ?? payload.nodes, normalizeDevice),
        },
      ];
    }

    if (payload.type === 'groups' || payload.action === 'meshes') {
      return [
        {
          type: 'groupsReplaced',
          groups: normalizeList(payload.groups ?? payload.meshes, normalizeGroup),
        },
      ];
    }

    const rawEvent = isRecord(payload.event)
      ? payload.event
      : payload.type === 'event'
        ? payload
        : undefined;
    return rawEvent ? decodeEvent(rawEvent) : [];
  },
  createAuthenticationMessage: (token) => ({ type: 'authenticate', token }),
  createSnapshotRequest: () => ({ type: 'request', resource: 'snapshot' }),
  createHeartbeatMessage: () => ({ type: 'ping' }),
};
