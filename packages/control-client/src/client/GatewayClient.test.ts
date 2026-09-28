import { describe, expect, it, vi } from 'vitest';
import { GatewayAuthenticationError } from '../errors';
import { FakeWebSocket } from '../testing/FakeWebSocket';
import { GatewayClient } from './GatewayClient';

async function connectedClient() {
  const socket = new FakeWebSocket();
  const client = new GatewayClient({ url: 'ws://gateway.test', webSocketFactory: () => socket });
  const connecting = client.connect();
  socket.open();
  socket.message({ type: 'authenticated' });
  await connecting;
  return { client, socket };
}

describe('GatewayClient', () => {
  it('uses a 3 second default request timeout', async () => {
    const socket = new FakeWebSocket();
    const client = new GatewayClient({ url: 'ws://gateway.test', webSocketFactory: () => socket });
    const connecting = client.connect();
    socket.open();
    socket.message({ type: 'authenticated' });
    await connecting;

    vi.useFakeTimers();
    try {
      const request = client.request({ action: 'test' });
      const timedOut = expect(request).rejects.toMatchObject({
        name: 'GatewayRequestTimeoutError',
      });
      await vi.advanceTimersByTimeAsync(2_999);
      expect(vi.getTimerCount()).toBe(1);
      await vi.advanceTimersByTimeAsync(1);
      await timedOut;
    } finally {
      client.destroy();
      vi.useRealTimers();
    }
  });

  it('waits for authentication and emits domain events', async () => {
    const socket = new FakeWebSocket();
    const events: string[] = [];
    const client = new GatewayClient({
      url: 'ws://gateway.test',
      webSocketFactory: () => socket,
      onEvent: (event) => events.push(event.type),
    });
    const connecting = client.connect();
    socket.open();
    socket.message({ action: 'serverinfo' });
    socket.message({ action: 'userinfo', userinfo: { _id: 'user//admin' } });
    await connecting;
    expect(client.connectionStatus).toBe('connected');
    socket.message({
      action: 'event',
      event: { action: 'nodeconnect', nodeid: 'node//one', conn: 0 },
    });
    expect(events).toEqual(['deviceOffline']);
    client.destroy();
  });

  it('emits normalized server information', async () => {
    const socket = new FakeWebSocket();
    const client = new GatewayClient({ url: 'ws://gateway.test', webSocketFactory: () => socket });
    const serverInfo = vi.fn();
    client.on('serverInfo', serverInfo);
    const connecting = client.connect();
    socket.open();
    socket.message({ action: 'serverinfo', features: 3, managealldevicegroups: 1 });
    socket.message({ action: 'userinfo', userinfo: { _id: 'user//admin' } });
    await connecting;
    expect(serverInfo).toHaveBeenCalledWith(
      expect.objectContaining({ features: 3, manageAllDeviceGroups: true }),
    );
    client.destroy();
  });

  it('subscribes to normalized server statistics', async () => {
    const { client, socket } = await connectedClient();
    const serverStats = vi.fn();
    const unsubscribe = client.server.subscribeStats(serverStats);
    expect(JSON.parse(socket.sent.at(-1) ?? '{}')).toEqual({
      action: 'serverstats',
      interval: 10_000,
    });

    socket.message({
      action: 'serverstats',
      totalmem: 100,
      freemem: 40,
      cpuavg: [0.1, 0.2, 0.3],
      availablemem: 50,
      values: { ServerState: { AgentSessions: 7, ConnectedUsers: 2 } },
    });
    expect(serverStats).toHaveBeenCalledWith(
      expect.objectContaining({
        totalMemory: 100,
        availableMemory: 50,
        cpuAverage: [0.1, 0.2, 0.3],
        serverState: expect.objectContaining({ agentSessions: 7, connectedUsers: 2 }),
      }),
    );
    unsubscribe();
    client.destroy();
  });

  it('rejects authentication failures', async () => {
    const socket = new FakeWebSocket();
    const client = new GatewayClient({ url: 'ws://gateway.test', webSocketFactory: () => socket });
    const connecting = client.connect();
    socket.open();
    socket.message({ action: 'close', cause: 'noauth', msg: 'tokenrequired' });
    await expect(connecting).rejects.toBeInstanceOf(GatewayAuthenticationError);
  });

  it('matches concurrent responseid-less system information by device id', async () => {
    const { client, socket } = await connectedClient();
    const first = client.devices.systemInfo<{ nodeid: string }>('node//one');
    const second = client.devices.systemInfo<{ nodeid: string }>('node//two');
    socket.message({ action: 'getsysinfo', nodeid: 'node//two' });
    socket.message({ action: 'getsysinfo', nodeid: 'node//one' });
    await expect(first).resolves.toMatchObject({ nodeid: 'node//one' });
    await expect(second).resolves.toMatchObject({ nodeid: 'node//two' });
    client.destroy();
  });

  it('serializes and matches responseid-less event history responses', async () => {
    const { client, socket } = await connectedClient();
    const first = client.events.list({ limit: 60 });
    const second = client.events.list({ limit: 100 });
    const requests = () =>
      socket.sent.map((item) => JSON.parse(item)).filter((item) => item.action === 'events');
    await vi.waitFor(() => expect(requests()).toHaveLength(1));

    socket.message({
      action: 'events',
      events: [{ action: 'agentlog', nodeid: 'node//one', time: '2026-09-02T00:00:00.000Z' }],
    });
    await expect(first).resolves.toMatchObject([{ type: 'agentLog', deviceId: 'node//one' }]);
    await vi.waitFor(() => expect(requests()).toHaveLength(2));
    socket.message({ action: 'events', events: [] });
    await expect(second).resolves.toEqual([]);
    client.destroy();
  });

  it('serializes responseid-less authcookie requests', async () => {
    const { client, socket } = await connectedClient();
    const first = client.request<{ cookie: string }>({ action: 'authcookie' });
    const second = client.request<{ cookie: string }>({ action: 'authcookie' });
    const requests = () =>
      socket.sent.map((item) => JSON.parse(item)).filter((item) => item.action === 'authcookie');
    await vi.waitFor(() => expect(requests()).toHaveLength(1));
    socket.message({ cookie: 'one', rcookie: 'agent-one' });
    await expect(first).resolves.toMatchObject({ cookie: 'one' });
    await vi.waitFor(() => expect(requests()).toHaveLength(2));
    socket.message({ cookie: 'two', rcookie: 'agent-two' });
    await expect(second).resolves.toMatchObject({ cookie: 'two' });
    client.destroy();
  });

  it('serializes and matches responseid-less user list responses', async () => {
    const { client, socket } = await connectedClient();
    const first = client.users.list();
    const second = client.users.list();
    const requests = () =>
      socket.sent.map((item) => JSON.parse(item)).filter((item) => item.action === 'users');
    await vi.waitFor(() => expect(requests()).toHaveLength(1));

    socket.message({
      action: 'users',
      users: [{ _id: 'user//one', name: 'one', siteadmin: 0 }],
    });
    await expect(first).resolves.toMatchObject([{ id: 'user//one', name: 'one' }]);
    await vi.waitFor(() => expect(requests()).toHaveLength(2));
    socket.message({
      action: 'users',
      users: [{ _id: 'user//two', name: 'two', siteadmin: 0 }],
    });
    await expect(second).resolves.toMatchObject([{ id: 'user//two', name: 'two' }]);
    client.destroy();
  });

  it('matches responseid-less user session count responses', async () => {
    const { client, socket } = await connectedClient();
    const counts = client.users.listSessionCounts();
    await vi.waitFor(() =>
      expect(
        socket.sent
          .map((item) => JSON.parse(item))
          .filter((item) => item.action === 'wssessioncount'),
      ).toHaveLength(1),
    );
    socket.message({
      action: 'wssessioncount',
      wssessions: { 'user//admin': 2, 'user//operator': 1 },
    });
    await expect(counts).resolves.toEqual({ 'user//admin': 2, 'user//operator': 1 });
    client.destroy();
  });

  it('matches and normalizes responseid-less previous login responses', async () => {
    const { client, socket } = await connectedClient();
    const logins = client.users.listPreviousLogins();
    await vi.waitFor(() =>
      expect(
        socket.sent
          .map((item) => JSON.parse(item))
          .filter((item) => item.action === 'previousLogins'),
      ).toHaveLength(1),
    );
    socket.message({
      action: 'previousLogins',
      events: [
        {
          t: '2026-09-28T01:10:09.575Z',
          m: 107,
          a: ['172.19.0.1', 'Edge/153.0.0.0', 'Windows'],
        },
      ],
    });
    await expect(logins).resolves.toEqual([
      {
        occurredAt: '2026-09-28T01:10:09.575Z',
        messageId: 107,
        ip: '172.19.0.1',
        client: 'Edge/153.0.0.0',
        platform: 'Windows',
      },
    ]);
    client.destroy();
  });

  it('isolates listener failures', async () => {
    const { client, socket } = await connectedClient();
    const diagnostics: string[] = [];
    const received: string[] = [];
    client.on('diagnostic', (value) => diagnostics.push(value.type));
    client.on('event', () => {
      throw new Error('listener failed');
    });
    client.on('event', (event) => received.push(event.type));
    socket.message({ action: 'event', event: { action: 'agentlog', nodeid: 'one', msg: 'done' } });
    expect(received).toEqual(['agentLog']);
    expect(diagnostics).toContain('listener-error');
    client.destroy();
  });
});
