export type NotificationSource =
  | 'event-notify'
  | 'msg-notify'
  | 'help-request'
  | 'chat-request'
  | 'recording'
  | 'server-warning'
  | 'security'
  | 'device-state';

export type NotificationSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface MeshCentralNotification {
  id: string;
  source: NotificationSource;
  title?: string;
  message?: string;
  titleId?: number;
  messageId?: number;
  args?: unknown[];
  tag?: string;
  icon?: string | number;
  deviceId?: string;
  groupId?: string;
  userId?: string;
  username?: string;
  sessionId?: string;
  targetUrl?: string;
  maxTimeSeconds?: number;
  occurredAt: string;
  severity: NotificationSeverity;
  raw: unknown;
}

export interface ServerWarning {
  id: number;
  message: string;
  args?: unknown[];
  raw: unknown;
}

export interface DeviceSessions {
  deviceId: string;
  help: Record<string, string>;
  sessions: Record<string, unknown>;
  occurredAt: string;
  raw: unknown;
}

export interface RecordingReady {
  deviceId?: string;
  groupId?: string;
  deviceName?: string;
  filename?: string;
  protocol?: number;
  sizeBytes?: number;
  startedAt?: string;
  durationSeconds?: number;
  occurredAt: string;
  raw: unknown;
}