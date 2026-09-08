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
  | 'manualOperation'
  | 'commandExecution'
  | 'batchUpload'
  | 'userSessionCount'
  | 'unknown';

export interface GatewayEvent {
  id: string;
  type: GatewayEventType;
  action?: string;
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

export interface ManagedUser {
  id: string;
  name: string;
  realName?: string;
  email?: string;
  phone?: string;
  siteRights: number;
  locked: boolean;
  resetNextLogin?: boolean;
  createdAt?: string;
  lastLoginAt?: string;
  previousLoginAt?: string;
  lastAccessAt?: string;
  passwordChangedAt?: string;
  raw: unknown;
}

export interface UserCreateOptions {
  username: string;
  password?: string;
  randomPassword?: boolean;
  email?: string;
  realName?: string;
  phone?: string;
  resetNextLogin?: boolean;
}

export interface UserUpdate {
  email?: string;
  realName?: string;
  phone?: string;
}

export type UserSessionCounts = Record<string, number>;

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

export type BatchTaskStatus =
  'queued' | 'running' | 'submitted' | 'succeeded' | 'failed' | 'skipped';
export interface BatchDeviceTarget {
  id: string;
  name?: string;
}
export interface BatchDeviceResult {
  deviceId: string;
  deviceName: string;
  status: BatchTaskStatus;
  message?: string;
  startedAt?: number;
  finishedAt?: number;
}
export interface BatchOperationResult {
  results: BatchDeviceResult[];
  raw: unknown;
}
export interface AgentEmailInviteOptions {
  groupId: string;
  email: string;
  name?: string;
  message?: string;
  os?: string;
}
export interface AgentLinkInviteOptions {
  groupId: string;
  expireHours?: number;
  flags?: 0 | 1 | 2;
}
export interface AgentInviteResult {
  raw: unknown;
}
export interface AgentInviteLinkResult {
  url?: string;
  raw: unknown;
}
export interface CommandRunOptions {
  shell?: 'shell' | 'powershell';
  runAsUser?: 0 | 1 | 2;
  reply?: boolean;
}
export interface CommandSubmission {
  requestId: string;
  raw: unknown;
}

export type CommandShell = 'auto' | 'shell' | 'powershell';
export type CommandExecutionStatus =
  'submitting' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'timedOut' | 'unknown';
export type CommandOutputStream = 'stdout' | 'stderr' | 'output' | 'system';

export interface NormalizedCommandMessage {
  requestId?: string;
  deviceId?: string;
  kind: 'accepted' | 'output' | 'completed' | 'failed' | 'cancelled' | 'unknown';
  finalResult?: boolean;
  stream?: CommandOutputStream;
  content?: string;
  exitCode?: number;
  error?: string;
  raw: unknown;
}

export interface CommandOutputChunk {
  sequence: number;
  stream: CommandOutputStream;
  content: string;
  receivedAt: number;
}

export interface CommandDeviceResult {
  deviceId: string;
  status: CommandExecutionStatus;
  output: CommandOutputChunk[];
  exitCode?: number;
  error?: string;
  startedAt: number;
  finishedAt?: number;
  durationMs?: number;
}

export interface CommandBatchSnapshot {
  requestId: string;
  status: CommandExecutionStatus;
  results: CommandDeviceResult[];
  trackingStopped?: boolean;
}

export interface CommandExecuteOptions {
  shell?: Exclude<CommandShell, 'auto'>;
  runAsUser?: 0 | 1 | 2;
  timeoutMs?: number;
}

export interface CommandExecutionHandle {
  readonly requestId: string;
  getSnapshot(): CommandBatchSnapshot;
  subscribe(listener: (snapshot: CommandBatchSnapshot) => void): () => void;
  stopTracking(): void;
  cancelRemote(): Promise<void>;
  completed: Promise<CommandBatchSnapshot>;
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
export type HistoricalEventFilter =
  'agentlog' | 'relaylog' | 'manual' | 'runcommands' | 'batchupload' | 'changenode' | 'removenode';

export interface EventListOptions {
  limit?: number;
  filter?: HistoricalEventFilter;
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
