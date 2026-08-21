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
  closeCode?: number;
  closeReason?: string;

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

  close(code?: number, reason?: string) {
    this.closeCode = code;
    this.closeReason = reason;
    this.readyState = 3;
    this.onclose?.({ code: code ?? 1000, reason });
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
    await vi.waitFor(() => expect(socket.sent).toHaveLength(1));
    socket.message({ type: 'authenticated' });
    await connecting;

    expect(socket.sent.map((item) => JSON.parse(item))).toEqual([
      { type: 'authenticate', token: 'token' },
      { action: 'meshes', responseid: 'req-groups' },
      { action: 'nodes', responseid: 'req-nodes' },
      { action: 'lastconnects', tag: 'req-lastconnects' },
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
    sockets[0]?.message({ type: 'authenticated' });
    await connecting;
    client.disconnect();
    await vi.advanceTimersByTimeAsync(20);
    expect(sockets).toHaveLength(1);
    vi.useRealTimers();
  });

  it('waits for all MeshCentral authentication messages before connecting', async () => {
    const socket = new FakeWebSocket();
    const store = createGatewayStore();
    const client = new GatewayClient({
      url: 'ws://gateway.test',
      store,
      webSocketFactory: () => socket,
    });

    const connecting = client.connect();
    socket.open();
    socket.message({ action: 'serverinfo', serverinfo: {} });
    socket.message({ action: 'userinfo', userinfo: {} });
    socket.message({ action: 'traceinfo' });
    await Promise.resolve();
    expect(store.getState().status).toBe('connecting');

    socket.message({ action: 'serverwarnings', warnings: [] });
    await connecting;
    expect(store.getState().status).toBe('connected');
    expect(socket.sent.map((item) => JSON.parse(item))).toEqual([
      { action: 'meshes', responseid: 'req-groups' },
      { action: 'nodes', responseid: 'req-nodes' },
      { action: 'lastconnects', tag: 'req-lastconnects' },
      { type: 'request', resource: 'snapshot' },
    ]);
    client.destroy();
  });

  it('rejects the connection when authentication fails', async () => {
    const socket = new FakeWebSocket();
    const store = createGatewayStore();
    const client = new GatewayClient({
      url: 'ws://gateway.test',
      store,
      webSocketFactory: () => socket,
    });

    const connecting = client.connect();
    socket.open();
    socket.message({ action: 'close', cause: 'noauth', msg: 'tokenrequired' });

    await expect(connecting).rejects.toThrow('tokenrequired');
    expect(store.getState().status).toBe('error');
    expect(store.getState().error).toBe('tokenrequired');
    expect(socket.closeCode).toBe(4001);
    expect(socket.closeReason).toBe('Authentication failed');
  });
});
