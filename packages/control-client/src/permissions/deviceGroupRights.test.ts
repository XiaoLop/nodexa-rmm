import { describe, expect, it } from 'vitest';
import type { DeviceGroup, UserInfo } from '../types';
import { FULL_RIGHTS } from './bitmask';
import {
  resolveEffectiveDeviceGroupRights,
  resolveEffectiveDeviceGroupRightsResult,
} from './deviceGroupRights';
import { MeshRight } from './meshRights';

const group = (grants?: DeviceGroup['grants']): DeviceGroup => ({
  id: 'mesh//one',
  name: 'One',
  grants,
});

const user = (links: UserInfo['links'] = {}): UserInfo => ({
  id: 'user//operator',
  name: 'operator',
  siteadmin: 0,
  removeRights: 0,
  links,
});

describe('resolveEffectiveDeviceGroupRights', () => {
  it('keeps rights unknown without a user or grant source', () => {
    expect(resolveEffectiveDeviceGroupRights(group(), undefined)).toBeUndefined();
    expect(resolveEffectiveDeviceGroupRights(group(), user())).toBeUndefined();
  });

  it('combines direct and user-group grants', () => {
    const currentUser = user({
      'mesh//one': {
        id: 'mesh//one',
        type: 'device-group',
        rights: MeshRight.EditMesh,
      },
      'ugrp//operators': {
        id: 'ugrp//operators',
        type: 'user-group',
        rights: FULL_RIGHTS,
      },
    });
    const currentGroup = group({
      'user//operator': {
        principalId: 'user//operator',
        rights: MeshRight.EditMesh,
      },
      'ugrp//operators': {
        principalId: 'ugrp//operators',
        rights: MeshRight.ManageComputers,
      },
    });

    expect(resolveEffectiveDeviceGroupRights(currentGroup, currentUser)).toBe(
      MeshRight.EditMesh | MeshRight.ManageComputers,
    );
  });

  it('uses the explicit manage-all server capability', () => {
    expect(
      resolveEffectiveDeviceGroupRights(group(), user(), { manageAllDeviceGroups: true }),
    ).toBe(FULL_RIGHTS);
  });

  it('reports mismatched direct grant mirrors', () => {
    const result = resolveEffectiveDeviceGroupRightsResult(
      group({
        'user//operator': {
          principalId: 'user//operator',
          rights: MeshRight.ManageUsers,
        },
      }),
      user({
        'mesh//one': {
          id: 'mesh//one',
          type: 'device-group',
          rights: MeshRight.EditMesh,
        },
      }),
    );

    expect(result).toMatchObject({
      status: 'resolved',
      rights: MeshRight.EditMesh | MeshRight.ManageUsers,
      diagnostics: ['direct-group-mismatch'],
    });
  });
});