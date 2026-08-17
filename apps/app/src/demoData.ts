import type { Device, DeviceGroup, GatewayEvent } from '@meshcentral/shared-state';

export const demoGroups: DeviceGroup[] = [
  { id: 'group-server', name: '生产服务器', description: '核心业务与数据库节点' },
  { id: 'group-office', name: '办公终端', description: '总部员工设备' },
  { id: 'group-lab', name: '测试实验室', description: '开发与自动化测试环境' },
];

export const demoDevices: Device[] = [
  { id: 'node-prod-01', name: 'CN-SH-WEB-01', groupId: 'group-server', groupName: '生产服务器', online: true, platform: 'Ubuntu 24.04 LTS', agentVersion: '0.9.6', lastSeenAt: '2026-08-17T05:40:00.000Z' },
  { id: 'node-prod-02', name: 'CN-SH-DB-01', groupId: 'group-server', groupName: '生产服务器', online: true, platform: 'Windows Server 2022', agentVersion: '0.9.6', lastSeenAt: '2026-08-17T05:39:00.000Z' },
  { id: 'node-office-01', name: 'DESIGN-MAC-07', groupId: 'group-office', groupName: '办公终端', online: true, platform: 'macOS 15.4', agentVersion: '0.9.5', lastSeenAt: '2026-08-17T05:38:00.000Z' },
  { id: 'node-office-02', name: 'FINANCE-PC-12', groupId: 'group-office', groupName: '办公终端', online: false, platform: 'Windows 11 Pro', agentVersion: '0.9.5', lastSeenAt: '2026-08-17T00:42:00.000Z' },
  { id: 'node-lab-01', name: 'LAB-RPI-03', groupId: 'group-lab', groupName: '测试实验室', online: true, platform: 'Raspberry Pi OS', agentVersion: '0.9.6', lastSeenAt: '2026-08-17T05:37:00.000Z' },
  { id: 'node-lab-02', name: 'QA-WIN-04', groupId: 'group-lab', groupName: '测试实验室', online: false, platform: 'Windows 10', agentVersion: '0.9.4', lastSeenAt: '2026-08-16T23:18:00.000Z' },
];

export const demoEvents: GatewayEvent[] = [
  { id: 'event-1', type: 'deviceOnline', deviceId: 'node-prod-01', message: 'CN-SH-WEB-01 已上线', occurredAt: '2026-08-17T05:36:00.000Z' },
  { id: 'event-2', type: 'deviceChanged', deviceId: 'node-prod-02', message: 'CN-SH-DB-01 清单信息已更新', occurredAt: '2026-08-17T05:28:00.000Z' },
  { id: 'event-3', type: 'deviceOffline', deviceId: 'node-office-02', message: 'FINANCE-PC-12 连接已断开', occurredAt: '2026-08-17T04:42:00.000Z' },
  { id: 'event-4', type: 'deviceChanged', deviceId: 'node-lab-01', message: 'LAB-RPI-03 Agent 已更新至 0.9.6', occurredAt: '2026-08-17T03:55:00.000Z' },
  { id: 'event-5', type: 'deviceOnline', deviceId: 'node-prod-02', message: 'CN-SH-DB-01 已上线', occurredAt: '2026-08-17T02:16:00.000Z' },
  { id: 'event-6', type: 'deviceChanged', deviceId: 'node-office-01', message: 'DESIGN-MAC-07 用户信息已同步', occurredAt: '2026-08-17T01:40:00.000Z' },
  { id: 'event-7', type: 'deviceOffline', deviceId: 'node-lab-02', message: 'QA-WIN-04 超过 15 分钟未响应', occurredAt: '2026-08-16T23:18:00.000Z' },
  { id: 'event-8', type: 'deviceChanged', deviceId: 'node-prod-01', message: 'CN-SH-WEB-01 系统清单采集完成', occurredAt: '2026-08-16T22:07:00.000Z' },
  { id: 'event-9', type: 'deviceOnline', deviceId: 'node-office-01', message: 'DESIGN-MAC-07 已上线', occurredAt: '2026-08-16T21:32:00.000Z' },
  { id: 'event-10', type: 'deviceChanged', deviceId: 'node-lab-01', message: 'LAB-RPI-03 网络地址已变更', occurredAt: '2026-08-16T20:45:00.000Z' },
];

export function platformIcon(platform?: string) {
  const value = platform?.toLowerCase() ?? '';
  if (value.includes('windows')) return 'logo-windows' as const;
  if (value.includes('mac')) return 'logo-apple' as const;
  if (value.includes('ubuntu') || value.includes('linux') || value.includes('raspberry')) return 'logo-tux' as const;
  return 'desktop-outline' as const;
}

export function eventPresentation(type: GatewayEvent['type']) {
  if (type === 'deviceOnline') return { icon: 'arrow-up-circle' as const, tone: 'success' as const };
  if (type === 'deviceOffline') return { icon: 'cloud-offline' as const, tone: 'danger' as const };
  if (type === 'deviceRemoved') return { icon: 'trash' as const, tone: 'danger' as const };
  return { icon: 'sync-circle' as const, tone: 'info' as const };
}
