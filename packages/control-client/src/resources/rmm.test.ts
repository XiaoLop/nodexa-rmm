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
});
