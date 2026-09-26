import { describe, expect, it } from 'vitest';
import type { Device, DeviceGroup, UserInfo } from '@meshcentral/control-client';
import { MeshRight } from '@meshcentral/control-client';
import { classifyDeviceGroupMoves, manageableTargetGroups } from './deviceGroupMoves';

const groups: DeviceGroup[] = [
  { id: 'mesh//source', name: 'Source' },
  { id: 'mesh//target', name: 'Target' },
  { id: 'mesh//denied', name: 'Denied' },
];

const userInfo: UserInfo = {
  id: 'user//operator',
  name: 'operator',
  removeRights: 0,
  links: {
    'mesh//source': {
      id: 'mesh//source',
      type: 'device-group',
      rights: MeshRight.ManageComputers,
    },
    'mesh//target': {
      id: 'mesh//target',
      type: 'device-group',
      rights: MeshRight.ManageComputers,
    },
    'mesh//denied': { id: 'mesh//denied', type: 'device-group', rights: 0 },
  },
};

const device = (id: string, groupId?: string): Device => ({
  id,
  name: id,
  groupId,
  online: true,
});

describe('device group move classification', () => {
  it('requires manage-computers permission on both source and target groups', () => {
    const result = classifyDeviceGroupMoves({
      devices: [
        device('allowed', 'mesh//source'),
        device('denied', 'mesh//denied'),
        device('unknown', 'mesh//missing'),
        device('same', 'mesh//target'),
      ],
      groups,
      targetGroupId: 'mesh//target',
      userInfo,
    });

    expect(result.allowed.map(({ id }) => id)).toEqual(['allowed']);
    expect(result.denied.map(({ id }) => id)).toEqual(['denied']);
    expect(result.unknown.map(({ id }) => id)).toEqual(['unknown']);
    expect(result.sameTarget.map(({ id }) => id)).toEqual(['same']);
  });

  it('treats a denied target as denied for every resolved source', () => {
    const result = classifyDeviceGroupMoves({
      devices: [device('one', 'mesh//source')],
      groups,
      targetGroupId: 'mesh//denied',
      userInfo,
    });

    expect(result.denied.map(({ id }) => id)).toEqual(['one']);
    expect(result.allowed).toEqual([]);
  });

  it('only exposes groups the user can manage as targets', () => {
    expect(manageableTargetGroups(groups, userInfo, undefined).map(({ id }) => id)).toEqual([
      'mesh//source',
      'mesh//target',
    ]);
  });

  it('allows all visible groups when the server explicitly grants manage-all', () => {
    expect(
      manageableTargetGroups(groups, { ...userInfo, links: {} }, { manageAllDeviceGroups: true })
        .map(({ id }) => id),
    ).toEqual(groups.map(({ id }) => id));
  });
});