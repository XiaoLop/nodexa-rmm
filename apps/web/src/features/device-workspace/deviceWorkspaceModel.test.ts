import type { Device } from '@meshcentral/shared-state';
import { describe, expect, it } from 'vitest';
import { createDeviceWorkspaceModel } from './deviceWorkspaceModel';

const device: Device = {
  id: 'node/domain/device-1',
  name: 'Office PC',
  online: true,
  platform: 'Windows 11',
  groupName: '办公室',
  lastSeenAt: '2026-09-06T14:32:21.000Z',
  raw: {
    rname: 'DESKTOP-7F3A9K2',
    ip: '192.168.1.23',
    mac: '00:50:56:A1:B2:C3',
    user: 'Administrator',
  },
};

describe('createDeviceWorkspaceModel', () => {
  it('combines real device details with stable demo metrics', () => {
    const first = createDeviceWorkspaceModel(device);
    const second = createDeviceWorkspaceModel(device);

    expect(first).toMatchObject({
      hostname: 'DESKTOP-7F3A9K2',
      platform: 'Windows 11',
      ipAddress: '192.168.1.23',
      macAddress: '00:50:56:A1:B2:C3',
      currentUser: 'Administrator',
      groupName: '办公室',
    });
    expect(first.metrics).toEqual(second.metrics);
    expect(first.latencyTrend).toEqual(second.latencyTrend);
  });

  it('uses readable fallbacks when optional fields are absent', () => {
    const model = createDeviceWorkspaceModel({ id: 'node-2', name: 'Node 2', online: false });

    expect(model.hostname).toBe('Node 2');
    expect(model.ipAddress).toBe('—');
    expect(model.macAddress).toBe('—');
    expect(model.groupName).toBe('未分组');
  });
});
