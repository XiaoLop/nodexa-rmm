import { MeshCentralClient } from '@meshcentral/control-client';
import { describe, expect, it, vi } from 'vitest';
import { FakeWebSocket } from '../../control-client/src/testing/FakeWebSocket';
import { bindMeshCentralClient } from './binding';
import { createMeshCentralControlStore } from './store';

describe('bindMeshCentralClient', () => {
  it('synchronizes snapshots and applies realtime events', async () => {
    const socket = new FakeWebSocket();
    const client = new MeshCentralClient({
      url: 'ws://gateway.test',
      webSocketFactory: () => socket,
    });
    const store = createMeshCentralControlStore();
    const binding = bindMeshCentralClient(store, client);
    const connecting = client.connect();
    socket.open();
    socket.message({ type: 'authenticated' });
    await connecting;
    await vi.waitFor(() =>
      expect(socket.sent.map((item) => JSON.parse(item).action).filter(Boolean)).toEqual(
        expect.arrayContaining(['nodes', 'meshes', 'lastconnects']),
      ),
    );
    const requests = socket.sent.map((item) => JSON.parse(item));
    const responseId = (action: string) =>
      requests.find((item) => item.action === action)?.responseid;
    socket.message({
      action: 'nodes',
      responseid: responseId('nodes'),
      nodes: { group: [{ _id: 'node//one', name: 'One', conn: 1 }] },
    });
    socket.message({
      action: 'meshes',
      responseid: responseId('meshes'),
      meshes: [{ _id: 'group', name: 'Servers' }],
    });
    socket.message({
      action: 'lastconnects',
      responseid: responseId('lastconnects'),
      lastconnects: { 'node//one': 1_710_000_000 },
    });
    await vi.waitFor(() =>
      expect(store.getState().devices['node//one']).toMatchObject({
        name: 'One',
        lastSeenAt: '2024-03-09T16:00:00.000Z',
      }),
    );
    socket.message({
      action: 'event',
      event: { action: 'nodeconnect', nodeid: 'node//one', conn: 0 },
    });
    expect(store.getState().devices['node//one']?.online).toBe(false);
    expect(store.getState().events[0]?.type).toBe('deviceOffline');

    socket.message({
      action: 'event',
      event: { action: 'nodeconnect', nodeid: 'node//one', conn: 1, pwr: 1 },
    });
    expect(store.getState().devices['node//one']?.online).toBe(true);
    expect(store.getState().events[0]?.type).toBe('deviceOnline');

    socket.message({
      action: 'event',
      event: {
        action: 'changenode',
        nodeid: 'node//one',
        node: { _id: 'node//one', name: 'Renamed', osdesc: 'Ubuntu 24.04' },
      },
    });
    expect(store.getState().devices['node//one']).toMatchObject({
      name: 'Renamed',
      online: true,
      platform: 'Ubuntu 24.04',
    });
    binding.dispose();
    client.destroy();
  });

  it('does not write after disposal', async () => {
    const socket = new FakeWebSocket();
    const client = new MeshCentralClient({
      url: 'ws://gateway.test',
      webSocketFactory: () => socket,
    });
    const store = createMeshCentralControlStore();
    const binding = bindMeshCentralClient(store, client);
    binding.dispose();
    const connecting = client.connect();
    socket.open();
    socket.message({ type: 'authenticated' });
    await connecting;
    socket.message({ action: 'event', event: { action: 'agentlog', nodeid: 'one' } });
    expect(store.getState().events).toHaveLength(0);
    client.destroy();
  });

  it('binds notifications, warning snapshots, help sessions and account changes', async () => {
    const socket = new FakeWebSocket();
    const client = new MeshCentralClient({
      url: 'ws://gateway.test',
      webSocketFactory: () => socket,
    });
    const store = createMeshCentralControlStore();
    const binding = bindMeshCentralClient(store, client);
    const connecting = client.connect();
    socket.open();
    socket.message({ type: 'authenticated' });
    await connecting;

    socket.message({
      action: 'userinfo',
      userinfo: { _id: 'user//admin', name: 'Admin', siteadmin: 1 },
    });
    socket.message({
      action: 'msg',
      type: 'notify',
      id: 1,
      title: 'Security warning',
      value: 'Failed login attempt',
      msgid: 12,
    });
    socket.message({ action: 'serverwarnings', warnings: [{ id: 3, msg: 'Certificate warning' }] });
    socket.message({
      action: 'event',
      event: {
        action: 'devicesessions',
        nodeid: 'node//one',
        sessions: { help: { Alice: 'Need help' } },
      },
    });
    socket.message({
      action: 'event',
      event: {
        action: 'accountchange',
        account: { _id: 'user//admin', name: 'Administrator', siteadmin: 1024 },
      },
    });

    expect(store.getState().notifications[0]).toMatchObject({
      id: '1',
      source: 'security',
      read: false,
    });
    expect(store.getState().unreadCount).toBe(1);
    expect(store.getState().serverWarnings).toMatchObject([
      { id: 3, message: 'Certificate warning' },
    ]);
    expect(store.getState().helpRequests['node//one']?.requests).toEqual({ Alice: 'Need help' });
    expect(store.getState().userInfo).toMatchObject({
      id: 'user//admin',
      name: 'Administrator',
      siteadmin: 1024,
    });
    binding.dispose();
    client.destroy();
  });

  it('retains cached state during reconnect and clears it on permanent termination', async () => {
    vi.useFakeTimers();
    try {
      const sockets: FakeWebSocket[] = [];
      const client = new MeshCentralClient({
        url: 'ws://gateway.test',
        reconnectDelaysMs: [10],
        webSocketFactory: () => {
          const socket = new FakeWebSocket();
          sockets.push(socket);
          return socket;
        },
      });
      const store = createMeshCentralControlStore();
      const binding = bindMeshCentralClient(store, client);
      const connecting = client.connect();
      sockets[0]!.open();
      sockets[0]!.message({ type: 'authenticated' });
      await connecting;
      store.getState().replaceDevices([{ id: 'node//one', name: 'One', online: true }]);
      sockets[0]!.message({ action: 'msg', type: 'notify', id: 1, value: 'Keep me' });

      sockets[0]!.close(1006, 'Network lost');
      expect(store.getState()).toMatchObject({ cacheStale: true, unreadCount: 1 });
      expect(store.getState().devices['node//one']).toBeDefined();
      await vi.advanceTimersByTimeAsync(10);
      expect(sockets).toHaveLength(2);

      sockets[1]!.open();
      sockets[1]!.message({ type: 'authenticated' });
      sockets[1]!.message({ action: 'stopped', msg: 'Session count exceed' });
      expect(store.getState()).toMatchObject({
        devices: {},
        notifications: [],
        unreadCount: 0,
        helpRequests: {},
        termination: { disposition: 'stopped' },
      });
      binding.dispose();
      client.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('expires notifications and clears expiry timers on disposal', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-10-05T00:00:00.000Z'));
      const socket = new FakeWebSocket();
      const client = new MeshCentralClient({
        url: 'ws://gateway.test',
        webSocketFactory: () => socket,
      });
      const store = createMeshCentralControlStore();
      const binding = bindMeshCentralClient(store, client);
      const connecting = client.connect();
      socket.open();
      socket.message({ type: 'authenticated' });
      await connecting;
      socket.message({ action: 'msg', type: 'notify', id: 1, value: 'Temporary', maxtime: 30 });
      expect(store.getState().notifications).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(30_000);
      expect(store.getState().notifications).toHaveLength(0);

      socket.message({ action: 'msg', type: 'notify', id: 2, value: 'Temporary', maxtime: 30 });
      binding.dispose();
      client.destroy();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('removes notifications received through intersession synchronization', async () => {
    const socket = new FakeWebSocket();
    const client = new MeshCentralClient({
      url: 'ws://gateway.test',
      webSocketFactory: () => socket,
    });
    const store = createMeshCentralControlStore();
    const binding = bindMeshCentralClient(store, client);
    const connecting = client.connect();
    socket.open();
    socket.message({ type: 'authenticated' });
    await connecting;
    socket.message({ action: 'msg', type: 'notify', id: 1, value: 'Remove me' });
    expect(store.getState().notifications).toHaveLength(1);
    socket.message({ action: 'intersession', subaction: 'removeNotify', id: 1 });
    expect(store.getState().notifications).toHaveLength(0);
    expect(store.getState().unreadCount).toBe(0);
    binding.dispose();
    client.destroy();
  });
});
