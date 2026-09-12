import { describe, expect, it, vi } from 'vitest';
import { RelayCancelledError, RelayHandshakeError, RelayTimeoutError } from './errors';
import { RelayConnection } from './RelayConnection';
import { FakeRelayWebSocket } from './testing';

function createConnection(
  socket: FakeRelayWebSocket,
  options: {
    connectionTimeoutMs?: number;
    handshakeTimeoutMs?: number;
    createStartupMessages?: () => readonly string[];
  } = {},
) {
  return new RelayConnection({
    baseUrl: 'wss://mesh.example.com/domain',
    deviceId: 'node//one',
    protocol: 5,
    relayId: 'relay-id',
    authCookie: 'cookie',
    webSocketFactory: () => socket,
    ...options,
  });
}

describe('RelayConnection', () => {
  it('completes the handshake and transports text, JSON and binary data', async () => {
    const socket = new FakeRelayWebSocket();
    const connection = createConnection(socket);
    const states: string[] = [];
    const messages: unknown[] = [];
    connection.on('state', ({ current }) => states.push(current));
    connection.on('message', (data) => messages.push(data));

    const connecting = connection.connect();
    socket.open();
    socket.message('c');
    await connecting;

    const binary = new Uint8Array([1, 2, 3]);
    connection.sendText('hello');
    connection.sendJson({ action: 'list' });
    connection.sendBinary(binary);
    socket.message('response');

    expect(connection.state).toBe('ready');
    expect(states).toEqual(['connecting', 'handshaking', 'ready']);
    expect(socket.sent).toEqual(['5', 'hello', '{"action":"list"}', binary]);
    expect(messages).toEqual(['response']);

    connection.close();
    expect(connection.state).toBe('closed');
  });

  it('rejects an invalid handshake', async () => {
    const socket = new FakeRelayWebSocket();
    const connection = createConnection(socket);
    const connecting = connection.connect();
    socket.open();
    socket.message('invalid');

    await expect(connecting).rejects.toBeInstanceOf(RelayHandshakeError);
    expect(connection.state).toBe('error');
  });

  it('accepts a recorded-session handshake and starts the selected protocol', async () => {
    const socket = new FakeRelayWebSocket();
    const connection = createConnection(socket);
    const connecting = connection.connect();
    socket.open();
    socket.message('cr');

    await connecting;
    expect(connection.state).toBe('ready');
    expect(socket.sent).toEqual(['5']);
  });

  it('sends protocol-specific startup messages before becoming ready', async () => {
    const socket = new FakeRelayWebSocket();
    const connection = createConnection(socket, {
      createStartupMessages: () => [
        JSON.stringify({ type: 'options', protocol: 1, cols: 120, rows: 30 }),
        '1',
      ],
    });
    const states: string[] = [];
    connection.on('state', ({ current }) => states.push(current));
    const connecting = connection.connect();
    socket.open();
    socket.message('c');

    await connecting;
    expect(socket.sent).toEqual([
      '{"type":"options","protocol":1,"cols":120,"rows":30}',
      '1',
    ]);
    expect(states).toEqual(['connecting', 'handshaking', 'ready']);
  });

  it('times out while waiting for the handshake', async () => {
    vi.useFakeTimers();
    const socket = new FakeRelayWebSocket();
    const connection = createConnection(socket, { handshakeTimeoutMs: 10 });
    const connecting = connection.connect();
    const rejection = expect(connecting).rejects.toBeInstanceOf(RelayTimeoutError);
    socket.open();
    await vi.advanceTimersByTimeAsync(11);

    await rejection;
    vi.useRealTimers();
  });

  it('supports cancellation through AbortSignal', async () => {
    const socket = new FakeRelayWebSocket();
    const connection = createConnection(socket);
    const controller = new AbortController();
    const connecting = connection.connect(controller.signal);
    controller.abort();

    await expect(connecting).rejects.toBeInstanceOf(RelayCancelledError);
    expect(socket.closeCode).toBe(4000);
  });

  it('reports an unexpected disconnect as an error', async () => {
    const socket = new FakeRelayWebSocket();
    const connection = createConnection(socket);
    const errors: Error[] = [];
    connection.on('error', (error) => errors.push(error));
    const connecting = connection.connect();
    socket.open();
    socket.message('c');
    await connecting;

    socket.close(1006, 'Network lost');

    expect(connection.state).toBe('error');
    expect(errors[0]?.message).toBe('Network lost');
  });
});
