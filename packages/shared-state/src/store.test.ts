import { describe, expect, it } from 'vitest';
import { createMeshCentralControlStore, meshCentralControlSelectors } from './store';

describe('gateway store', () => {
  it('applies snapshots and device events', () => {
    const store = createMeshCentralControlStore();
    store.getState().replaceDevices([{ id: 'node-1', name: 'Server 1', online: false }]);
    store.getState().replaceGroups([{ id: 'group-1', name: 'Servers' }]);

    expect(store.getState().devices['node-1']?.online).toBe(false);
    expect(store.getState().groups['group-1']?.name).toBe('Servers');

    store.getState().upsertDevice({ id: 'node-1', name: 'Server 1', online: true });
    store.getState().appendEvent({
      id: 'event-1',
      type: 'deviceOnline',
      deviceId: 'node-1',
      occurredAt: new Date().toISOString(),
    });

    expect(store.getState().devices['node-1']).toMatchObject({ name: 'Server 1', online: true });
    expect(store.getState().events[0]?.type).toBe('deviceOnline');
  });

  it('replaces normalized devices', () => {
    const store = createMeshCentralControlStore();
    store.getState().replaceDevices([
      {
        id: 'node/domain/device1',
        name: 'Web Server',
        online: true,
        groupId: 'mesh/domain/group1',
      },
      {
        id: 'node/domain/device2',
        name: 'DB Server',
        online: false,
        groupId: 'mesh/domain/group1',
        lastSeenAt: '2024-03-09T16:00:00.000Z',
      },
    ]);
    const devices = meshCentralControlSelectors.devices(store.getState());
    expect(devices).toHaveLength(2);
    expect(devices[0]).toMatchObject({
      id: 'node/domain/device1',
      name: 'Web Server',
      online: true,
      groupId: 'mesh/domain/group1',
    });
    expect(devices[1]).toMatchObject({
      id: 'node/domain/device2',
      name: 'DB Server',
      online: false,
      groupId: 'mesh/domain/group1',
      lastSeenAt: '2024-03-09T16:00:00.000Z',
    });
  });

  it('preserves last-seen values when replacing devices', () => {
    const store = createMeshCentralControlStore();
    store.getState().replaceDevices([
      { id: 'node/domain/device1', name: 'Web Server', online: true },
      { id: 'node/domain/device2', name: 'DB Server', online: false },
    ]);

    store.getState().upsertDevice({
      ...store.getState().devices['node/domain/device1']!,
      lastSeenAt: '2024-07-03T09:46:40.000Z',
    });
    store.getState().upsertDevice({
      ...store.getState().devices['node/domain/device2']!,
      lastSeenAt: '2024-03-09T16:00:00.000Z',
    });

    expect(store.getState().devices['node/domain/device1']?.lastSeenAt).toBe(
      '2024-07-03T09:46:40.000Z',
    );
    expect(store.getState().devices['node/domain/device2']?.lastSeenAt).toBe(
      '2024-03-09T16:00:00.000Z',
    );

    store.getState().replaceDevices([
      { id: 'node/domain/device1', name: 'Web Server Renamed', online: true },
      { id: 'node/domain/device2', name: 'DB Server', online: false },
    ]);
    expect(store.getState().devices['node/domain/device1']?.lastSeenAt).toBe(
      '2024-07-03T09:46:40.000Z',
    );
  });

  it('replaces normalized groups', () => {
    const store = createMeshCentralControlStore();
    store
      .getState()
      .replaceGroups([
        { id: 'mesh/domain/group1', name: 'Production', description: 'Prod Servers' },
      ]);
    const groups = meshCentralControlSelectors.groups(store.getState());
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      id: 'mesh/domain/group1',
      name: 'Production',
      description: 'Prod Servers',
    });
  });

  it('stores normalized user information', () => {
    const store = createMeshCentralControlStore();
    store.getState().setUserInfo({
      id: 'user//admin',
      name: '系统管理员',
      email: 'admin@example.com',
      siteadmin: 1,
      removeRights: 0,
      links: {},
      creationAt: '2023-11-14T22:13:20.000Z',
      lastLoginAt: '2024-03-09T16:00:00.000Z',
      lastAccessAt: '2024-03-09T16:01:40.000Z',
      previousLoginAt: '2024-02-27T02:13:20.000Z',
      language: 'zh-cn',
    });
    const userInfo = meshCentralControlSelectors.userInfo(store.getState());
    expect(userInfo).toMatchObject({
      id: 'user//admin',
      name: '系统管理员',
      email: 'admin@example.com',
      siteadmin: 1,
      creationAt: '2023-11-14T22:13:20.000Z',
      lastLoginAt: '2024-03-09T16:00:00.000Z',
      lastAccessAt: '2024-03-09T16:01:40.000Z',
      previousLoginAt: '2024-02-27T02:13:20.000Z',
      language: 'zh-cn',
    });
  });

  it('clears authorization snapshots between sessions', () => {
    const store = createMeshCentralControlStore();
    store.getState().replaceDevices([{ id: 'node-1', name: 'One', online: true }]);
    store.getState().replaceGroups([{ id: 'mesh-1', name: 'One' }]);
    store.getState().setUserInfo({ id: 'user-1', removeRights: 0, links: {} });
    store.getState().setServerInfo({ features: 1 });
    store.getState().clearAuthorizationSnapshot();
    expect(store.getState()).toMatchObject({
      devices: {},
      groups: {},
      userInfo: undefined,
      serverInfo: undefined,
    });
  });

  it('removes devices', () => {
    const store = createMeshCentralControlStore();
    store.getState().upsertDevice({ id: 'node-2', name: 'Server 2', online: true });
    store.getState().removeDevice('node-2');
    expect(store.getState().devices['node-2']).toBeUndefined();
  });

  it('ignores unknown events and does not store them in state', () => {
    const store = createMeshCentralControlStore();

    store.getState().appendEvent({
      id: 'evt-1',
      type: 'unknown',
      message: 'unknown',
      occurredAt: new Date().toISOString(),
    });
    expect(store.getState().events).toHaveLength(0);
  });

  it('updates device data on changenode event without changing online status if not provided', () => {
    const store = createMeshCentralControlStore();
    store.getState().upsertDevice({ id: 'node/1', name: 'Old Name', online: true });

    store
      .getState()
      .upsertDevice({ id: 'node/1', name: 'New Name', online: undefined as unknown as boolean });

    expect(store.getState().devices['node/1']?.name).toBe('New Name');
    expect(store.getState().devices['node/1']?.online).toBe(true);
    expect(store.getState().events).toHaveLength(0);

    // 测试直接调用 appendEvent 传入 deviceChanged 类型事件
    store.getState().appendEvent({
      id: 'evt-2',
      type: 'deviceChanged',
      deviceId: 'node/1',
      message: '设备信息变更',
      occurredAt: new Date().toISOString(),
    });
    expect(store.getState().events).toHaveLength(0);
  });

  it('stores device, relay and agent events', () => {
    const store = createMeshCentralControlStore();
    store.getState().upsertDevice({ id: 'node-1', name: 'Server 1', online: true });

    store.getState().upsertDevice({
      id: 'node-1',
      name: 'Server 1',
      online: false,
      lastSeenAt: '2024-07-03T09:46:40.000Z',
    });
    store.getState().appendEvent({
      id: 'offline',
      type: 'deviceOffline',
      deviceId: 'node-1',
      occurredAt: '2024-07-03T09:46:40.000Z',
    });
    expect(store.getState().devices['node-1']?.online).toBe(false);
    expect(store.getState().devices['node-1']?.lastSeenAt).toBe('2024-07-03T09:46:40.000Z');
    expect(store.getState().events[0]?.type).toBe('deviceOffline');

    store.getState().appendEvent({
      id: 'relay',
      type: 'relayLog',
      deviceId: 'node-1',
      message: 'Ended desktop session',
      occurredAt: new Date().toISOString(),
    });
    expect(store.getState().events[0]?.type).toBe('relayLog');
    expect(store.getState().events[0]?.message).toContain('Ended desktop session');

    store.getState().appendEvent({
      id: 'agent',
      type: 'agentLog',
      deviceId: 'node-1',
      occurredAt: new Date().toISOString(),
    });
    expect(store.getState().events[0]?.type).toBe('agentLog');
  });

  it('transitions offline devices to online', () => {
    const store = createMeshCentralControlStore();
    store.getState().upsertDevice({ id: 'node-offline', name: 'Offline Server', online: false });

    store.getState().upsertDevice({ id: 'node-offline', name: 'Offline Server', online: true });
    store.getState().appendEvent({
      id: 'online',
      type: 'deviceOnline',
      deviceId: 'node-offline',
      occurredAt: new Date().toISOString(),
    });

    expect(store.getState().devices['node-offline']?.online).toBe(true);
    expect(store.getState().events[0]?.type).toBe('deviceOnline');
  });

  it('returns stable collection selector snapshots until their records change', () => {
    const store = createMeshCentralControlStore();
    const initialState = store.getState();

    expect(meshCentralControlSelectors.devices(initialState)).toBe(meshCentralControlSelectors.devices(initialState));
    expect(meshCentralControlSelectors.groups(initialState)).toBe(meshCentralControlSelectors.groups(initialState));

    const initialDevices = meshCentralControlSelectors.devices(initialState);
    store.getState().upsertDevice({ id: 'node-3', name: 'Server 3', online: true });

    expect(meshCentralControlSelectors.devices(store.getState())).not.toBe(initialDevices);
  });

  it('keeps the newest 100 realtime events in newest-first order', () => {
    const store = createMeshCentralControlStore();
    for (let index = 0; index < 101; index += 1) {
      store.getState().appendEvent({
        id: `event-${index}`,
        type: 'agentLog',
        occurredAt: new Date(1_710_000_000_000 + index).toISOString(),
      });
    }
    expect(store.getState().events).toHaveLength(100);
    expect(store.getState().events[0]?.id).toBe('event-100');
    expect(store.getState().events.at(-1)?.id).toBe('event-1');
  });
});
