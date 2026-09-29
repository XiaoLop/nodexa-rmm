import { MeshCentralClient } from '@meshcentral/control-client';
import { describe, expect, it, vi } from 'vitest';
import { FakeWebSocket } from '../../control-client/src/testing/FakeWebSocket';
import { bindMeshCentralClient } from './binding';
import { createMeshCentralControlStore } from './store';

describe('bindMeshCentralClient', () => {
  it('synchronizes snapshots and applies realtime events', async () => {
    const socket = new FakeWebSocket();
    const client = new MeshCentralClient({ url: 'ws://gateway.test', webSocketFactory: () => socket });
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
    binding.dispose();
    client.destroy();
  });

  it('does not write after disposal', async () => {
    const socket = new FakeWebSocket();
    const client = new MeshCentralClient({ url: 'ws://gateway.test', webSocketFactory: () => socket });
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
});
