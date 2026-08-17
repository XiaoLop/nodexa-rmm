import { describe, expect, it, vi } from 'vitest';
import { GatewayClient } from './client';
import { createGatewayStore } from './store';
import type { CloseEventLike, MessageEventLike, WebSocketLike } from './types';

class FakeWebSocket implements WebSocketLike {
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEventLike) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: ((event: CloseEventLike) => void) | null = null;
  sent: string[] = [];

  open() {
    this.readyState = 1;
    this.onopen?.();
  }

  message(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify(payload) });
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = 3;
    this.onclose?.({ code: 1000 });
  }
}

describe('GatewayClient', () => {
  it('authenticates, requests a snapshot and consumes messages', async () => {
    const socket = new FakeWebSocket();
    const store = createGatewayStore();
    const client = new GatewayClient({
      url: 'ws://gateway.test',
      store,
      webSocketFactory: () => socket,
      getAccessToken: () => 'token',
    });

    const connecting = client.connect();
    socket.open();
    await connecting;

    expect(socket.sent.map((item) => JSON.parse(item))).toEqual([
      { type: 'authenticate', token: 'token' },
      { type: 'request', resource: 'snapshot' },
    ]);

    socket.message({ type: 'snapshot', devices: [{ id: 'one', name: 'One', online: true }] });
    expect(store.getState().devices.one?.online).toBe(true);
    client.destroy();
  });

  it('does not reconnect after a manual disconnect', async () => {
    vi.useFakeTimers();
    const sockets: FakeWebSocket[] = [];
    const client = new GatewayClient({
      url: 'ws://gateway.test',
      store: createGatewayStore(),
      webSocketFactory: () => {
        const socket = new FakeWebSocket();
        sockets.push(socket);
        return socket;
      },
      reconnectDelaysMs: [10],
    });
    const connecting = client.connect();
    sockets[0]?.open();
    await connecting;
    client.disconnect();
    await vi.advanceTimersByTimeAsync(20);
    expect(sockets).toHaveLength(1);
    vi.useRealTimers();
  });
});
