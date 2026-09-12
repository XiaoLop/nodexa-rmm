import { describe, expect, it, vi } from 'vitest';
import { RelayConnection } from '../../RelayConnection';
import { RelaySession } from '../../RelaySession';
import { FakeRelayWebSocket } from '../../testing';
import { createTerminalOptionsMessage } from './controlMessages';
import { TerminalSession } from './TerminalSession';

async function createTerminalSession() {
  const socket = new FakeRelayWebSocket();
  let recorded = false;
  const connection = new RelayConnection({
    baseUrl: 'wss://mesh.example.com/domain',
    deviceId: 'node//one',
    protocol: 1,
    relayId: 'relay-id',
    authCookie: 'cookie',
    webSocketFactory: () => socket,
    onHandshakeMessage: (message) => {
      recorded = message === 'cr';
    },
    createStartupMessages: () => [createTerminalOptionsMessage(1, { cols: 120, rows: 30 }), '1'],
  });
  const connecting = connection.connect();
  socket.open();
  socket.message('c');
  await connecting;
  const relay = new RelaySession({
    id: 'relay-id',
    deviceId: 'node//one',
    protocol: 1,
    connection,
  });
  socket.sent.length = 0;
  const terminal = new TerminalSession(relay, {
    initialSize: { cols: 120, rows: 30 },
    recorded,
    rttIntervalMs: 0,
  });
  return { socket, terminal };
}

describe('TerminalSession', () => {
  it('forwards strings and bounded binary views without filtering ordinary JSON', async () => {
    const { socket, terminal } = await createTerminalSession();
    const output: Array<string | Uint8Array> = [];
    terminal.onData((data) => output.push(data));
    const bytes = new Uint8Array([9, 1, 2, 8]);

    socket.message('{"status":"ok"}');
    socket.message(bytes.subarray(1, 3));
    await vi.waitFor(() => expect(output).toHaveLength(2));

    expect(output[0]).toBe('{"status":"ok"}');
    expect(Array.from(output[1] as Uint8Array)).toEqual([1, 2]);
  });

  it('filters known control messages and measures matching RTT responses', async () => {
    let now = 1_000;
    const socket = new FakeRelayWebSocket();
    const connection = new RelayConnection({
      baseUrl: 'wss://mesh.example.com',
      deviceId: 'node//one',
      protocol: 1,
      relayId: 'relay-id',
      authCookie: 'cookie',
      webSocketFactory: () => socket,
    });
    const connecting = connection.connect();
    socket.open();
    socket.message('c');
    await connecting;
    const terminal = new TerminalSession(
      new RelaySession({ id: 'relay-id', deviceId: 'node//one', protocol: 1, connection }),
      { initialSize: { cols: 80, rows: 24 }, now: () => now, rttIntervalMs: 10_000 },
    );
    const output: Array<string | Uint8Array> = [];
    const latency: Array<number | undefined> = [];
    terminal.onData((data) => output.push(data));
    terminal.onLatencyChange((value) => latency.push(value));
    expect(socket.sent.at(-1)).toBe('{"ctrlChannel":"102938","type":"rtt","time":1000}');

    now = 1_025;
    socket.message('{"ctrlChannel":102938,"type":"rtt","time":1000}');
    await vi.waitFor(() => expect(latency).toEqual([25]));
    expect(output).toEqual([]);
    terminal.close();
  });

  it('encodes keyboard input as binary and deduplicates validated resize messages', async () => {
    const { socket, terminal } = await createTerminalSession();
    terminal.write('echo ok\r');
    terminal.resize({ cols: 120, rows: 30 });
    terminal.resize({ cols: 121, rows: 31 });

    expect(Array.from(socket.sent[0] as Uint8Array)).toEqual(Array.from(new TextEncoder().encode('echo ok\r')));
    expect(socket.sent[1]).toBe(
      '{"ctrlChannel":"102938","type":"termsize","cols":121,"rows":31}',
    );
    expect(() => terminal.resize({ cols: 1, rows: 20 })).toThrow(/supported range/);
  });

  it('keeps asynchronous Blob messages in receive order', async () => {
    const { socket, terminal } = await createTerminalSession();
    const output: number[][] = [];
    terminal.onData((data) => {
      if (typeof data !== 'string') output.push(Array.from(data));
    });

    socket.message(new Blob([new Uint8Array([1])]));
    socket.message(new Uint8Array([2]));
    await vi.waitFor(() => expect(output).toEqual([[1], [2]]));
  });

  it('closes the relay when pending output exceeds the configured limit', async () => {
    const { socket, terminal } = await createTerminalSession();
    const limited = new TerminalSession(terminal.relay, {
      initialSize: { cols: 120, rows: 30 },
      maxPendingOutputBytes: 1,
      rttIntervalMs: 0,
    });
    socket.message(new Uint8Array([1, 2]));

    expect(limited.state).toBe('error');
    expect(socket.closeCode).toBe(4009);
  });
});