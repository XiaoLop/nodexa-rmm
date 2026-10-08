import type { Device } from '@meshcentral/shared-state';
import type { DeviceDetails, DeviceLocation } from '@meshcentral/control-client';

export type WorkspaceTab =
  | 'overview'
  | 'desktop'
  | 'terminal'
  | 'files'
  | 'processes'
  | 'services'
  | 'logs'
  | 'monitoring'
  | 'security';

export type DevicePlatformKind = 'windows' | 'linux' | 'macos' | 'mobile' | 'amt' | 'unknown';

export type DeviceManagementKind = 'agent' | 'amt' | 'hybrid' | 'unknown';

export type DeviceDataState =
  | 'available'
  | 'partial'
  | 'unsupported'
  | 'not-reported'
  | 'unavailable';

export type DeviceDataSource = 'agent' | 'amt' | 'server' | 'derived';

export interface DeviceDataStatus {
  state: DeviceDataState;
  source?: DeviceDataSource;
}

export interface DeviceDataAvailability {
  system: DeviceDataStatus;
  hardware: DeviceDataStatus;
  storage: DeviceDataStatus;
  network: DeviceDataStatus;
  security: DeviceDataStatus;
}

export interface DeviceCoreDataStatus {
  cpu: DeviceDataStatus;
  memory: DeviceDataStatus;
  storage: DeviceDataStatus;
  display: DeviceDataStatus;
  network: DeviceDataStatus;
}

export interface StorageVolume {
  letter: string;
  name?: string;
  type?: string;
  sizeBytes: number;
  remainingBytes: number;
  sizeFormatted: string;
  remainingFormatted: string;
  usedPercent: number;
}

export interface NetworkInterfaceInfo {
  name: string;
  ip?: string;
  mac?: string;
  speed?: string;
  gateway?: string;
  status: string;
}

export interface DeviceSecurityState {
  antiVirus?: string;
  firewall?: string;
  autoUpdate?: string;
  realTimeProtection?: boolean;
  tamperProtected?: boolean;
  pendingReboot?: string;
}

export interface DeviceHardwareInfo {
  platformKind: DevicePlatformKind;
  deviceModel?: string;
  osVersion?: string;
  kernelVersion?: string;
  bootloader?: string;
  bootTime?: unknown;
  cpuName?: string;
  cpuShortName?: string;
  cpuSpeed?: string;
  memoryTotal?: string;
  memorySlots: number;
  memorySpeed?: string;
  storageTotal?: string;
  storageRemaining?: string;
  storageDrives: string[];
  volumes: StorageVolume[];
  gpuName?: string;
  gpuResolution?: string;
  boardName?: string;
  biosVersion?: string;
  primaryNic?: string;
  primarySpeed?: string;
  dns: string[];
  interfaces: NetworkInterfaceInfo[];
  security: DeviceSecurityState;
  agentVersion?: string;
  agentCore?: string;
  agentIsRoot?: boolean;
  lastConnectAddr?: string;
  lastConnectTime?: string;
}

export interface DeviceWorkspaceModel {
  device: Device;
  details?: DeviceDetails;
  managementKind: DeviceManagementKind;
  dataAvailability: DeviceDataAvailability;
  coreDataStatus: DeviceCoreDataStatus;
  hasSystemDetails: boolean;
  hasNetworkDetails: boolean;
  hostname: string;
  platform?: string;
  ipAddress?: string;
  macAddress?: string;
  currentUser?: string;
  uptimeSeconds?: number;
  lastHeartbeatAt?: string;
  groupName?: string;
  location?: DeviceLocation;
  tags: string[];
  cpuName?: string;
  memorySummary?: string;
  storageSummary?: string;
  networkSummary?: string;
  securitySummary?: string;
  hardware: DeviceHardwareInfo;
  sessionStartedAt?: string;
  terminalAllowed?: boolean;
  filesAllowed?: boolean;
  desktopAccess?: 'denied' | 'view-only' | 'limited-input' | 'control';
}
