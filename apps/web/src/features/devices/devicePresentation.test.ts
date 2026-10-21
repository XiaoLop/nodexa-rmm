import type { Device, DeviceGroup } from '@meshcentral/shared-state';
import { describe, expect, it } from 'vitest';
import {
  UNGROUPED_GROUP_ID,
  buildDeviceInviteServerInfo,
  deviceCreationTime,
  matchesDeviceFilters,
  nameCategory,
  rawNumber,
  rawString,
} from './devicePresentation';

function device(overrides: Partial<Device> = {}): Device {
  return { id: 'device-1', name: 'Workstation', online: true, ...overrides };
}

function group(id: string, name: string): DeviceGroup {
  return { id, name };
}

describe('device presentation helpers', () => {
  it('reads only string values from raw device data', () => {
    const target = device({ raw: { ip: '10.0.0.1', host: 42, empty: '' } });

    expect(rawString(target, 'ip')).toBe('10.0.0.1');
    expect(rawString(target, 'empty')).toBe('');
    expect(rawString(target, 'host')).toBeUndefined();
    expect(rawString(target, 'missing')).toBeUndefined();
    expect(rawString(device(), 'ip')).toBeUndefined();
    expect(rawString(device({ raw: null }), 'ip')).toBeUndefined();
  });

  it('reads only numeric values from raw device data', () => {
    const target = device({ raw: { creation: 0, firstconnect: 1690000000, label: '5' } });

    expect(rawNumber(target, 'creation')).toBe(0);
    expect(rawNumber(target, 'firstconnect')).toBe(1690000000);
    expect(rawNumber(target, 'label')).toBeUndefined();
    expect(rawNumber(target, 'missing')).toBeUndefined();
    expect(rawNumber(device(), 'creation')).toBeUndefined();
  });

  it('prefers creation time and falls back to first connection time', () => {
    expect(
      deviceCreationTime(device({ raw: { creation: 1700000000, firstconnect: 1600000000 } })),
    ).toBe(1700000000);
    expect(deviceCreationTime(device({ raw: { firstconnect: 1600000000 } }))).toBe(1600000000);
    expect(deviceCreationTime(device({ raw: { creation: 0, firstconnect: 1600000000 } }))).toBe(0);
    expect(deviceCreationTime(device({ raw: {} }))).toBe(0);
    expect(deviceCreationTime(device())).toBe(0);
  });

  it('categorizes names by their first trimmed character', () => {
    expect(nameCategory('123 device')).toBe(0);
    expect(nameCategory(' 9device')).toBe(0);
    expect(nameCategory('alpha')).toBe(1);
    expect(nameCategory('Alpha')).toBe(3);
    expect(nameCategory('设备')).toBe(2);
    expect(nameCategory('')).toBe(2);
    expect(nameCategory('   ')).toBe(2);
    expect(nameCategory('-dash')).toBe(2);
  });

  it('builds invite server info from the agents URL', () => {
    expect(buildDeviceInviteServerInfo('https://mesh.example.com')).toEqual({
      name: 'mesh.example.com',
      port: 443,
      https: true,
      magenturl: 'https://mesh.example.com',
    });
    expect(buildDeviceInviteServerInfo('http://mesh.example.com:8080/meshagents')).toEqual({
      name: 'mesh.example.com',
      port: 8080,
      https: false,
      magenturl: 'http://mesh.example.com:8080/meshagents',
    });
    expect(buildDeviceInviteServerInfo('http://mesh.example.com')).toMatchObject({
      port: 80,
      https: false,
    });
  });

  it('matches the query against device fields and raw values', () => {
    const target = device({
      id: 'node-123',
      name: 'Workstation',
      platform: 'Windows',
      raw: { ip: '10.0.0.42', host: 'desk-01', desc: 'Reception' },
      location: {
        lookupIp: '10.0.0.42',
        countryCode: 'US',
        countryNames: { en: 'United States' },
        source: 'geoip-mmdb',
        databaseVersion: '2026-10',
      },
    });
    const defaults = { query: '', groupId: '', online: 'all', platform: 'all' } as const;

    expect(matchesDeviceFilters(target, defaults, new Map<string, DeviceGroup>())).toBe(true);
    expect(
      matchesDeviceFilters(target, { ...defaults, query: 'work' }, new Map<string, DeviceGroup>()),
    ).toBe(true);
    expect(
      matchesDeviceFilters(
        target,
        { ...defaults, query: '10.0.0.42' },
        new Map<string, DeviceGroup>(),
      ),
    ).toBe(true);
    expect(
      matchesDeviceFilters(
        target,
        { ...defaults, query: 'desk-01' },
        new Map<string, DeviceGroup>(),
      ),
    ).toBe(true);
    expect(
      matchesDeviceFilters(
        target,
        { ...defaults, query: 'reception' },
        new Map<string, DeviceGroup>(),
      ),
    ).toBe(true);
    expect(
      matchesDeviceFilters(
        target,
        { ...defaults, query: 'united states' },
        new Map<string, DeviceGroup>(),
      ),
    ).toBe(true);
    expect(
      matchesDeviceFilters(target, { ...defaults, query: 'absent' }, new Map<string, DeviceGroup>()),
    ).toBe(false);
  });

  it('preserves group, status, and platform filter semantics', () => {
    const groups = new Map<string, DeviceGroup>([['g1', group('g1', 'Group one')]]);
    const target = device({ groupId: 'g1', platform: 'Windows', online: true });
    const defaults = { query: '', groupId: '', online: 'all', platform: 'all' } as const;

    expect(matchesDeviceFilters(target, { ...defaults, groupId: 'g1' }, groups)).toBe(true);
    expect(matchesDeviceFilters(target, { ...defaults, groupId: 'g2' }, groups)).toBe(false);
    expect(
      matchesDeviceFilters(device({ groupId: 'g2' }), { ...defaults, groupId: 'g1' }, groups),
    ).toBe(false);

    expect(matchesDeviceFilters(device(), { ...defaults, groupId: UNGROUPED_GROUP_ID }, groups)).toBe(
      true,
    );
    expect(
      matchesDeviceFilters(
        device({ groupId: 'unknown' }),
        { ...defaults, groupId: UNGROUPED_GROUP_ID },
        groups,
      ),
    ).toBe(true);
    expect(
      matchesDeviceFilters(target, { ...defaults, groupId: UNGROUPED_GROUP_ID }, groups),
    ).toBe(false);

    expect(matchesDeviceFilters(target, { ...defaults, online: 'online' }, groups)).toBe(true);
    expect(matchesDeviceFilters(target, { ...defaults, online: 'offline' }, groups)).toBe(false);
    expect(
      matchesDeviceFilters(device({ online: false }), { ...defaults, online: 'offline' }, groups),
    ).toBe(true);
    expect(matchesDeviceFilters(device({ platform: 'Linux' }), defaults, groups)).toBe(true);
    expect(
      matchesDeviceFilters(target, { ...defaults, platform: 'Linux' }, groups),
    ).toBe(false);
    expect(
      matchesDeviceFilters(target, { ...defaults, platform: 'Windows' }, groups),
    ).toBe(true);
  });
});
