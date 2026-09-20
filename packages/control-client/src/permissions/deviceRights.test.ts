import { describe, expect, it } from 'vitest';
import type { Device, DeviceGroup, UserInfo } from '../types';
import { FULL_RIGHTS } from './bitmask';
import {
  applyUserDeviceRestrictions,
  resolveEffectiveDeviceRights,
  resolveEffectiveDeviceRightsResult,
} from './deviceRights';
import { MeshRight } from './meshRights';

const device = (raw?: unknown): Device => ({
  id: 'node//one',
  name: 'One',
  groupId: 'mesh//one',
  online: true,
  raw,
});

const group = (raw?: unknown): DeviceGroup => ({ id: 'mesh//one', name: 'One', raw });

const user = (raw?: unknown, siteadmin = 0): UserInfo => ({
  id: 'user//admin',
  name: 'Admin',
  siteadmin,
  removeRights: 0,
  links: {},
  raw,
});

describe('resolveEffectiveDeviceRights', () => {
  it('does not convert site administrator rights into device rights', () => {
    expect(resolveEffectiveDeviceRights(device(), group(), user(undefined, FULL_RIGHTS))).toBeUndefined();
  });

  it('keeps rights unknown when the server provides no rights sources', () => {
    expect(resolveEffectiveDeviceRights(device(), group(), user())).toBeUndefined();
  });

  it('resolves direct node rights when the parent group is unavailable', () => {
    const currentUser: UserInfo = {
      ...user(),
      links: {
        'node//one': { id: 'node//one', type: 'device', rights: MeshRight.RemoteControl },
      },
    };

    expect(resolveEffectiveDeviceRights(device(), undefined, currentUser)).toBe(
      MeshRight.RemoteControl,
    );
  });

  it('combines direct and user-group grants from the mesh and node', () => {
    const currentUser: UserInfo = {
      ...user(),
      links: {
        'mesh//one': { id: 'mesh//one', type: 'device-group', rights: MeshRight.RemoteControl },
        'ugrp//operators': { id: 'ugrp//operators', type: 'user-group', rights: FULL_RIGHTS },
      },
    };
    const currentGroup: DeviceGroup = {
      ...group(),
      grants: {
        'user//admin': { principalId: 'user//admin', rights: MeshRight.RemoteControl },
        'ugrp//operators': {
          principalId: 'ugrp//operators',
          rights: MeshRight.RemoteCommand,
        },
      },
    };
    const currentDevice: Device = {
      ...device(),
      grants: {
        'ugrp//operators': { principalId: 'ugrp//operators', rights: MeshRight.WakeDevice },
      },
    };

    expect(resolveEffectiveDeviceRights(currentDevice, currentGroup, currentUser)).toBe(
      MeshRight.RemoteControl | MeshRight.RemoteCommand | MeshRight.WakeDevice,
    );
  });

  it('applies positive removals and negative restrictions', () => {
    const removeRights = MeshRight.RemoteControl | MeshRight.NoDesktop | MeshRight.NoFiles;
    const restricted = applyUserDeviceRestrictions(FULL_RIGHTS, removeRights);
    expect(restricted).not.toBe(FULL_RIGHTS);
    expect(restricted & MeshRight.RemoteControl).toBe(0);
    expect(restricted & MeshRight.NoDesktop).toBe(MeshRight.NoDesktop);
    expect(restricted & MeshRight.NoFiles).toBe(MeshRight.NoFiles);
    expect(restricted & MeshRight.NoTerminal).toBe(0);
  });

  it('merges inconsistent direct grant mirrors and reports a diagnostic', () => {
    const currentUser: UserInfo = {
      ...user(),
      links: {
        'mesh//one': { id: 'mesh//one', type: 'device-group', rights: MeshRight.RemoteControl },
      },
    };
    const result = resolveEffectiveDeviceRightsResult(
      device(),
      { ...group(), grants: { 'user//admin': { principalId: 'user//admin', rights: MeshRight.WakeDevice } } },
      currentUser,
    );
    expect(result).toMatchObject({
      status: 'resolved',
      rights: MeshRight.RemoteControl | MeshRight.WakeDevice,
      diagnostics: ['direct-mesh-mismatch'],
    });
  });
});