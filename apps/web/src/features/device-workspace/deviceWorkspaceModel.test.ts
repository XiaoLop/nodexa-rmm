import { MeshRight } from '@meshcentral/control-client';
import type { Device } from '@meshcentral/shared-state';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createDeviceWorkspaceModel,
  formatBitRate,
  formatBytes,
  splitUptime,
} from './deviceWorkspaceModel';

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
  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses real device identity without generating dynamic metrics', () => {
    const model = createDeviceWorkspaceModel(device);

    expect(model).toMatchObject({
      hostname: 'DESKTOP-7F3A9K2',
      platform: 'Windows 11',
      ipAddress: '192.168.1.23',
      macAddress: '00:50:56:A1:B2:C3',
      currentUser: 'Administrator',
      groupName: '办公室',
    });
    expect(model.cpuName).toBeUndefined();
    expect(model.memorySummary).toBeUndefined();
    expect(model.networkSummary).toBeUndefined();
    expect(model.hardware.volumes).toEqual([]);
    expect(model.hasSystemDetails).toBe(false);
    expect(model.hasNetworkDetails).toBe(false);
  });

  it('uses readable fallbacks when optional fields are absent', () => {
    const model = createDeviceWorkspaceModel({ id: 'node-2', name: 'Node 2', online: false });

    expect(model.hostname).toBe('Node 2');
    expect(model.ipAddress).toBeUndefined();
    expect(model.macAddress).toBeUndefined();
    expect(model.groupName).toBeUndefined();
  });

  it('calculates uptime from the device last boot timestamp', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-16T08:00:00.000Z'));

    const model = createDeviceWorkspaceModel({
      id: 'node-uptime',
      name: 'Node Uptime',
      online: true,
      raw: { lastbootuptime: Date.parse('2026-09-14T05:30:00.000Z') },
    });

    expect(model.uptimeSeconds).toBe(181_800);
  });

  it('stops counting uptime at the last online time for an offline device', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-16T08:00:00.000Z'));

    const model = createDeviceWorkspaceModel({
      id: 'node-offline-uptime',
      name: 'Offline Node',
      online: false,
      lastSeenAt: '2026-09-12T08:00:00.000Z',
      raw: { lastbootuptime: Date.parse('2026-09-10T05:30:00.000Z') },
    });

    expect(model.uptimeSeconds).toBe(181_800);
  });

  it('does not infer uptime for an offline device without a valid last online time', () => {
    const model = createDeviceWorkspaceModel({
      id: 'node-offline-no-last-seen',
      name: 'Offline Node',
      online: false,
      raw: { lastbootuptime: Date.parse('2026-09-10T05:30:00.000Z') },
    });

    expect(model.uptimeSeconds).toBeUndefined();
  });

  it('parses the Windows DMTF boot time from system details', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-10T10:00:00.000Z'));

    const model = createDeviceWorkspaceModel(device, {
      systemInfo: {
        hardware: {
          windows: {
            osinfo: { LastBootUpTime: '20260910003446.500000+480' },
          },
        },
      },
    } as any);

    expect(model.uptimeSeconds).toBe(62_714);
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
    expect(model.hasSystemDetails).toBe(true);
    expect(model.hasNetworkDetails).toBe(true);
  });

  it('selects the active physical interface with a default gateway', () => {
    const model = createDeviceWorkspaceModel(device, {
      networkInfo: {
        netif2: {
          'vEthernet (WSL)': [
            {
              family: 'IPv4',
              address: '172.28.192.1',
              speed: 100_000_000_000_000_000,
              status: 'up',
            },
          ],
          'Wi-Fi': [
            {
              family: 'IPv4',
              address: '192.168.1.21',
              gateway: '192.168.1.1',
              speed: 866_000_000,
              status: 'up',
            },
          ],
          'Ethernet 2': [
            {
              family: 'IPv4',
              address: '10.10.0.8',
              speed: 1_000_000_000,
              status: 'down',
            },
          ],
        },
      },
    } as any);

    expect(model.hardware.primaryNic).toBe('Wi-Fi (866 Mbps)');
    expect(model.hardware.primarySpeed).toBe('866 Mbps');
  });

  it('normalizes Linux identifiers, kernel details, and mounted volumes', () => {
    const model = createDeviceWorkspaceModel(
      { id: 'linux-1', name: 'Ubuntu host', online: true, platform: 'Linux' },
      {
        device: { id: 'linux-1', name: 'Ubuntu host', online: true, platform: 'Linux' },
        networkInfo: undefined,
        lastConnect: undefined,
        systemInfo: {
          identifiers: { cpu_name: 'AMD Ryzen 7 5800X', product_name: 'ThinkStation' },
          hardware: {
            identifiers: { product_name: 'ThinkStation' },
            linux: {
              kernel_release: '6.8.0-40-generic',
              volumes: [{ mount_point: '/', size: '100G', used: '40G', available: '60G', type: 'ext4' }],
            },
          },
        },
        raw: {},
      } as any,
    );

    expect(model.hardware.platformKind).toBe('linux');
    expect(model.hardware.cpuName).toBe('AMD Ryzen 7 5800X');
    expect(model.hardware.kernelVersion).toBe('6.8.0-40-generic');
    expect(model.hardware.volumes[0]).toMatchObject({ letter: '/', type: 'ext4', usedPercent: 40 });
  });

  it('normalizes macOS volumes and boot time', () => {
    const model = createDeviceWorkspaceModel(
      { id: 'mac-1', name: 'Mac mini', online: true, platform: 'macOS' },
      {
        device: { id: 'mac-1', name: 'Mac mini', online: true, platform: 'macOS' },
        networkInfo: undefined,
        lastConnect: undefined,
        systemInfo: {
          identifiers: { product_name: 'Mac mini' },
          hardware: {
            identifiers: { product_name: 'Mac mini' },
            darwin: {
              LastBootUpTime: 1789410000,
              volumes: [{ mount_point: '/', size: '512 GB', used: '128 GB', available: '384 GB', type: 'apfs' }],
            },
          },
        },
        raw: {},
      } as any,
    );

    expect(model.hardware.platformKind).toBe('macos');
    expect(model.hardware.deviceModel).toBe('Mac mini');
    expect(model.hardware.volumes[0]?.type).toBe('apfs');
    expect(model.hardware.bootTime).toBe(1789410000);
  });

  it('normalizes Android model and bootloader details', () => {
    const model = createDeviceWorkspaceModel(
      { id: 'android-1', name: 'Pixel', online: true, platform: 'Android' },
      {
        device: { id: 'android-1', name: 'Pixel', online: true, platform: 'Android' },
        networkInfo: undefined,
        lastConnect: undefined,
        systemInfo: {
          hardware: { mobile: { brand: 'Google', model: 'Pixel 9', bootloader: 'cloudripper' } },
        },
        raw: {},
      } as any,
    );

    expect(model.hardware.platformKind).toBe('mobile');
    expect(model.hardware.deviceModel).toBe('Pixel 9');
    expect(model.hardware.bootloader).toBe('cloudripper');
  });

  it('marks a pure Intel AMT device without an agent', () => {
    const model = createDeviceWorkspaceModel(
      { id: 'amt-1', name: 'AMT device', online: true, machineType: 1 },
      {
        device: { id: 'amt-1', name: 'AMT device', online: true, machineType: 1 },
        networkInfo: undefined,
        lastConnect: undefined,
        systemInfo: { hardware: { identifiers: { product_name: 'Intel vPro' } } },
        raw: { detail: { node: { mtype: 1 } } },
      } as any,
    );

    expect(model.hardware.platformKind).toBe('amt');
    expect(model.hardware.deviceModel).toBe('Intel vPro');
    expect(model.hardware.agentVersion).toBeUndefined();
  });

  it('uses the resolved group name when the device only contains a group id', () => {
    const model = createDeviceWorkspaceModel(
      { id: 'node-3', name: 'Node 3', online: true, groupId: 'mesh/domain/group-1' },
      undefined,
      '办公室',
    );

    expect(model.groupName).toBe('办公室');
  });

  it('derives device file access while preserving unknown permissions', () => {
    expect(
      createDeviceWorkspaceModel({
        id: 'files-allowed',
        name: 'Allowed',
        online: true,
        effectiveRights: MeshRight.RemoteControl,
      }).filesAllowed,
    ).toBe(true);
    expect(
      createDeviceWorkspaceModel({
        id: 'files-denied',
        name: 'Denied',
        online: true,
        effectiveRights: MeshRight.RemoteControl | MeshRight.NoFiles,
      }).filesAllowed,
    ).toBe(false);
    expect(
      createDeviceWorkspaceModel({ id: 'files-unknown', name: 'Unknown', online: true })
        .filesAllowed,
    ).toBeUndefined();
  });
});

describe('device workspace unit formatting', () => {
  it('formats storage and memory through terabytes and petabytes', () => {
    expect(formatBytes(1024 ** 4)).toBe('1.0 TB');
    expect(formatBytes(1.5 * 1024 ** 5)).toBe('1.5 PB');
  });

  it('formats network rates through terabits and petabits per second', () => {
    expect(formatBitRate(1_000_000_000_000)).toBe('1 Tbps');
    expect(formatBitRate(2_500_000_000_000_000)).toBe('2.5 Pbps');
  });

  it('splits long uptime into years, months, days, hours, and minutes', () => {
    const seconds = (((1 * 365 + 2 * 30 + 3) * 24 + 4) * 60 + 5) * 60;
    expect(splitUptime(seconds)).toEqual({
      years: 1,
      months: 2,
      days: 3,
      hours: 4,
      minutes: 5,
    });
  });
});
