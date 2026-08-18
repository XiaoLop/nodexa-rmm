import type {
  Device,
  DeviceGroup,
  GatewayEvent,
  GatewayEventType,
  GatewayMutation,
  GatewayProtocolAdapter,
} from './types';
import { isIdString } from './utils';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function normalizeDevice(
  value: unknown,
  fallbackId?: string,
  fallbackGroupId?: string,
): Device | undefined {
  if (!isRecord(value)) return undefined;
  const id =
    stringValue(value._id) ??
    stringValue(value.id) ??
    stringValue(value.nodeid) ??
    fallbackId;
  if (!id) return undefined;

  let online: boolean | undefined;
  if (typeof value.online === 'boolean') {
    online = value.online;
  } else if (typeof value.conn === 'number') {
    online = value.conn > 0;
  } else if (typeof value.pwr === 'number') {
    online = value.pwr > 0;
  }

  let agentVersion = stringValue(value.agentVersion) ?? stringValue(value.agentvers);
  if (!agentVersion && isRecord(value.agent)) {
    const ver = value.agent.ver;
    if (typeof ver === 'number' || typeof ver === 'string') {
      agentVersion = String(ver);
    }
  }

  return {
    id,
    name: stringValue(value.name) ?? stringValue(value.rname) ?? stringValue(value.host) ?? id,
    groupId: stringValue(value.groupId) ?? stringValue(value.meshid) ?? fallbackGroupId,
    groupName: stringValue(value.groupName) ?? stringValue(value.meshname),
    online: online as boolean,
    agentVersion,
    platform: stringValue(value.platform) ?? stringValue(value.osdesc),
    lastSeenAt: stringValue(value.lastSeenAt) ?? stringValue(value.lastconnect),
    raw: value,
  };
}

function normalizeGroup(value: unknown, fallbackId?: string): DeviceGroup | undefined {
  if (!isRecord(value)) return undefined;
  const id =
    stringValue(value._id) ??
    stringValue(value.id) ??
    stringValue(value.meshid) ??
    fallbackId;
  if (!id) return undefined;
  return {
    id,
    name: stringValue(value.name) ?? stringValue(value.meshname) ?? id,
    description: stringValue(value.description) ?? stringValue(value.desc),
    raw: value,
  };
}

function normalizeDevicesList(value: unknown): Device[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeDevice(item))
      .filter((item): item is Device => Boolean(item));
  }
  if (isRecord(value)) {
    const result: Device[] = [];
    for (const [key, item] of Object.entries(value)) {
      if (Array.isArray(item)) {
        for (const nested of item) {
          const dev = normalizeDevice(nested, undefined, key);
          if (dev) result.push(dev);
        }
      } else {
        const dev = normalizeDevice(item, key);
        if (dev) result.push(dev);
      }
    }
    return result;
  }
  return [];
}

function normalizeGroupsList(value: unknown): DeviceGroup[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeGroup(item))
      .filter((item): item is DeviceGroup => Boolean(item));
  }
  if (isRecord(value)) {
    return Object.entries(value)
      .map(([key, item]) => normalizeGroup(item, key))
      .filter((item): item is DeviceGroup => Boolean(item));
  }
  return [];
}

function eventId(action: string, deviceId?: string): string {
  return `${action}-${deviceId ?? 'global'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeEvent(raw: UnknownRecord): GatewayEvent {
  const action = stringValue(raw.action) ?? 'unknown';
  const deviceId = stringValue(raw.deviceId) ?? stringValue(raw.nodeid);
  const nodeObj = isRecord(raw.node) ? raw.node : undefined;
  let deviceName = stringValue(raw.deviceName) ?? stringValue(raw.nodename) ?? (nodeObj ? stringValue(nodeObj.name) : undefined);
  if (deviceName && isIdString(deviceName)) {
    deviceName = undefined;
  }
  const user = stringValue(raw.username) ?? stringValue(raw.user) ?? stringValue(raw.userid)?.replace(/^user\/\//, '');
  const ip = stringValue(raw.ip) ?? stringValue(raw.remoteaddr);
  const conn = typeof raw.conn === 'number' ? raw.conn : (typeof raw.pwr === 'number' ? raw.pwr : undefined);

  let eventType: GatewayEventType = 'unknown';

  if (action === 'nodeconnect' || action === 'connect' || action === 'connected') {
    eventType = conn !== undefined && conn <= 0 ? 'deviceOffline' : 'deviceOnline';
  } else if (action === 'nodedisconnect' || action === 'disconnect' || action === 'disconnected') {
    eventType = 'deviceOffline';
  } else if (action === 'changenode') {
    eventType = 'deviceChanged';
  } else if (action === 'removenode' || action === 'deletenode') {
    eventType = 'deviceRemoved';
  } else if (action === 'relaylog' || raw.etype === 'relay') {
    eventType = 'relayLog';
  } else if (action === 'agentlog') {
    eventType = 'agentLog';
  } else if (action === 'wssessioncount') {
    eventType = 'userSessionCount';
  }

  return {
    id: stringValue(raw.id) ?? eventId(action, deviceId),
    type: eventType,
    deviceId,
    deviceName,
    user,
    ip,
    message: stringValue(raw.message) ?? stringValue(raw.msg),
    occurredAt: stringValue(raw.occurredAt) ?? stringValue(raw.time) ?? new Date().toISOString(),
    raw,
  };
}

function decodeEvent(raw: UnknownRecord): GatewayMutation[] {
  const innerEvent = isRecord(raw.event) ? raw.event : undefined;
  const action = stringValue(innerEvent?.action) ?? stringValue(raw.action);
  const etype = stringValue(innerEvent?.etype) ?? stringValue(raw.etype);
  if (action === 'ifchange' || etype === 'ifchange') return [];

  const event = normalizeEvent(raw);
  if (event.type === 'unknown') return [];

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
      ? [{ type: 'deviceUpserted', device }]
      : [];
  }

  return [{ type: 'eventReceived', event }];
}

export const meshCentralGatewayAdapter: GatewayProtocolAdapter = {
  requiredConnectionSignals: ['serverinfo', 'userinfo', 'traceinfo', 'serverwarnings'],
  inspectConnectionMessage(payload) {
    if (!isRecord(payload)) return { status: 'pending' };

    const action = stringValue(payload.action);
    const type = stringValue(payload.type);
    if (action === 'close' || type === 'authenticationFailed' || type === 'authError') {
      return {
        status: 'rejected',
        error: stringValue(payload.msg) ?? stringValue(payload.message) ?? 'Authentication failed.',
      };
    }

    if (type === 'authenticated' || action === 'authenticated') return { status: 'accepted' };
    if (
      action === 'serverinfo' ||
      action === 'userinfo' ||
      action === 'traceinfo' ||
      action === 'serverwarnings'
    ) {
      return { status: 'pending', signal: action };
    }

    return { status: 'pending' };
  },
  decode(payload) {
    if (!isRecord(payload)) return [];

    const innerEvent = isRecord(payload.event) ? payload.event : payload;
    const payloadAction = stringValue(innerEvent.action) ?? stringValue(payload.action);
    const payloadEtype = stringValue(innerEvent.etype) ?? stringValue(payload.etype);
    if (payloadAction === 'ifchange' || payloadEtype === 'ifchange') return [];

    if (payload.type === 'snapshot' || payload.action === 'snapshot') {
      return [
        {
          type: 'snapshot',
          snapshot: {
            devices: normalizeDevicesList(payload.devices ?? payload.nodes),
            groups: normalizeGroupsList(payload.groups ?? payload.meshes),
          },
        },
      ];
    }

    if (payload.type === 'devices' || payload.action === 'nodes') {
      return [
        {
          type: 'devicesReplaced',
          devices: normalizeDevicesList(payload.devices ?? payload.nodes),
        },
      ];
    }

    if (payload.type === 'groups' || payload.action === 'meshes') {
      return [
        {
          type: 'groupsReplaced',
          groups: normalizeGroupsList(payload.groups ?? payload.meshes),
        },
      ];
    }

    const rawEvent = isRecord(payload.event)
      ? payload.event
      : payload.type === 'event' || typeof payload.action === 'string'
        ? payload
        : undefined;
    return rawEvent ? decodeEvent(rawEvent) : [];
  },
  createAuthenticationMessage: (token) => ({ type: 'authenticate', token }),
  createSnapshotRequest: () => [
    { action: 'meshes', responseid: 'req-groups' },
    { action: 'nodes', responseid: 'req-nodes' },
    { type: 'request', resource: 'snapshot' },
  ],
  createHeartbeatMessage: () => ({ type: 'ping' }),
  createChangeDeviceRequest: (deviceId, updates) => ({
    action: 'changedevice',
    nodeid: deviceId,
    name: updates.name,
    desc: updates.desc,
    meshid: updates.groupId,
    responseid: `req-changedevice-${Date.now()}`,
  }),
  createPowerActionRequest: (deviceId, action) =>
    action === 'wake'
      ? {
          action: 'wakenode',
          nodeid: deviceId,
          responseid: `req-wakenode-${Date.now()}`,
        }
      : {
          action: 'poweraction',
          nodeid: deviceId,
          subaction: action,
          responseid: `req-poweraction-${Date.now()}`,
        },
};
