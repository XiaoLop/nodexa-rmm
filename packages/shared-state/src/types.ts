import type {
  Device,
  DeviceGroup,
  MeshCentralEvent,
  ServerInfo,
  UserInfo,
} from '@meshcentral/control-client';

export type {
  Device,
  DeviceGroup,
  MeshCentralEvent,
  MeshCentralEventType,
  MeshCentralSnapshot,
  ServerInfo,
  UserInfo,
} from '@meshcentral/control-client';

export type ConnectionStatus =
  'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error';

export interface MeshCentralControlState {
  status: ConnectionStatus;
  devices: Record<string, Device>;
  groups: Record<string, DeviceGroup>;
  events: MeshCentralEvent[];
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
  setUserInfo: (userInfo?: UserInfo) => void;
  setServerInfo: (serverInfo?: ServerInfo) => void;
  clearAuthorizationSnapshot: () => void;
  touchMessage: () => void;
  reset: () => void;
}
