import { describe, expect, it } from 'vitest';

import type { Device } from '@meshcentral/control-client';

import { McpToolError } from '../errors';
import { assertDeviceAllowed, filterDevices, hasScope, isDeviceAllowed } from './scope';

const allowed: Device = { id: 'node//a', name: 'a', online: true, groupId: 'mesh//one' };
const otherGroup: Device = { id: 'node//b', name: 'b', online: false, groupId: 'mesh//two' };

describe('scope', () => {
  it('has no scope when both lists are empty', () => {
    expect(hasScope(undefined)).toBe(false);
    expect(hasScope({ devices: [], deviceGroups: [] })).toBe(false);
  });

  it('allows everything without a scope', () => {
    expect(isDeviceAllowed(allowed, undefined)).toBe(true);
    expect(filterDevices([allowed, otherGroup], undefined)).toHaveLength(2);
  });

  it('matches by device id', () => {
    const scope = { devices: ['node//a'], deviceGroups: [] };
    expect(isDeviceAllowed(allowed, scope)).toBe(true);
    expect(isDeviceAllowed(otherGroup, scope)).toBe(false);
  });

  it('matches by group id', () => {
    const scope = { devices: [], deviceGroups: ['mesh//one'] };
    expect(isDeviceAllowed(allowed, scope)).toBe(true);
    expect(isDeviceAllowed(otherGroup, scope)).toBe(false);
  });

  it('matches by group name', () => {
    const named: Device = { ...allowed, groupName: 'Production' };
    expect(isDeviceAllowed(named, { devices: [], deviceGroups: ['Production'] })).toBe(true);
  });

  it('filters devices', () => {
    const scope = { devices: [], deviceGroups: ['mesh//two'] };
    expect(filterDevices([allowed, otherGroup], scope).map((device) => device.id)).toEqual([
      'node//b',
    ]);
  });

  it('throws when a device is out of scope', () => {
    expect(() => assertDeviceAllowed(allowed, { devices: ['node//b'], deviceGroups: [] })).toThrow(
      McpToolError,
    );
  });
});
