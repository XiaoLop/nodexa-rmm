import type {
  Device,
  DeviceGroup,
  GatewayEvent,
  ServerInfo,
  UserInfo,
} from '@meshcentral/control-client';

export type {
  Device,
  DeviceGroup,
  GatewayEvent,
  GatewayEventType,
  GatewaySnapshot,
  ServerInfo,
  UserInfo,
} from '@meshcentral/control-client';

export type ConnectionStatus =
  'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error';

export interface GatewayState {
  status: ConnectionStatus;
  devices: Record<string, Device>;
  groups: Record<string, DeviceGroup>;
  events: GatewayEvent[];
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
  appendEvent: (event: GatewayEvent) => void;
  setUserInfo: (userInfo?: UserInfo) => void;
  setServerInfo: (serverInfo?: ServerInfo) => void;
  clearAuthorizationSnapshot: () => void;
  touchMessage: () => void;
  reset: () => void;
}
