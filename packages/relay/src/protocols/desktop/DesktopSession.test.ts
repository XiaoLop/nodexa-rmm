import { describe, expect, it } from 'vitest';
import { RelayConnection } from '../../RelayConnection';
import { RelaySession } from '../../RelaySession';
import { FakeRelayWebSocket } from '../../testing';
import { DesktopSession } from './DesktopSession';
import { DesktopSessionError } from './types';

async function createDesktopSession(inputAllowed: boolean) {
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
  return { socket, desktop: new DesktopSession(relay, { inputAllowed }) };
}

describe('DesktopSession input', () => {
  it('sends encoded mouse, keyboard, Unicode and CAD commands', async () => {
    const { socket, desktop } = await createDesktopSession(true);
    desktop.sendMouseButton('left', 'down', { x: 100, y: 200 });
    desktop.sendKey(65, 'down');
    desktop.sendUnicode(0x4e2d, 'down');
    desktop.sendCad();

    expect([...socket.sent[0] as Uint8Array]).toEqual([0, 2, 0, 10, 0, 2, 0, 100, 0, 200]);
    expect([...socket.sent[1] as Uint8Array]).toEqual([0, 1, 0, 6, 0, 65]);
    expect([...socket.sent[2] as Uint8Array]).toEqual([0, 85, 0, 7, 0, 0x4e, 0x2d]);
    expect([...socket.sent[3] as Uint8Array]).toEqual([0, 10, 0, 4]);
  });

  it('rejects every input path for view-only sessions', async () => {
    const { desktop } = await createDesktopSession(false);
    expect(() => desktop.sendMouseMove({ x: 1, y: 2 })).toThrow(DesktopSessionError);
    expect(() => desktop.sendKey(65, 'down')).toThrow('not allowed');
    expect(() => desktop.sendCad()).toThrow('not allowed');
  });
});