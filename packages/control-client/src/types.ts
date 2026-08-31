export type ConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'authenticating'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error'
  | 'destroyed';

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

export interface GatewaySnapshot {
  devices: Device[];
  groups: DeviceGroup[];
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
  onerror: ((error: unknown) => void) | null;
  onclose: ((event: CloseEventLike) => void) | null;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}
export type WebSocketFactory = (url: string) => WebSocketLike;

export interface ConnectionStateChange {
  previous: ConnectionStatus;
  current: ConnectionStatus;
  reconnectAttempt: number;
  error?: Error;
}

export interface GatewayDiagnostic {
  type: 'invalid-message' | 'unmatched-response' | 'listener-error' | 'unknown-message';
  message: string;
  payload?: unknown;
  error?: Error;
}

export interface GatewayClientEvents {
  connection: ConnectionStateChange;
  event: GatewayEvent;
  userInfo: UserInfo;
  message: unknown;
  error: Error;
  diagnostic: GatewayDiagnostic;
}

export type GatewayListener<T> = (value: T) => void;
export type GatewayEventChannel = keyof GatewayClientEvents;
export type PowerAction = 'wake' | 'reset' | 'poweroff' | 'sleep';

export interface DeviceUpdate {
  name?: string;
  desc?: string;
  groupId?: string;
  tags?: string[];
}

export interface DeviceDetails {
  device?: Device;
  networkInfo: unknown;
  lastConnect: unknown;
  systemInfo: unknown;
  raw: { nodes: unknown; networkInfo: unknown; lastConnect: unknown; systemInfo: unknown };
}

export interface GroupCreateOptions {
  description?: string;
  type?: number;
}
export interface GroupUpdate {
  name?: string;
  description?: string;
}
export interface EventListOptions {
  limit?: number;
}

export interface GatewayClientOptions {
  url: string;
  webSocketFactory?: WebSocketFactory;
  getAccessToken?: () => string | undefined | Promise<string | undefined>;
  heartbeatIntervalMs?: number;
  connectionTimeoutMs?: number;
  reconnectDelaysMs?: number[];
  requestTimeoutMs?: number;
  onConnectionChange?: GatewayListener<ConnectionStateChange>;
  onEvent?: GatewayListener<GatewayEvent>;
  onError?: GatewayListener<Error>;
  onDiagnostic?: GatewayListener<GatewayDiagnostic>;
}
