import type { Device } from '@meshcentral/shared-state';
import type { DeviceDetails } from '@meshcentral/control-client';

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

export interface SessionEvent {
  id: string;
  time: string;
  message: string;
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
  cpuName: string;
  cpuShortName: string;
  cpuSpeed?: string;
  memoryTotal: string;
  memorySlots: number;
  memorySpeed?: string;
  storageTotal: string;
  storageRemaining: string;
  storageDrives: string[];
  volumes: StorageVolume[];
  gpuName: string;
  gpuResolution?: string;
  boardName: string;
  biosVersion: string;
  primaryNic: string;
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
  hostname: string;
  platform: string;
  ipAddress: string;
  macAddress: string;
  currentUser: string;
  uptime: string;
  lastHeartbeat: string;
  groupName: string;
  tags: string[];
  cpuName: string;
  memorySummary: string;
  storageSummary: string;
  networkSummary: string;
  securitySummary: string;
  hardware: DeviceHardwareInfo;
  events: SessionEvent[];
  sessionStartedAt: string;
  terminalAllowed?: boolean;
  filesAllowed?: boolean;
  desktopAccess?: 'denied' | 'view-only' | 'limited-input' | 'control';
}
