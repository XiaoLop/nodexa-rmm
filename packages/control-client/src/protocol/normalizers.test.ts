import { describe, expect, it } from 'vitest';
import {
  normalizeDevices,
  normalizeEvent,
  normalizeGroups,
  normalizeLastConnects,
  normalizeUserInfo,
} from './normalizers';
import {
  isFullAdministrator,
  normalizeManagedUsers,
  normalizeSiteRights,
  normalizeUserSessionCounts,
  setUserLocked,
} from './userNormalizers';

describe('protocol normalizers', () => {
  it('normalizes MeshCentral resources', () => {
    expect(
      normalizeDevices({
        'mesh//one': [
          {
            _id: 'node//one',
            name: 'Server',
            conn: 1,
            mtype: 2,
            osdesc: 'Windows 11',
            icon: 2,
            agent: { id: 4, ver: 123, caps: 7 },
            intelamt: { state: 2, sku: 8 },
          },
        ],
      })[0],
    ).toMatchObject({
      id: 'node//one',
      groupId: 'mesh//one',
      online: true,
      connectionFlags: 1,
      machineType: 2,
      agentId: 4,
      agentCapabilities: 7,
      amtState: 2,
      amtSku: 8,
      isWindows: true,
      agentVersion: '123',
      icon: 2,
    });
    expect(
      normalizeGroups([{ _id: 'mesh//one', name: 'Servers', desc: 'Production' }])[0],
    ).toMatchObject({ id: 'mesh//one', description: 'Production' });
    expect(normalizeLastConnects({ 'node//one': 1_710_000_000 })['node//one']).toBe(
      '2024-03-09T16:00:00.000Z',
    );
    expect(
      normalizeUserInfo({
        action: 'userinfo',
        userinfo: {
          _id: 'user//admin',
          name: 'Admin',
          links: { 'mesh//one': { rights: 1, notify: 66 } },
          notify: { 'mesh//one': 4, 'node//one': 2 },
        },
      }),
    ).toMatchObject({
      id: 'user//admin',
      name: 'Admin',
      links: { 'mesh//one': { notify: 66 } },
      notify: { 'mesh//one': 4, 'node//one': 2 },
    });
  });

  it('defaults an invalid device icon to the desktop icon', () => {
    expect(normalizeDevices({ group: [{ _id: 'missing-icon', name: 'Missing' }] })[0]).toMatchObject({
      icon: 1,
    });
    expect(normalizeDevices({ group: [{ _id: 'invalid-icon', name: 'Invalid', icon: 9 }] })[0]).toMatchObject({
      icon: 1,
    });
    expect(normalizeDevices({ group: [{ _id: 'valid-icon', name: 'Valid', icon: 8 }] })[0]).toMatchObject({
      icon: 8,
    });
  });

  it('uses the Agent connection bit instead of power state for online status', () => {
    expect(normalizeDevices({ group: [{ _id: 'powered', name: 'Powered', pwr: 1 }] })[0]).toMatchObject(
      { online: false },
    );
    expect(
      normalizeDevices({ group: [{ _id: 'amt-only', name: 'AMT only', conn: 2, pwr: 1 }] })[0],
    ).toMatchObject({ online: false, connectionFlags: 2 });
    expect(normalizeDevices({ group: [{ _id: 'unknown', name: 'Unknown' }] })[0]).toMatchObject({
      online: false,
    });
  });

  it('normalizes realtime events', () => {
    expect(normalizeEvent({ action: 'nodeconnect', nodeid: 'one', conn: 0 })?.type).toBe(
      'deviceOffline',
    );
    expect(normalizeEvent({ action: 'nodeconnect', nodeid: 'one', conn: 2 })?.type).toBe(
      'deviceOffline',
    );
    expect(normalizeEvent({ action: 'changenode', nodeid: 'one' })?.type).toBe('deviceChanged');
    expect(normalizeEvent({ action: 'relaylog', nodeid: 'one' })?.type).toBe('relayLog');
    expect(normalizeEvent({ action: 'manual', nodeid: 'one' })?.type).toBe('manualOperation');
  });

  it('normalizes managed users and preserves unsigned site rights', () => {
    expect(
      normalizeManagedUsers({
        users: {
          'user//domain/alice': {
            realname: 'Alice',
            email: 'alice@example.com',
            flags: 1,
            siteadmin: -1,
            removeRights: 1536,
            creation: 1_710_000_000,
            login: 1_710_000_100,
            pastlogin: 1_709_000_000,
            access: 1_710_000_200,
            passchange: 1_700_000_000,
            links: {
              'mesh//one': { rights: -1 },
              'ugrp//operators': { rights: 1 },
            },
          },
        },
      })[0],
    ).toMatchObject({
      id: 'user//domain/alice',
      name: 'alice',
      realName: 'Alice',
      hasImage: true,
      siteRights: 0xffffffff,
      removeRights: 1536,
      locked: false,
      createdAt: '2024-03-09T16:00:00.000Z',
      links: [
        { id: 'mesh//one', type: 'device-group', rights: 0xffffffff },
        { id: 'ugrp//operators', type: 'user-group', rights: 1 },
      ],
    });
    expect(normalizeSiteRights(-1)).toBe(0xffffffff);
    expect(isFullAdministrator(-1)).toBe(true);
    expect(setUserLocked(0x100, true)).toBe(0x120);
    expect(setUserLocked(0x120, false)).toBe(0x100);
    expect(setUserLocked(0xffffffff, false)).toBe(0xffffffdf);
    expect(
      normalizeUserSessionCounts({ action: 'wssessioncount', wssessions: { 'user//admin': 2 } }),
    ).toEqual({ 'user//admin': 2 });
  });

  it('creates stable IDs for equivalent historical and realtime events', () => {
    const event = {
      action: 'agentlog',
      nodeid: 'node//one',
      userid: 'user//admin',
      time: 1_710_000_000,
      msgid: 12,
      msgArgs: ['file.txt', { size: 4 }],
    };
    expect(normalizeEvent(event)?.id).toBe(normalizeEvent({ ...event })?.id);
    expect(normalizeEvent(event)?.id).not.toBe(
      normalizeEvent({ ...event, nodeid: 'node//two' })?.id,
    );
    expect(normalizeEvent(event)?.id).not.toBe(
      normalizeEvent({ ...event, time: 1_710_000_001 })?.id,
    );
  });

  it('normalizes permission relationships without trusting meshrights', () => {
    const devices = normalizeDevices({
        'mesh//one': [{
          _id: 'node//one',
          name: 'One',
          conn: 1,
          meshrights: -1,
          links: { 'ugrp//operators': { rights: -1, name: 'Operators' } },
        }],
      });
    expect(devices).toEqual([
      expect.objectContaining({
        id: 'node//one',
        grants: {
          'ugrp//operators': {
            principalId: 'ugrp//operators',
            rights: 0xffffffff,
            name: 'Operators',
          },
        },
      }),
    ]);
    expect(devices[0]).not.toHaveProperty('effectiveRights');
    expect(
      normalizeUserInfo({
        userinfo: {
          _id: 'user//admin',
          removeRights: -1,
          links: { 'ugrp//operators': { rights: 1, name: 'Operators' } },
        },
      }),
    ).toMatchObject({
      removeRights: 0xffffffff,
      links: {
        'ugrp//operators': {
          id: 'ugrp//operators',
          type: 'user-group',
          rights: 1,
          name: 'Operators',
        },
      },
    });
  });
});
