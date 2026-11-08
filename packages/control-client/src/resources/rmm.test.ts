import { describe, expect, it } from 'vitest';
import { MeshCentralClient } from '../client/MeshCentralClient';
import { FakeWebSocket } from '../testing/FakeWebSocket';

describe('RMM device release', () => {
  it('correlates replies and passes conflicts back without retrying', async () => {
    const socket = new FakeWebSocket();
    const client = new MeshCentralClient({
      url: 'ws://gateway.test',
      webSocketFactory: () => socket,
    });
    try {
      const connecting = client.connect();
      socket.open();
      socket.message({ type: 'authenticated' });
      await connecting;
      const result = client.rmm.releaseDevice('node//one', 'execution', 'Verified ended');
      const command = JSON.parse(socket.sent.at(-1)!);
      expect(command).toMatchObject({
        action: 'plugin',
        plugin: 'rmm',
        subAction: 'releaseDevice',
        nodeId: 'node//one',
        executionId: 'execution',
        reason: 'Verified ended',
      });
      socket.message({ ...command, requestId: 'other', data: {} });
      const rejected = expect(result).rejects.toThrow('OCCUPANCY_CONFLICT');
      socket.message({ ...command, error: 'OCCUPANCY_CONFLICT' });
      await rejected;
      expect(
        socket.sent.filter((entry) => JSON.parse(entry).subAction === 'releaseDevice'),
      ).toHaveLength(1);
    } finally {
      client.destroy();
    }
  });

  it('sends search and version requests with their cursors and propagates unsupported actions', async () => {
    const socket = new FakeWebSocket();
    const client = new MeshCentralClient({
      url: 'ws://gateway.test',
      webSocketFactory: () => socket,
    });
    try {
      const connecting = client.connect();
      socket.open();
      socket.message({ type: 'authenticated' });
      await connecting;
      const search = client.rmm.searchTasks(42, { query: 'ops', status: 'failed' });
      let command = JSON.parse(socket.sent.at(-1)!);
      expect(command).toMatchObject({
        subAction: 'searchTasks',
        before: 42,
        query: 'ops',
        status: 'failed',
      });
      socket.message({ ...command, data: { tasks: [], before: 17 } });
      expect(await search).toEqual({ tasks: [], before: 17 });
      const history = client.rmm.listScriptVersions('script', 3);
      command = JSON.parse(socket.sent.at(-1)!);
      expect(command).toMatchObject({
        subAction: 'listScriptVersions',
        scriptId: 'script',
        before: 3,
      });
      socket.message({ ...command, data: { versions: [{ version: 2 }] } });
      expect(await history).toEqual({ versions: [{ version: 2 }] });
      const version = client.rmm.getScriptVersion('script', 2);
      command = JSON.parse(socket.sent.at(-1)!);
      expect(command).toMatchObject({
        subAction: 'getScriptVersion',
        scriptId: 'script',
        version: 2,
      });
      const rejected = expect(version).rejects.toThrow('UNKNOWN_ACTION');
      socket.message({ ...command, error: 'UNKNOWN_ACTION' });
      await rejected;
    } finally {
      client.destroy();
    }
  });
});
