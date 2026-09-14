import { describe, expect, it, vi } from 'vitest';
import { RelayConnection } from '../../RelayConnection';
import { RelaySession } from '../../RelaySession';
import { FakeRelayWebSocket } from '../../testing';
import { DesktopSession } from './DesktopSession';
import { DesktopSessionError, type DesktopSessionOptions } from './types';

async function createDesktopSession(inputAllowed: boolean, options: Omit<DesktopSessionOptions, 'inputAllowed'> = {}) {
  const socket = new FakeRelayWebSocket();
  const connection = new RelayConnection({
    baseUrl: 'wss://mesh.example.com',
    deviceId: 'node//one',
    protocol: 2,
    relayId: 'relay-id',
    authCookie: 'cookie',
    webSocketFactory: () => socket,
  });
  const connecting = connection.connect();
  socket.open();
  socket.message('c');
  await connecting;
  socket.sent.length = 0;
  const relay = new RelaySession({ id: 'relay-id', deviceId: 'node//one', protocol: 2, connection });
  return { socket, desktop: new DesktopSession(relay, { rttIntervalMs: 0, ...options, inputAllowed }) };
}

describe('DesktopSession input', () => {
  it('sends encoded mouse, keyboard, Unicode and CAD commands', async () => {
    const { socket, desktop } = await createDesktopSession(true);
    desktop.sendMouseButton('left', 'down', { x: 100, y: 200 });
    desktop.sendKey(65, 'down');
    desktop.sendUnicode(0x4e2d, 'down');
    desktop.sendCad();
    desktop.setCompression({ quality: 58 });

    expect([...socket.sent[0] as Uint8Array]).toEqual([0, 2, 0, 10, 0, 2, 0, 100, 0, 200]);
    expect([...socket.sent[1] as Uint8Array]).toEqual([0, 1, 0, 6, 0, 65]);
    expect([...socket.sent[2] as Uint8Array]).toEqual([0, 85, 0, 7, 0, 0x4e, 0x2d]);
    expect([...socket.sent[3] as Uint8Array]).toEqual([0, 10, 0, 4]);
    expect([...socket.sent[4] as Uint8Array]).toEqual([0, 5, 0, 10, 1, 58, 4, 0, 0, 100]);
  });

  it('rejects every input path for view-only sessions', async () => {
    const { desktop } = await createDesktopSession(false);
    expect(() => desktop.sendMouseMove({ x: 1, y: 2 })).toThrow(DesktopSessionError);
    expect(() => desktop.sendKey(65, 'down')).toThrow('not allowed');
    expect(() => desktop.sendCad()).toThrow('not allowed');
    expect(() => desktop.setCompression({ quality: 58 })).not.toThrow();
  });

  it('measures matching desktop control-channel RTT responses', async () => {
    let now = 1_000;
    const { socket, desktop } = await createDesktopSession(true, { now: () => now, rttIntervalMs: 10_000 });
    const latency: Array<number | undefined> = [];
    desktop.onLatencyChange((value) => latency.push(value));
    expect(socket.sent.at(-1)).toBe('{"ctrlChannel":"102938","type":"rtt","time":1000}');

    now = 1_027;
    socket.message('{"ctrlChannel":102938,"type":"rtt","time":1000}');
    await vi.waitFor(() => expect(latency).toEqual([27]));
    desktop.close();
  });
});
