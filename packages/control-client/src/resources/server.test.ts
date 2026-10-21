import { describe, expect, it, vi } from 'vitest';
import { MeshCentralClient } from '../client/MeshCentralClient';
import { decodePush } from '../protocol/codec';
import { FakeWebSocket } from '../testing/FakeWebSocket';

async function setup() {
  const sockets: FakeWebSocket[] = [];
  const client = new MeshCentralClient({
    url: 'ws://gateway.test',
    webSocketFactory: () => {
      const socket = new FakeWebSocket();
      sockets.push(socket);
      return socket;
    },
  });
  const connecting = client.connect();
  const socket = sockets[0]!;
  socket.open();
  socket.message({ type: 'authenticated' });
  await connecting;
  return { client, socket, sockets };
}

const sent = (socket: FakeWebSocket) => socket.sent.map((value) => JSON.parse(value));
const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

describe('server administration', () => {
  it('sends console commands without waiting for output and streams multiple tagged or untagged outputs', async () => {
    const { client, socket } = await setup();
    try {
      const listener = vi.fn();
      const unsubscribe = client.server.subscribeConsole(listener);
      await expect(client.server.sendConsoleCommand('help', 'console-1')).resolves.toBeUndefined();
      expect(sent(socket).at(-1)).toEqual({
        action: 'serverconsole',
        value: 'help',
        tag: 'console-1',
      });
      await client.server.sendConsoleCommand('info');
      expect(sent(socket).at(-1)).toEqual({ action: 'serverconsole', value: 'info' });
      socket.message({ action: 'serverconsole', value: 'first', tag: 'console-1' });
      socket.message({ action: 'serverconsole', value: 'second', tag: 'console-1' });
      socket.message({ action: 'serverconsole', value: '' });
      expect(listener.mock.calls.map(([output]) => output.text)).toEqual(['first', 'second', '']);
      expect(listener.mock.calls[0]![0]).toEqual({
        text: 'first',
        tag: 'console-1',
        receivedAt: expect.any(Number),
      });
      const count = socket.sent.length;
      unsubscribe();
      socket.message({ action: 'serverconsole', value: 'ignored' });
      expect(listener).toHaveBeenCalledTimes(3);
      expect(socket.sent).toHaveLength(count);
    } finally {
      client.destroy();
    }
    await expect(client.server.sendConsoleCommand('help')).rejects.toThrow();
  });

  it('caches initial trace settings for late mounts, handles global changes and keeps unsubscribe local', async () => {
    const { client, socket } = await setup();
    try {
      expect(client.server.getTraceSources()).toBeUndefined();
      socket.message({ action: 'traceinfo', traceSources: null });
      expect(client.server.getTraceSources()).toEqual([]);
      socket.message({ action: 'traceinfo', traceSources: ['webserver'] });
      expect(client.server.getTraceSources()).toEqual(['webserver']);
      expect(Object.isFrozen(client.server.getTraceSources())).toBe(true);
      const settings = vi.fn();
      const trace = vi.fn();
      const offSettings = client.server.subscribeTraceSources(settings);
      const offTrace = client.server.subscribeTrace(trace);
      await client.server.setTraceSources(['agent']);
      expect(sent(socket).at(-1)).toEqual({ action: 'traceinfo', traceSources: ['agent'] });
      expect(client.server.getTraceSources()).toEqual(['webserver']);
      socket.message({
        action: 'event',
        event: { action: 'traceinfo', traceSources: ['agent'], userid: 'user//admin' },
      });
      socket.message({
        action: 'trace',
        source: 'agent',
        args: ['message', { nested: true }, 1],
        time: 123,
      });
      expect(settings).toHaveBeenCalledWith(['agent']);
      expect(trace).toHaveBeenCalledWith({
        source: 'agent',
        args: ['message', { nested: true }, 1],
        time: 123,
      });
      const count = socket.sent.length;
      offSettings();
      offTrace();
      socket.message({ action: 'traceinfo', traceSources: [] });
      socket.message({ action: 'trace', source: 'agent', args: [], time: 124 });
      expect(settings).toHaveBeenCalledTimes(1);
      expect(trace).toHaveBeenCalledTimes(1);
      expect(client.server.getTraceSources()).toEqual([]);
      expect(socket.sent).toHaveLength(count);
    } finally {
      client.destroy();
    }
  });

  it('clears trace cache on disconnect and reconnect without reapplying settings', async () => {
    const { client, socket, sockets } = await setup();
    try {
      socket.message({ action: 'traceinfo', traceSources: ['agent'] });
      client.disconnect();
      expect(client.server.getTraceSources()).toBeUndefined();
      const connecting = client.connect();
      expect(client.server.getTraceSources()).toBeUndefined();
      const next = sockets[1]!;
      next.open();
      next.message({ action: 'traceinfo', traceSources: ['webserver'] });
      next.message({ type: 'authenticated' });
      await connecting;
      expect(client.server.getTraceSources()).toEqual(['webserver']);
      expect(sent(next).filter((message) => message.action === 'traceinfo')).toEqual([]);
      next.close(1006, 'lost');
      expect(client.server.getTraceSources()).toBeUndefined();
    } finally {
      client.destroy();
    }
  });

  it('serializes uncorrelated error logs and preserves absent versus empty content', async () => {
    const { client, socket } = await setup();
    try {
      const first = client.server.fetchErrorLog();
      const second = client.server.fetchErrorLog();
      await flush();
      expect(sent(socket).filter((message) => message.action === 'servererrors')).toHaveLength(1);
      socket.message({ action: 'servererrors' });
      await expect(first).resolves.toEqual({});
      await flush();
      expect(sent(socket).filter((message) => message.action === 'servererrors')).toHaveLength(2);
      socket.message({ action: 'servererrors', data: '' });
      await expect(second).resolves.toEqual({ content: '' });
      const third = client.server.fetchErrorLog();
      await flush();
      socket.message({ action: 'servererrors', data: 'log text' });
      await expect(third).resolves.toEqual({ content: 'log text' });
      const malformed = client.server.fetchErrorLog();
      await flush();
      socket.message({ action: 'servererrors', data: null });
      await expect(malformed).rejects.toMatchObject({ name: 'MeshCentralProtocolError' });
      await expect(client.server.clearErrorLog()).resolves.toBeUndefined();
      expect(sent(socket).at(-1)).toEqual({ action: 'serverclearerrorlog' });
    } finally {
      client.destroy();
    }
  });

  it('rejects pending and queued error log requests across disconnect', async () => {
    const { client, socket } = await setup();
    try {
      const first = client.server.fetchErrorLog();
      const second = client.server.fetchErrorLog();
      const results = Promise.allSettled([first, second]);
      await flush();
      client.disconnect();
      expect((await results).map((result) => result.status)).toEqual(['rejected', 'rejected']);
      expect(sent(socket).filter((message) => message.action === 'servererrors')).toHaveLength(1);
      await expect(client.server.clearErrorLog()).rejects.toThrow();
    } finally {
      client.destroy();
    }
  });

  it.each([
    { action: 'serverconsole', value: 1 },
    { action: 'serverconsole', value: 'text', tag: 1 },
    { action: 'traceinfo', traceSources: [1] },
    { action: 'traceinfo' },
    { action: 'event', event: { action: 'traceinfo', traceSources: 'agent' } },
    { action: 'trace', source: 'agent', args: 'text', time: 1 },
    { action: 'trace', source: 'agent', args: [], time: '1' },
    { action: 'trace', source: 1, args: [], time: 1 },
  ])('does not emit typed administration data for malformed payload %j', (payload) => {
    const decoded = decodePush(payload);
    expect(decoded.serverConsole).toBeUndefined();
    expect(decoded.traceSources).toBeUndefined();
    expect(decoded.trace).toBeUndefined();
  });

  it('validates outgoing console and trace inputs', async () => {
    const { client, socket } = await setup();
    try {
      const count = socket.sent.length;
      await expect(client.server.sendConsoleCommand(1 as unknown as string)).rejects.toThrow();
      await expect(client.server.setTraceSources(['agent', 1] as string[])).rejects.toThrow();
      expect(socket.sent).toHaveLength(count);
    } finally {
      client.destroy();
    }
  });
});
