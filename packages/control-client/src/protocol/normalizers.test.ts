import { describe, expect, it } from 'vitest';
import {
  normalizeDevices,
  normalizeEvent,
  normalizeGroups,
  normalizeLastConnects,
  normalizeUserInfo,
} from './normalizers';

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
  });
});
