export type ConnectionStatus =
  'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error';

export interface Device {
  id: string;
  name: string;
  groupId?: string;
  groupName?: string;
  online: boolean;
  agentVersion?: string;
  platform?: string;
  lastSeenAt?: string;
  raw?: unknown;
}

export interface DeviceGroup {
  id: string;
  name: string;
  description?: string;
  raw?: unknown;
}

export type GatewayEventType =
  | 'deviceOnline'
  | 'deviceOffline'
  | 'deviceChanged'
  | 'deviceRemoved'
  | 'relayLog'
  | 'agentLog'
  | 'userSessionCount'
  | 'unknown';

export interface GatewayEvent {
  id: string;
  type: GatewayEventType;
  deviceId?: string;
  deviceName?: string;
  user?: string;
  ip?: string;
  message?: string;
  occurredAt: string;
  raw?: unknown;
}

export interface GatewaySnapshot {
  devices: Device[];
  groups: DeviceGroup[];
}

export interface UserInfo {
  id: string;
  name?: string;
  email?: string;
  siteadmin?: number;
  creationAt?: string;
  lastLoginAt?: string;
  lastAccessAt?: string;
  previousLoginAt?: string;
  language?: string;
  raw?: unknown;
}

export type GatewayMutation =
  | { type: 'snapshot'; snapshot: GatewaySnapshot }
  | { type: 'devicesReplaced'; devices: Device[] }
  | { type: 'deviceLastSeenUpdated'; lastSeenByDeviceId: Record<string, string> }
  | { type: 'groupsReplaced'; groups: DeviceGroup[] }
  | { type: 'deviceUpserted'; device: Device; event?: GatewayEvent }
  | { type: 'deviceStatusChanged'; deviceId: string; online: boolean; event: GatewayEvent }
  | { type: 'deviceRemoved'; deviceId: string; event?: GatewayEvent }
  | { type: 'eventReceived'; event: GatewayEvent }
  | { type: 'userInfoUpdated'; userInfo: UserInfo };

export interface GatewayState {
  status: ConnectionStatus;
  devices: Record<string, Device>;
  groups: Record<string, DeviceGroup>;
  events: GatewayEvent[];
  userInfo?: UserInfo;
  reconnectAttempt: number;
  lastConnectedAt?: string;
  lastMessageAt?: string;
  error?: string;
  setConnectionStatus: (status: ConnectionStatus, error?: string) => void;
  setError: (error?: string) => void;
  setReconnectAttempt: (attempt: number) => void;
  replaceDevices: (devices: Device[]) => void;
  replaceGroups: (groups: DeviceGroup[]) => void;
  upsertDevice: (device: Device) => void;
  removeDevice: (deviceId: string) => void;
  appendEvent: (event: GatewayEvent) => void;
  setUserInfo: (userInfo?: UserInfo) => void;
  touchMessage: () => void;
  applyMutation: (mutation: GatewayMutation) => void;
  reset: () => void;
}

export interface MessageEventLike {
  data: unknown;
}

export interface CloseEventLike {
  code?: number;
  reason?: string;
}

export interface WebSocketLike {
  readonly readyState: number;
  onopen: (() => void) | null;
  onmessage: ((event: MessageEventLike) => void) | null;
  onerror: ((error: any) => void) | null;
  onclose: ((event: CloseEventLike) => void) | null;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

export type WebSocketFactory = (url: string) => WebSocketLike;

export type GatewayConnectionResult =
  | { status: 'pending'; signal?: string }
  | { status: 'accepted' }
  | { status: 'rejected'; error: string };

export interface GatewayProtocolAdapter {
  decode(payload: unknown): GatewayMutation[];
  inspectConnectionMessage?(payload: unknown): GatewayConnectionResult;
  requiredConnectionSignals?: readonly string[];
  createAuthenticationMessage(token: string): unknown;
  createSnapshotRequest(): unknown;
  createHeartbeatMessage(): unknown;
  createChangeDeviceRequest?(
    deviceId: string,
    updates: { name?: string; desc?: string; groupId?: string },
  ): unknown;
  createPowerActionRequest?(
    deviceId: string,
    action: 'wake' | 'reset' | 'poweroff' | 'sleep',
  ): unknown;
  createSystemInfoRequest?(deviceId: string, responseId: string): unknown;
}
