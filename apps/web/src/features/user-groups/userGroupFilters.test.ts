import type {
  Device,
  DeviceGroup,
  ManagedUser,
  UserGroupLink,
} from '@meshcentral/control-client';
import { describe, expect, it } from 'vitest';
import {
  filterDeviceLinks,
  filterGroupLinks,
  filterMemberLinks,
} from './userGroupFilters';

function link(
  id: string,
  type: UserGroupLink['type'],
  name?: string,
): UserGroupLink {
  return { id, type, rights: 0, name };
}

function member(
  id: string,
  name: string,
  realName?: string,
  email?: string,
): ManagedUser {
  return {
    id,
    name,
    realName,
    email,
    siteRights: 0,
    removeRights: 0,
    locked: false,
    raw: undefined,
  };
}

function deviceGroup(id: string, name: string): DeviceGroup {
  return { id, name };
}

function device(id: string, name: string, groupName?: string): Device {
  return { id, name, groupName, online: true };
}

describe('filterMemberLinks', () => {
  it('returns the original list for empty and whitespace-only queries', () => {
    const links = [link('u1', 'user', 'Alice')];
    const users = [member('u1', 'Alice')];

    expect(filterMemberLinks(links, users, '')).toBe(links);
    expect(filterMemberLinks(links, users, '   ')).toBe(links);
  });

  it('matches name, real name and email case-insensitively', () => {
    const links = [
      link('u1', 'user', 'Alice'),
      link('u2', 'user', 'Bob'),
      link('u3', 'user'),
    ];
    const users = [
      member('u1', 'Alice', 'Alice Smith', 'alice@example.com'),
      member('u2', 'Bob'),
    ];

    expect(filterMemberLinks(links, users, 'ALICE').map((item) => item.id)).toEqual(['u1']);
    expect(filterMemberLinks(links, users, 'smith').map((item) => item.id)).toEqual(['u1']);
    expect(filterMemberLinks(links, users, 'Example.COM').map((item) => item.id)).toEqual(['u1']);
    expect(filterMemberLinks(links, users, 'u2').map((item) => item.id)).toEqual(['u2']);
    expect(filterMemberLinks(links, users, 'nobody')).toEqual([]);
  });

  it('falls back to the link name when the user cannot be resolved', () => {
    const orphan = link('u9', 'user', 'Orphan Member');

    expect(filterMemberLinks([orphan], [], 'orphan')).toEqual([orphan]);
  });

  it('falls back to the link id when the user and name are missing', () => {
    const anonymous = link('user-42', 'user');

    expect(filterMemberLinks([anonymous], [], 'USER-42')).toEqual([anonymous]);
  });
});

describe('filterGroupLinks', () => {
  it('returns the original list for an empty query', () => {
    const links = [link('g1', 'device-group', 'Office')];
    const groups = [deviceGroup('g1', 'Office')];

    expect(filterGroupLinks(links, groups, '')).toBe(links);
  });

  it('matches the resolved device group name case-insensitively', () => {
    const links = [link('g1', 'device-group'), link('g2', 'device-group')];
    const groups = [deviceGroup('g1', 'Office Group'), deviceGroup('g2', 'Lab')];

    expect(filterGroupLinks(links, groups, 'OFFICE').map((item) => item.id)).toEqual(['g1']);
    expect(filterGroupLinks(links, groups, 'g2').map((item) => item.id)).toEqual(['g2']);
    expect(filterGroupLinks(links, groups, 'missing')).toEqual([]);
  });

  it('falls back to the link name and id when the group is unknown', () => {
    const named = link('g9', 'device-group', 'Retired Group');
    const anonymous = link('group-7', 'device-group');

    expect(filterGroupLinks([named], [], 'retired')).toEqual([named]);
    expect(filterGroupLinks([anonymous], [], 'GROUP-7')).toEqual([anonymous]);
  });
});

describe('filterDeviceLinks', () => {
  it('returns the original list for an empty query', () => {
    const links = [link('d1', 'device', 'Workstation')];
    const devices = [device('d1', 'Workstation')];

    expect(filterDeviceLinks(links, devices, '   ')).toBe(links);
  });

  it('matches the device name and device group name case-insensitively', () => {
    const links = [link('d1', 'device'), link('d2', 'device')];
    const devices = [device('d1', 'Workstation', 'Office'), device('d2', 'Server', 'Lab')];

    expect(filterDeviceLinks(links, devices, 'workstation').map((item) => item.id)).toEqual(['d1']);
    expect(filterDeviceLinks(links, devices, 'OFFICE').map((item) => item.id)).toEqual(['d1']);
    expect(filterDeviceLinks(links, devices, 'lab').map((item) => item.id)).toEqual(['d2']);
    expect(filterDeviceLinks(links, devices, 'missing')).toEqual([]);
  });

  it('falls back to the link name and id when the device is unknown', () => {
    const named = link('d9', 'device', 'Retired Device');
    const anonymous = link('device-3', 'device');

    expect(filterDeviceLinks([named], [], 'retired')).toEqual([named]);
    expect(filterDeviceLinks([anonymous], [], 'DEVICE-3')).toEqual([anonymous]);
  });
});
