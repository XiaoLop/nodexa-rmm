import type {
  ConnectionTermination,
  Device,
  DeviceGroup,
  DeviceSessions,
  MeshCentralNotification,
  MeshCentralEvent,
  ServerWarning,
  ServerInfo,
  UserInfo,
} from '@meshcentral/control-client';

export type {
  Device,
  DeviceGroup,
  ConnectionTermination,
  DeviceSessions,
  MeshCentralNotification,
  MeshCentralEvent,
  MeshCentralEventType,
  MeshCentralSnapshot,
  ServerWarning,
  ServerInfo,
  UserInfo,
} from '@meshcentral/control-client';

export interface NotificationEntry extends MeshCentralNotification {
  read: boolean;
  readAt?: string;
  expiresAt?: string;
}

export interface DeviceHelpRequest {
  deviceId: string;
  requests: Record<string, string>;
  updatedAt: string;
}

export type ConnectionStatus =
  'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error';

export interface MeshCentralControlState {
  status: ConnectionStatus;
  devices: Record<string, Device>;
  groups: Record<string, DeviceGroup>;
  events: MeshCentralEvent[];
  notifications: NotificationEntry[];
  unreadCount: number;
  serverWarnings: ServerWarning[];
  helpRequests: Record<string, DeviceHelpRequest>;
  termination?: ConnectionTermination;
  cacheStale: boolean;
  userInfo?: UserInfo;
  serverInfo?: ServerInfo;
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
  appendEvent: (event: MeshCentralEvent) => void;
  applyAccountChanged: (userInfo: UserInfo) => void;
  addNotification: (notification: MeshCentralNotification) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  removeExpiredNotifications: (now?: string) => void;
  replaceServerWarnings: (warnings: ServerWarning[]) => void;
  applyDeviceSessions: (sessions: DeviceSessions) => void;
  setTermination: (termination?: ConnectionTermination) => void;
  setCacheStale: (stale: boolean) => void;
  clearSensitiveState: () => void;
  setUserInfo: (userInfo?: UserInfo) => void;
  setServerInfo: (serverInfo?: ServerInfo) => void;
  clearAuthorizationSnapshot: () => void;
  touchMessage: () => void;
  reset: () => void;
}
