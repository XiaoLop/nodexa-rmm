import type { Device } from '@meshcentral/shared-state';
import { createLatencyTrend, createWorkspaceMetrics, workspaceEvents } from './mockWorkspaceData';
import type { DeviceWorkspaceModel } from './types';

function rawRecord(device: Device) {
  return device.raw && typeof device.raw === 'object'
    ? (device.raw as Record<string, unknown>)
    : undefined;
}

function rawString(device: Device, keys: string[]) {
  const raw = rawRecord(device);
  for (const key of keys) {
    const value = raw?.[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return undefined;
}

export function createDeviceWorkspaceModel(device: Device): DeviceWorkspaceModel {
  const latencyTrend = createLatencyTrend(device.id);
  return {
    device,
    hostname: rawString(device, ['rname', 'host', 'hostname']) ?? device.name,
    platform: device.platform ?? rawString(device, ['osdesc', 'platform']) ?? '未知系统',
    ipAddress: rawString(device, ['ip', 'host']) ?? '—',
    macAddress: rawString(device, ['mac', 'macaddr']) ?? '—',
    currentUser: rawString(device, ['user', 'currentUser']) ?? 'Administrator',
    uptime: rawString(device, ['uptime']) ?? '2 天 14 小时',
    lastHeartbeat: device.lastSeenAt ?? '刚刚',
    groupName: device.groupName ?? '未分组',
    tags: ['Windows', '办公设备', '生产环境'],
    metrics: createWorkspaceMetrics(device.id),
    latency: latencyTrend.at(-1) ?? 28,
    latencyTrend,
    events: workspaceEvents,
    sessionStartedAt: '1 小时',
  };
}
