import type {
  Device,
  DeviceGroup,
  MeshCentralEvent,
  PrincipalGrant,
  ServerInfo,
  ServerStateStats,
  ServerStats,
  ServerTimelineConnections,
  ServerTimelineMemory,
  ServerTimelineStats,
  ServerTimelineTraffic,
  UserInfo,
  UserInfoLink,
  UserLinkType,
} from '../types';
import { normalizeRights } from '../permissions/bitmask';

type UnknownRecord = Record<string, unknown>;
const DEFAULT_DEVICE_ICON = 1;

export const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
export const stringValue = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

function linkType(id: string): UserLinkType {
  if (id.startsWith('mesh/')) return 'device-group';
  if (id.startsWith('node/')) return 'device';
  if (id.startsWith('ugrp/')) return 'user-group';
  return 'unknown';
}

function normalizeGrants(value: unknown): Record<string, PrincipalGrant> | undefined {
  if (!isRecord(value)) return undefined;
  const grants: Record<string, PrincipalGrant> = {};
  for (const [principalId, grant] of Object.entries(value)) {
    if (!isRecord(grant) || typeof grant.rights !== 'number' || !Number.isFinite(grant.rights)) {
      continue;
    }
    grants[principalId] = {
      principalId,
      rights: normalizeRights(grant.rights),
      name: stringValue(grant.name),
    };
  }
  return grants;
}

function normalizeUserInfoLinks(value: unknown): Record<string, UserInfoLink> {
  if (!isRecord(value)) return {};
  const links: Record<string, UserInfoLink> = {};
  for (const [id, link] of Object.entries(value)) {
    if (!isRecord(link) || typeof link.rights !== 'number' || !Number.isFinite(link.rights)) {
      continue;
    }
    links[id] = {
      id,
      type: linkType(id),
      rights: normalizeRights(link.rights),
      notify:
        typeof link.notify === 'number' && Number.isInteger(link.notify) && link.notify >= 0
          ? normalizeRights(link.notify)
          : undefined,
      name: stringValue(link.name),
    };
  }
  return links;
}

function normalizeNotificationMasks(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};
  const masks: Record<string, number> = {};
  for (const [id, mask] of Object.entries(value)) {
    if (typeof mask === 'number' && Number.isInteger(mask) && mask >= 0) {
      masks[id] = normalizeRights(mask);
    }
  }
  return masks;
}

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
  let online = false;
  if (typeof value.online === 'boolean') online = value.online;
  else if (typeof value.conn === 'number') online = (value.conn & 1) !== 0;
  let agentVersion = stringValue(value.agentVersion) ?? stringValue(value.agentvers);
  if (
    !agentVersion &&
    isRecord(value.agent) &&
    (typeof value.agent.ver === 'number' || typeof value.agent.ver === 'string')
  ) {
    agentVersion = String(value.agent.ver);
  }
  const connectionFlags =
    typeof value.conn === 'number' && Number.isFinite(value.conn) ? value.conn : undefined;
  const machineType =
    typeof value.mtype === 'number' && Number.isFinite(value.mtype) ? value.mtype : undefined;
  const agent = isRecord(value.agent) ? value.agent : undefined;
  const agentId = typeof agent?.id === 'number' && Number.isFinite(agent.id) ? agent.id : undefined;
  const agentCapabilities =
    typeof agent?.caps === 'number' && Number.isFinite(agent.caps) ? agent.caps : undefined;
  const intelAmt = isRecord(value.intelamt) ? value.intelamt : undefined;
  const amtState =
    typeof intelAmt?.state === 'number' && Number.isFinite(intelAmt.state)
      ? intelAmt.state
      : undefined;
  const amtSku =
    typeof intelAmt?.sku === 'number' && Number.isFinite(intelAmt.sku)
      ? intelAmt.sku
      : undefined;
  const icon =
    typeof value.icon === 'number' && Number.isInteger(value.icon) && value.icon >= 1 && value.icon <= 8
      ? value.icon
      : DEFAULT_DEVICE_ICON;
  const platform = stringValue(value.osdesc);
  return {
    id,
    name: stringValue(value.name) ?? stringValue(value.rname) ?? stringValue(value.host) ?? id,
    groupId: stringValue(value.groupId) ?? stringValue(value.meshid) ?? fallbackGroupId,
    groupName: stringValue(value.groupName) ?? stringValue(value.meshname),
    online,
    connectionFlags,
    machineType,
    agentId,
    agentCapabilities,
    amtState,
    amtSku,
    isWindows:
      (agentId !== undefined && [1, 2, 3, 4, 21, 22, 34, 42, 43].includes(agentId)) ||
      (platform !== undefined && /win/i.test(platform)),
    grants: normalizeGrants(value.links),
    agentVersion,
    platform,
    icon,
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
    type: typeof value.mtype === 'number' && Number.isFinite(value.mtype) ? value.mtype : undefined,
    grants: normalizeGrants(value.links),
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

export function normalizeEvent(value: unknown): MeshCentralEvent | undefined {
  if (!isRecord(value)) return undefined;
  const raw = isRecord(value.event) ? value.event : value;
  const action = stringValue(raw.action) ?? 'unknown';
  const deviceId = stringValue(raw.deviceId) ?? stringValue(raw.nodeid);
  const node = isRecord(raw.node) ? raw.node : undefined;
  const conn = typeof raw.conn === 'number' ? raw.conn : undefined;
  let type: MeshCentralEvent['type'] = 'unknown';
  if (action === 'nodeconnect' || action === 'connect' || action === 'connected')
    type = conn !== undefined && (conn & 1) === 0 ? 'deviceOffline' : 'deviceOnline';
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
    image: stringValue(raw.image),
    hasImage:
      stringValue(raw.image) !== undefined ||
      (typeof raw.flags === 'number' && (raw.flags & 1) !== 0),
    email: stringValue(raw.email),
    emailVerified:
      typeof raw.emailVerified === 'boolean' ? raw.emailVerified : undefined,
    siteadmin: typeof raw.siteadmin === 'number' ? raw.siteadmin : undefined,
    removeRights:
      typeof raw.removeRights === 'number' && Number.isFinite(raw.removeRights)
        ? normalizeRights(raw.removeRights)
        : 0,
    links: normalizeUserInfoLinks(raw.links),
    notify: normalizeNotificationMasks(raw.notify),
    creationAt: timestampValue(raw.creation),
    lastLoginAt: timestampValue(raw.login),
    lastAccessAt: timestampValue(raw.access),
    previousLoginAt: timestampValue(raw.pastlogin),
    passwordChangedAt: timestampValue(raw.passchange),
    twoFactorEnabled:
      typeof raw.otpsecret === 'number' || typeof raw.otpkeys === 'number'
        ? Number(raw.otpsecret ?? 0) > 0 || Number(raw.otpkeys ?? 0) > 0
        : undefined,
    language: stringValue(raw.llang),
    raw,
  };
}

export function normalizeServerInfo(value: unknown): ServerInfo | undefined {
  if (!isRecord(value)) return undefined;
  const raw = isRecord(value.serverinfo) ? value.serverinfo : value;
  const numeric = (field: unknown): number | undefined =>
    typeof field === 'number' && Number.isFinite(field) ? normalizeRights(field) : undefined;
  const boolean = (field: unknown): boolean | undefined =>
    typeof field === 'boolean' ? field : typeof field === 'number' ? field !== 0 : undefined;
  return {
    features: numeric(raw.features),
    features2: numeric(raw.features2),
    features3: numeric(raw.features3),
    guestDeviceSharing: boolean(raw.guestdevicesharing ?? raw.guestDeviceSharing),
    manageAllDeviceGroups: boolean(raw.managealldevicegroups ?? raw.manageAllDeviceGroups),
    raw,
  };
}

export function normalizeServerStats(value: unknown): ServerStats | undefined {
  if (!isRecord(value) || value.action !== 'serverstats') return undefined;
  const finiteNumber = (field: unknown): number | undefined =>
    typeof field === 'number' && Number.isFinite(field) ? field : undefined;
  const values = isRecord(value.values) ? value.values : undefined;
  const rawServerState = isRecord(values?.ServerState) ? values.ServerState : undefined;
  let serverState: ServerStateStats | undefined;
  if (rawServerState) {
    serverState = {
      userAccounts: finiteNumber(rawServerState.UserAccounts),
      deviceGroups: finiteNumber(rawServerState.DeviceGroups),
      agentSessions: finiteNumber(rawServerState.AgentSessions),
      connectedUsers: finiteNumber(rawServerState.ConnectedUsers),
      userSessions: finiteNumber(rawServerState.UsersSessions),
      relaySessions: finiteNumber(rawServerState.RelaySessions),
      relayCount: finiteNumber(rawServerState.RelayCount),
      connectedIntelAmt: finiteNumber(rawServerState.ConnectedIntelAMT),
      connectedIntelAmtCira: finiteNumber(rawServerState.ConnectedIntelAMTCira),
      raw: rawServerState,
    };
  }
  return {
    totalMemory: finiteNumber(value.totalmem),
    freeMemory: finiteNumber(value.freemem),
    availableMemory: finiteNumber(value.availablemem),
    cpuAverage: Array.isArray(value.cpuavg)
      ? value.cpuavg.filter(
          (item): item is number => typeof item === 'number' && Number.isFinite(item),
        )
      : [],
    serverState,
    raw: value,
  };
}

export function normalizeServerTimelineStats(value: unknown): ServerTimelineStats | undefined {
  if (!isRecord(value)) return undefined;
  const finiteNumber = (field: unknown): number | undefined =>
    typeof field === 'number' && Number.isFinite(field) ? field : undefined;
  const record = (field: unknown): Record<string, unknown> | undefined =>
    isRecord(field) ? field : undefined;
  const normalizeNumberRecord = (field: unknown): Record<string, number> | undefined => {
    const raw = record(field);
    if (!raw) return undefined;
    const normalized: Record<string, number> = {};
    for (const [key, item] of Object.entries(raw)) {
      const number = finiteNumber(item);
      if (number !== undefined) normalized[key] = number;
    }
    return normalized;
  };
  const rawConnections = record(value.conn);
  const rawMemory = record(value.mem);
  const rawTraffic = record(value.traffic);
  const connections: ServerTimelineConnections | undefined = rawConnections
    ? {
        connectedAgents: finiteNumber(rawConnections.ca),
        connectedUsers: finiteNumber(rawConnections.cu),
        userSessions: finiteNumber(rawConnections.us),
        relaySessions: finiteNumber(rawConnections.rs),
        connectedIntelAmt: finiteNumber(rawConnections.am),
        connectedIntelAmtCira: finiteNumber(rawConnections.amc),
        raw: rawConnections,
      }
    : undefined;
  const memory: ServerTimelineMemory | undefined = rawMemory
    ? {
        rss: finiteNumber(rawMemory.rss),
        heapTotal: finiteNumber(rawMemory.heapTotal),
        heapUsed: finiteNumber(rawMemory.heapUsed),
        external: finiteNumber(rawMemory.external),
        arrayBuffers: finiteNumber(rawMemory.arrayBuffers),
        raw: rawMemory,
      }
    : undefined;
  const traffic: ServerTimelineTraffic | undefined = rawTraffic
    ? {
        time: finiteNumber(rawTraffic.time),
        delta: finiteNumber(rawTraffic.delta),
        httpRequestCount: finiteNumber(rawTraffic.httpRequestCount),
        httpWebSocketCount: finiteNumber(rawTraffic.httpWebSocketCount),
        httpIn: finiteNumber(rawTraffic.httpIn),
        httpOut: finiteNumber(rawTraffic.httpOut),
        relayCount: normalizeNumberRecord(rawTraffic.relayCount),
        relayIn: normalizeNumberRecord(rawTraffic.relayIn),
        relayOut: normalizeNumberRecord(rawTraffic.relayOut),
        localRelayCount: finiteNumber(rawTraffic.localRelayCount),
        localRelayIn: finiteNumber(rawTraffic.localRelayIn),
        localRelayOut: finiteNumber(rawTraffic.localRelayOut),
        agentCtrlIn: finiteNumber(rawTraffic.AgentCtrlIn),
        agentCtrlOut: finiteNumber(rawTraffic.AgentCtrlOut),
        lmsIn: finiteNumber(rawTraffic.LMSIn),
        lmsOut: finiteNumber(rawTraffic.LMSOut),
        ciraIn: finiteNumber(rawTraffic.CIRAIn),
        ciraOut: finiteNumber(rawTraffic.CIRAOut),
        raw: rawTraffic,
      }
    : undefined;
  const time = timestampValue(value.time);
  if (!time) return undefined;
  return {
    time,
    expire: timestampValue(value.expire),
    connections,
    memory,
    traffic,
    cpu: Array.isArray(value.cpu)
      ? value.cpu.filter((item): item is number => finiteNumber(item) !== undefined)
      : undefined,
    raw: value,
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
