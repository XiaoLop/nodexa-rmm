import { describe, expect, it } from 'vitest';
import type { Device } from '@meshcentral/shared-state';
import { deviceDescription, deviceTags, rawDeviceNumber, rawDeviceString } from './device';

function createMockDevice(overrides: Partial<Device> = {}): Device {
  return {
    id: 'test-device-id',
    name: 'Test Device',
    online: true,
    ...overrides,
  } as Device;
}

describe('device utilities', () => {
  it('reads raw strings correctly', () => {
    const device = createMockDevice({ raw: { desc: 'My description', other: 123 } });
    expect(rawDeviceString(device, 'desc')).toBe('My description');
    expect(rawDeviceString(device, 'other')).toBeUndefined();
    expect(rawDeviceString(device, 'missing')).toBeUndefined();
  });

  it('reads raw numbers correctly', () => {
    const device = createMockDevice({ raw: { lastbootuptime: 1700000000000, desc: 'str' } });
    expect(rawDeviceNumber(device, 'lastbootuptime')).toBe(1700000000000);
    expect(rawDeviceNumber(device, 'desc')).toBeUndefined();
    expect(rawDeviceNumber(device, 'missing')).toBeUndefined();
  });

  it('extracts device description from desc or description', () => {
    expect(deviceDescription(createMockDevice({ raw: { desc: 'Primary desc' } }))).toBe(
      'Primary desc',
    );
    expect(deviceDescription(createMockDevice({ raw: { description: 'Secondary desc' } }))).toBe(
      'Secondary desc',
    );
    expect(deviceDescription(createMockDevice({ raw: {} }))).toBeUndefined();
  });

  it('parses array tags with whitespace trimming and deduplication', () => {
    const device = createMockDevice({
      raw: {
        tags: ['web', '  db  ', 'web', '', 'production'],
      },
    });
    expect(deviceTags(device)).toEqual(['web', 'db', 'production']);
  });

  it('parses comma-separated string tags', () => {
    const device = createMockDevice({
      raw: {
        tags: 'server, edge,  iot , server',
      },
    });
    expect(deviceTags(device)).toEqual(['server', 'edge', 'iot']);
  });

  it('handles top-level tags property if present', () => {
    const device = createMockDevice({
      tags: ['standalone'],
      raw: {},
    } as unknown as Partial<Device>);
    expect(deviceTags(device)).toEqual(['standalone']);
  });

  it('returns empty array when no tags are defined or invalid', () => {
    expect(deviceTags(createMockDevice({ raw: {} }))).toEqual([]);
    expect(deviceTags(createMockDevice({ raw: { tags: 12345 } }))).toEqual([]);
    expect(deviceTags(createMockDevice())).toEqual([]);
  });
});
