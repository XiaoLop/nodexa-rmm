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
        'mesh//one': [{ _id: 'node//one', name: 'Server', conn: 1, agent: { ver: 123 } }],
      })[0],
    ).toMatchObject({ id: 'node//one', groupId: 'mesh//one', online: true, agentVersion: '123' });
    expect(
      normalizeGroups([{ _id: 'mesh//one', name: 'Servers', desc: 'Production' }])[0],
    ).toMatchObject({ id: 'mesh//one', description: 'Production' });
    expect(normalizeLastConnects({ 'node//one': 1_710_000_000 })['node//one']).toBe(
      '2024-03-09T16:00:00.000Z',
    );
    expect(
      normalizeUserInfo({ action: 'userinfo', userinfo: { _id: 'user//admin', name: 'Admin' } }),
    ).toMatchObject({ id: 'user//admin', name: 'Admin' });
  });

  it('normalizes realtime events', () => {
    expect(normalizeEvent({ action: 'nodeconnect', nodeid: 'one', conn: 0 })?.type).toBe(
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
            siteadmin: -1,
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
      siteRights: 0xffffffff,
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
});
