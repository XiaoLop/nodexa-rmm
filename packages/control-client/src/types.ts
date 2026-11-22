import type { ConnectionTermination } from './lifecycle/termination';
import type {
  DeviceSessions,
  MeshCentralNotification,
  RecordingReady,
  ServerWarning,
} from './notifications/types';
import type { ServerFileTree } from './serverFiles.types';

export type ConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'authenticating'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error'
  | 'destroyed';

export type LocalizedNames = Record<string, string>;

export interface DeviceLocation {
  lookupIp: string;
  countryCode?: string;
  subdivisionCode?: string;
  countryNames?: LocalizedNames;
  regionNames?: LocalizedNames;
  cityNames?: LocalizedNames;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  source: 'iploc-db';
  resolvedAt?: string;
}

export interface Device {
  id: string;
  name: string;
  groupId?: string;
  groupName?: string;
  online: boolean;
  connectionFlags?: number;
  machineType?: number;
  agentId?: number;
  agentCapabilities?: number;
  amtState?: number;
  amtSku?: number;
  isWindows?: boolean;
  grants?: Record<string, PrincipalGrant>;
  effectiveRights?: number;
  agentVersion?: string;
  platform?: string;
  icon?: number;
  lastSeenAt?: string;
  location?: DeviceLocation;
  raw?: unknown;
}

export interface PrincipalGrant {
  principalId: string;
  rights: number;
  name?: string;
}

export interface DeviceGroup {
  id: string;
  name: string;
  description?: string;
  type?: number;
  grants?: Record<string, PrincipalGrant>;
  raw?: unknown;
}

export type UserGroupLinkType = 'user' | 'device-group' | 'device' | 'unknown';

export interface UserGroupLink {
  id: string;
  type: UserGroupLinkType;
  rights: number;
  name?: string;
  raw?: unknown;
}

export interface UserGroup {
  id: string;
  name: string;
  description?: string;
  domain?: string;
  flags: number;
  consent: number;
  links: UserGroupLink[];
  raw?: unknown;
}

export interface UserGroupCreateOptions {
  name: string;
  description?: string;
  cloneUserGroupId?: string;
}

export interface UserGroupUpdate {
  name: string;
  description?: string;
}

export type MeshCentralEventType =
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

export interface MeshCentralEvent {
  id: string;
  type: MeshCentralEventType;
  action?: string;
  entityType?: string;
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
  image?: string;
  hasImage?: boolean;
  email?: string;
  emailVerified?: boolean;
  siteadmin?: number;
  removeRights: number;
  links: Record<string, UserInfoLink>;
  notify?: Record<string, number>;
  creationAt?: string;
  lastLoginAt?: string;
  lastAccessAt?: string;
  previousLoginAt?: string;
  passwordChangedAt?: string;
  twoFactorEnabled?: boolean;
  language?: string;
  raw?: unknown;
}

export interface UserInfoLink {
  id: string;
  type: UserLinkType;
  rights: number;
  notify?: number;
  name?: string;
}

export interface ServerInfo {
  magenturl?: string;
  agentCertHash?: string;
  features?: number;
  features2?: number;
  features3?: number;
  guestDeviceSharing?: boolean;
  manageAllDeviceGroups?: boolean;
  raw?: unknown;
}

export interface ServerStateStats {
  userAccounts?: number;
  deviceGroups?: number;
  agentSessions?: number;
  connectedUsers?: number;
  userSessions?: number;
  relaySessions?: number;
  relayCount?: number;
  connectedIntelAmt?: number;
  connectedIntelAmtCira?: number;
  raw?: unknown;
}

export interface ServerStats {
  totalMemory?: number;
  freeMemory?: number;
  availableMemory?: number;
  cpuAverage: number[];
  serverState?: ServerStateStats;
  raw: unknown;
}

export interface ServerTimelineMemory {
  rss?: number;
  heapTotal?: number;
  heapUsed?: number;
  external?: number;
  arrayBuffers?: number;
  raw?: unknown;
}

export interface ServerTimelineConnections {
  connectedAgents?: number;
  connectedUsers?: number;
  userSessions?: number;
  relaySessions?: number;
  connectedIntelAmt?: number;
  connectedIntelAmtCira?: number;
  raw?: unknown;
}

export interface ServerTimelineTraffic {
  time?: number;
  delta?: number;
  httpRequestCount?: number;
  httpWebSocketCount?: number;
  httpIn?: number;
  httpOut?: number;
  relayCount?: Record<string, number>;
  relayIn?: Record<string, number>;
  relayOut?: Record<string, number>;
  localRelayCount?: number;
  localRelayIn?: number;
  localRelayOut?: number;
  agentCtrlIn?: number;
  agentCtrlOut?: number;
  lmsIn?: number;
  lmsOut?: number;
  ciraIn?: number;
  ciraOut?: number;
  raw?: unknown;
}

export interface ServerTimelineStats {
  time: string;
  connections?: ServerTimelineConnections;
  memory?: ServerTimelineMemory;
  traffic?: ServerTimelineTraffic;
  cpu?: number[];
  expire?: string;
  raw: unknown;
}

export type UserLinkType = 'device-group' | 'user-group' | 'device' | 'unknown';

export interface UserLink {
  id: string;
  type: UserLinkType;
  rights: number;
}

export interface ManagedUser {
  id: string;
  name: string;
  image?: string;
  hasImage?: boolean;
  realName?: string;
  email?: string;
  phone?: string;
  siteRights: number;
  removeRights: number;
  locked: boolean;
  resetNextLogin?: boolean;
  createdAt?: string;
  lastLoginAt?: string;
  previousLoginAt?: string;
  lastAccessAt?: string;
  passwordChangedAt?: string;
  links?: UserLink[];
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

export interface PreviousLogin {
  occurredAt: string;
  messageId?: number;
  ip?: string;
  client?: string;
  platform?: string;
}

export interface MeshCentralSnapshot {
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

export interface MeshCentralDiagnostic {
  type: 'invalid-message' | 'unmatched-response' | 'listener-error' | 'unknown-message';
  message: string;
  payload?: unknown;
  error?: Error;
}

export interface ServerConsoleOutput {
  text: string;
  tag?: string;
  receivedAt: number;
}

export interface ServerTrace {
  source: string;
  args: unknown[];
  time: number;
}

export interface ServerErrorLog {
  content?: string;
}

export interface MeshCentralClientEvents {
  serverConsole: ServerConsoleOutput;
  traceSources: readonly string[];
  trace: ServerTrace;
  connection: ConnectionStateChange;
  event: MeshCentralEvent;
  notification: MeshCentralNotification;
  serverWarnings: ServerWarning[];
  deviceSessions: DeviceSessions;
  termination: ConnectionTermination;
  accountChanged: UserInfo;
  recordingReady: RecordingReady;
  userInfo: UserInfo;
  serverInfo: ServerInfo;
  serverStats: ServerStats;
  files: ServerFileTree;
  message: unknown;
  error: Error;
  diagnostic: MeshCentralDiagnostic;
}

export type MeshCentralListener<T> = (value: T) => void;
export type MeshCentralEventChannel = keyof MeshCentralClientEvents;
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
  raw: {
    nodes?: unknown;
    networkInfo?: unknown;
    lastConnect?: unknown;
    systemInfo?: unknown;
    detail?: unknown;
  };
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

export interface MeshCentralClientOptions {
  url: string;
  webSocketFactory?: WebSocketFactory;
  getAccessToken?: () => string | undefined | Promise<string | undefined>;
  heartbeatIntervalMs?: number;
  connectionTimeoutMs?: number;
  reconnectDelaysMs?: number[];
  requestTimeoutMs?: number;
  onConnectionChange?: MeshCentralListener<ConnectionStateChange>;
  onEvent?: MeshCentralListener<MeshCentralEvent>;
  onError?: MeshCentralListener<Error>;
  onDiagnostic?: MeshCentralListener<MeshCentralDiagnostic>;
}
