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

  it('requests and resolves device system information by response id', async () => {
    const socket = new FakeWebSocket();
    const client = new GatewayClient({
      url: 'ws://gateway.test',
      store: createGatewayStore(),
      webSocketFactory: () => socket,
    });

    const connecting = client.connect();
    socket.open();
    socket.message({ type: 'authenticated' });
    await connecting;

    const resultPromise = client.requestSystemInfo<{ sysinfo: { hardware: { cpu: string } } }>('node//one');
    const request = JSON.parse(socket.sent.at(-1) ?? '{}') as Record<string, unknown>;
    expect(request).toMatchObject({
      action: 'getsysinfo',
      nodeid: 'node//one',
      nodeinfo: true,
    });

    socket.message({
      action: 'getsysinfo',
      responseid: request.responseid,
      sysinfo: { hardware: { cpu: 'Example CPU' } },
    });

    await expect(resultPromise).resolves.toMatchObject({
      sysinfo: { hardware: { cpu: 'Example CPU' } },
    });
    client.destroy();
  });

  it('resolves a system information response that omits responseid', async () => {
    const socket = new FakeWebSocket();
    const client = new GatewayClient({
      url: 'ws://gateway.test',
      store: createGatewayStore(),
      webSocketFactory: () => socket,
    });

    const connecting = client.connect();
    socket.open();
    socket.message({ type: 'authenticated' });
    await connecting;

    const resultPromise = client.requestSystemInfo<{ hardware: { identifiers: { cpu_name: string } } }>('node//one');
    socket.message({
      action: 'getsysinfo',
      node: { _id: 'node//one' },
      hardware: { identifiers: { cpu_name: 'Example CPU' } },
    });

    await expect(resultPromise).resolves.toMatchObject({
      hardware: { identifiers: { cpu_name: 'Example CPU' } },
    });
    client.destroy();
  });

  it('matches concurrent responseid-less system information responses by node id', async () => {
    const socket = new FakeWebSocket();
    const client = new GatewayClient({
      url: 'ws://gateway.test',
      store: createGatewayStore(),
      webSocketFactory: () => socket,
    });

    const connecting = client.connect();
    socket.open();
    socket.message({ type: 'authenticated' });
    await connecting;

    const first = client.requestSystemInfo<{ nodeid: string }>('node//one');
    const second = client.requestSystemInfo<{ nodeid: string }>('node//two');
    socket.message({ action: 'getsysinfo', nodeid: 'node//two', hardware: {} });
    socket.message({ action: 'getsysinfo', nodeid: 'node//one', hardware: {} });

    await expect(first).resolves.toMatchObject({ nodeid: 'node//one' });
    await expect(second).resolves.toMatchObject({ nodeid: 'node//two' });
    client.destroy();
  });

  it('serializes concurrent authcookie requests whose responses omit responseid', async () => {
    const socket = new FakeWebSocket();
    const client = new GatewayClient({
      url: 'ws://gateway.test',
      store: createGatewayStore(),
      webSocketFactory: () => socket,
    });

    const connecting = client.connect();
    socket.open();
    socket.message({ type: 'authenticated' });
    await connecting;

    const first = client.request<{ cookie: string; rcookie: string }>({ action: 'authcookie' });
    const second = client.request<{ cookie: string; rcookie: string }>({ action: 'authcookie' });
    const authRequests = () =>
      socket.sent
        .map((item) => JSON.parse(item) as Record<string, unknown>)
        .filter((item) => item.action === 'authcookie');

    await vi.waitFor(() => expect(authRequests()).toHaveLength(1));
    socket.message({ action: 'authcookie', cookie: 'browser-one', rcookie: 'agent-one' });
    await expect(first).resolves.toMatchObject({ cookie: 'browser-one' });
    await vi.waitFor(() => expect(authRequests()).toHaveLength(2));

    socket.message({ cookie: 'browser-two', rcookie: 'agent-two' });
    await expect(second).resolves.toMatchObject({ cookie: 'browser-two' });
    client.destroy();
  });
});
