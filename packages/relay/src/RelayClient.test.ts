import { describe, expect, it } from 'vitest';
import { RelayAuthenticationError } from './errors';
import { RelayClient } from './RelayClient';
import { FakeRelayControlChannel, FakeRelayWebSocket } from './testing';

describe('RelayClient', () => {
  it('authorizes, notifies the agent and opens a ready session', async () => {
    const control = new FakeRelayControlChannel();
    const socket = new FakeRelayWebSocket();
    let connectedUrl = '';
    const client = new RelayClient({
      baseUrl: 'https://mesh.example.com/domain',
      control,
      createRelayId: () => 'fixed-relay-id',
      webSocketFactory: (url) => {
        connectedUrl = url;
        return socket;
      },
    });
    const states: string[] = [];

    const creating = client.createSession({
      deviceId: 'node//one',
      protocol: 5,
      onStateChange: ({ current }) => states.push(current),
    });
    await Promise.resolve();
    socket.open();
    socket.message('c');
    const session = await creating;

    expect(control.requests).toEqual([{ action: 'authcookie' }]);
    expect(control.sent).toEqual([
      {
        action: 'msg',
        nodeid: 'node//one',
        type: 'tunnel',
        usage: 5,
        value:
          '*/meshrelay.ashx?p=5&nodeid=node%2F%2Fone&id=fixed-relay-id&rauth=agent-cookie',
        responseid: 'relay-fixed-relay-id',
      },
    ]);
    expect(new URL(connectedUrl).searchParams.get('auth')).toBe('browser-cookie');
    expect(session.id).toBe('fixed-relay-id');
    expect(session.state).toBe('ready');
    expect(states).toEqual([
      'authorizing',
      'notifying',
      'connecting',
      'handshaking',
      'ready',
    ]);
  });

  it('rejects malformed authorization responses before notifying the agent', async () => {
    const control = new FakeRelayControlChannel();
    control.response = { action: 'authcookie' };
    const client = new RelayClient({
      baseUrl: 'wss://mesh.example.com',
      control,
    });

    await expect(
      client.createSession({ deviceId: 'node//one', protocol: 1 }),
    ).rejects.toBeInstanceOf(RelayAuthenticationError);
    expect(control.sent).toEqual([]);
  });

  it('reports authorization failures through the lifecycle callback', async () => {
    const control = new FakeRelayControlChannel();
    control.response = { action: 'authcookie' };
    const client = new RelayClient({
      baseUrl: 'wss://mesh.example.com',
      control,
    });
    const states: string[] = [];

    await expect(
      client.createSession({
        deviceId: 'node//one',
        protocol: 5,
        onStateChange: ({ current }) => states.push(current),
      }),
    ).rejects.toBeInstanceOf(RelayAuthenticationError);

    expect(states).toEqual(['authorizing', 'error']);
  });

  it('exposes the handshake message and close event during session creation', async () => {
    const control = new FakeRelayControlChannel();
    const socket = new FakeRelayWebSocket();
    const client = new RelayClient({
      baseUrl: 'wss://mesh.example.com',
      control,
      webSocketFactory: () => socket,
    });
    const messages: unknown[] = [];
    const closeCodes: Array<number | undefined> = [];

    const creating = client.createSession({
      deviceId: 'node//one',
      protocol: 5,
      onRawMessage: (data) => messages.push(data),
      onClose: (event) => closeCodes.push(event.code),
    });
    await Promise.resolve();
    socket.open();
    socket.message('c');
    const session = await creating;

    session.close();

    expect(messages).toEqual(['c']);
    expect(closeCodes).toEqual([1000]);
  });
});
