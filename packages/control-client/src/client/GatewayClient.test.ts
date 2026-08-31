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
    socket.message({ action: 'traceinfo' });
    socket.message({ action: 'serverwarnings' });
    await connecting;
    expect(client.connectionStatus).toBe('connected');
    socket.message({
      action: 'event',
      event: { action: 'nodeconnect', nodeid: 'node//one', conn: 0 },
    });
    expect(events).toEqual(['deviceOffline']);
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
