import type { SessionEvent, WorkspaceMetric } from './types';

function hashDeviceId(deviceId: string) {
  return [...deviceId].reduce((hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0, 7);
}

export function createWorkspaceMetrics(deviceId: string): WorkspaceMetric[] {
  const seed = hashDeviceId(deviceId);
  return [
    { label: 'CPU', value: 24 + (seed % 18), suffix: '%', tone: 'primary' },
    { label: '内存', value: 48 + (seed % 17), suffix: '%', tone: 'success' },
    { label: '网络', value: 8 + (seed % 21), suffix: 'KB/s', tone: 'warning' },
  ];
}

export function createLatencyTrend(deviceId: string) {
  const seed = hashDeviceId(deviceId);
  return [18, 26, 21, 32, 24, 29, 22, 31, 25, 34, 27, 23].map(
    (value, index) => value + ((seed + index * 3) % 7),
  );
}

export const workspaceEvents: SessionEvent[] = [
  { id: 'connected', time: '14:32:21', message: '建立远程桌面连接' },
  { id: 'desktop-ready', time: '14:32:22', message: '认证成功，开始传输桌面' },
  { id: 'latency', time: '14:32:25', message: '连接质量良好，延迟 28 ms' },
  { id: 'input', time: '14:32:30', message: '用户输入已启用' },
];
