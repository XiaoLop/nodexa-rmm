import type { Device } from '@meshcentral/shared-state';

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

export interface WorkspaceMetric {
  label: string;
  value: number;
  suffix: string;
  tone: 'primary' | 'success' | 'warning';
}

export interface SessionEvent {
  id: string;
  time: string;
  message: string;
}

export interface DeviceWorkspaceModel {
  device: Device;
  hostname: string;
  platform: string;
  ipAddress: string;
  macAddress: string;
  currentUser: string;
  uptime: string;
  lastHeartbeat: string;
  groupName: string;
  tags: string[];
  metrics: WorkspaceMetric[];
  latency: number;
  latencyTrend: number[];
  events: SessionEvent[];
  sessionStartedAt: string;
}
