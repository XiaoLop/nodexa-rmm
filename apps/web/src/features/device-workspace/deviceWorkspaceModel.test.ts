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
  it('uses real device identity without generating dynamic metrics', () => {
    const first = createDeviceWorkspaceModel(device);

    expect(first).toMatchObject({
      hostname: 'DESKTOP-7F3A9K2',
      platform: 'Windows 11',
      ipAddress: '192.168.1.23',
      macAddress: '00:50:56:A1:B2:C3',
      currentUser: 'Administrator',
      groupName: '办公室',
    });
    expect(first.cpuName).toBe('未提供');
    expect(first.memorySummary).toBe('未提供');
    expect(first.networkSummary).toBe('未提供');
  });

  it('uses readable fallbacks when optional fields are absent', () => {
    const model = createDeviceWorkspaceModel({ id: 'node-2', name: 'Node 2', online: false });

    expect(model.hostname).toBe('Node 2');
    expect(model.ipAddress).toBe('—');
    expect(model.macAddress).toBe('—');
    expect(model.groupName).toBe('未分组');
  });

  it('populates structured hardware, volumes, security, and connection info from device details', () => {
    const details = {
      device: { ...device, name: 'zqy' },
      networkInfo: {
        netif2: {
          '以太网': [
            { family: 'IPv4', address: '192.168.9.27', mac: '00:E0:1D:7E:61:16', gateway: '192.168.9.1', speed: 1000000000, status: 'up' },
          ],
        },
      },
      lastConnect: { time: 1789416924057, addr: '172.18.0.1:39564' },
      systemInfo: {
        hardware: {
          windows: {
            cpu: [{ Name: 'Intel(R) Xeon(R) CPU E5-2673 v3 @ 2.40GHz', MaxClockSpeed: 2401 }],
            memory: [{ Capacity: '34359738368', Speed: 1867 }, { Capacity: '34359738368', Speed: 1867 }],
            volumes: {
              C: { type: 'NTFS', size: 408023986176, sizeremaining: 129287561216 },
              D: { name: '软件', type: 'NTFS', size: 391691177984, sizeremaining: 176420347904 },
            },
            gpu: [{ Name: 'NVIDIA GeForce GT 720', CurrentHorizontalResolution: 1920, CurrentVerticalResolution: 1200 }],
            osinfo: { Caption: 'Microsoft Windows 11 专业版', LastBootUpTime: '20260910003446.500000+480' },
          },
        },
        identifiers: { board_name: 'X99', bios_vendor: 'AMI', bios_version: '5.11' },
        network: { dns: ['198.18.0.2', '114.114.114.114'] },
        pendingReboot: 'File Rename',
      },
      raw: {
        detail: {
          node: {
            agent: { ver: 0, root: true },
            wsc: { antiVirus: 'WARNING', firewall: 'PROBLEM', autoUpdate: 'OK' },
            defender: { RealTimeProtection: false },
          },
        },
      },
    };

    const model = createDeviceWorkspaceModel(device, details as any);

    expect(model.hardware.cpuShortName).toBe('Intel Xeon E5-2673 v3');
    expect(model.hardware.cpuSpeed).toBe('2.40 GHz');
    expect(model.hardware.memoryTotal).toBe('64.0 GB');
    expect(model.hardware.memorySlots).toBe(2);
    expect(model.hardware.volumes).toHaveLength(2);
    expect(model.hardware.volumes[0]?.letter).toBe('C:');
    expect(model.hardware.volumes[1]?.name).toBe('软件');
    expect(model.hardware.gpuName).toBe('NVIDIA GeForce GT 720');
    expect(model.hardware.gpuResolution).toBe('1920 × 1200');
    expect(model.hardware.boardName).toBe('X99');
    expect(model.hardware.security.antiVirus).toBe('WARNING');
    expect(model.hardware.security.pendingReboot).toBe('File Rename');
    expect(model.hardware.lastConnectAddr).toBe('172.18.0.1:39564');
    expect(model.hardware.primaryNic).toContain('以太网');
  });

  it('uses the resolved group name when the device only contains a group id', () => {
    const model = createDeviceWorkspaceModel(
      { id: 'node-3', name: 'Node 3', online: true, groupId: 'mesh/domain/group-1' },
      undefined,
      '办公室',
    );

    expect(model.groupName).toBe('办公室');
  });
});
