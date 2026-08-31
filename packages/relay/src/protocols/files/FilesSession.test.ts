import { describe, expect, it, vi } from 'vitest';
import { RelayConnection } from '../../RelayConnection';
import { RelaySession } from '../../RelaySession';
import { FakeRelayWebSocket } from '../../testing';
import { FilesSession } from './FilesSession';
import { normalizeFilePath } from './path';
import { FileOperationError, type UploadSource } from './types';

async function createFilesSession(options: ConstructorParameters<typeof FilesSession>[1] = {}) {
  const socket = new FakeRelayWebSocket();
  const connection = new RelayConnection({
    baseUrl: 'wss://mesh.example.com/domain',
    deviceId: 'node//one',
    protocol: 5,
    relayId: 'relay-id',
    authCookie: 'cookie',
    webSocketFactory: () => socket,
  });
  const connecting = connection.connect();
  socket.open();
  socket.message('c');
  await connecting;
  const relay = new RelaySession({
    id: 'relay-id',
    deviceId: 'node//one',
    protocol: 5,
    connection,
  });
  socket.sent.length = 0;
  return { socket, files: new FilesSession(relay, options) };
}

describe('FilesSession', () => {
  it('lists and normalizes a Windows directory', async () => {
    const { socket, files } = await createFilesSession({ createRequestId: () => 'ls-1' });

    const listing = files.listDirectory('c:/Temp/../Data');
    expect(socket.sent[0]).toBe('{"action":"ls","reqid":"ls-1","path":"C:\\\\Data"}');
    socket.message(
      JSON.stringify({
        path: 'C:\\Data',
        reqid: 'ls-1',
        dir: [
          { n: 'folder', t: 2, d: '2026-01-02T03:04:05.000Z' },
          { n: 'file.txt', t: 3, s: 42 },
        ],
      }),
    );

    await expect(listing).resolves.toMatchObject({
      path: 'C:\\Data',
      entries: [
        { name: 'folder', path: 'C:\\Data\\folder', kind: 'directory' },
        { name: 'file.txt', path: 'C:\\Data\\file.txt', kind: 'file', size: 42 },
      ],
    });
  });

  it('routes only matching request identifiers', async () => {
    const unhandled: unknown[] = [];
    const { socket, files } = await createFilesSession({
      createRequestId: () => 'ls-1',
      onUnhandledMessage: (message) => unhandled.push(message),
    });

    const listing = files.listDirectory('/tmp');
    socket.message(JSON.stringify({ reqid: 'other', path: '/wrong', dir: [] }));
    socket.message(JSON.stringify({ reqid: 'ls-1', path: '/tmp', dir: [] }));

    await expect(listing).resolves.toEqual({ path: '/tmp', entries: [] });
    expect(unhandled).toEqual([{ reqid: 'other', path: '/wrong', dir: [] }]);
  });

  it('parses JSON responses delivered as binary WebSocket frames', async () => {
    const { socket, files } = await createFilesSession({ createRequestId: () => 'ls-binary' });
    const listing = files.listDirectory('');
    socket.message(
      new TextEncoder().encode(JSON.stringify({ reqid: 'ls-binary', path: '', dir: [] })),
    );

    await expect(listing).resolves.toEqual({ path: '', entries: [] });
  });

  it('uploads one chunk at a time after acknowledgements', async () => {
    const reads: Array<[number, number]> = [];
    const progress: number[] = [];
    const source: UploadSource = {
      name: 'demo.bin',
      size: 5,
      async read(start, end) {
        reads.push([start, end]);
        return new Uint8Array([1, 2, 3, 4, 5].slice(start, end));
      },
    };
    const { socket, files } = await createFilesSession({ createRequestId: () => 'up-1' });

    const upload = files.uploadFile('/tmp', source, {
      chunkSize: 2,
      onProgress: (value) => progress.push(value.percentage),
    });
    expect(socket.sent).toHaveLength(1);
    socket.message(JSON.stringify({ action: 'uploadstart', reqid: 'up-1' }));
    await vi.waitFor(() => expect(socket.sent).toHaveLength(2));
    expect(reads).toEqual([[0, 2]]);

    socket.message(JSON.stringify({ action: 'uploadack', reqid: 'up-1' }));
    await vi.waitFor(() => expect(socket.sent).toHaveLength(3));
    expect(reads).toEqual([
      [0, 2],
      [2, 4],
    ]);

    socket.message(JSON.stringify({ action: 'uploadack', reqid: 'up-1' }));
    await vi.waitFor(() => expect(socket.sent).toHaveLength(4));
    expect(reads).toEqual([
      [0, 2],
      [2, 4],
      [4, 5],
    ]);

    socket.message(JSON.stringify({ action: 'uploadack', reqid: 'up-1' }));
    await vi.waitFor(() => expect(socket.sent).toHaveLength(5));
    expect(socket.sent[4]).toBe('{"action":"uploaddone","reqid":"up-1"}');
    socket.message(JSON.stringify({ action: 'uploaddone', reqid: 'up-1' }));

    await expect(upload).resolves.toEqual({
      requestId: 'up-1',
      path: '/tmp',
      name: 'demo.bin',
      size: 5,
    });
    expect(progress.at(-1)).toBe(100);
  });

  it('uses 5 MiB upload chunks by default', async () => {
    const fiveMiB = 5 * 1024 * 1024;
    const reads: Array<[number, number]> = [];
    const source: UploadSource = {
      name: 'large.bin',
      size: fiveMiB + 3,
      async read(start, end) {
        reads.push([start, end]);
        return new Uint8Array(end - start).fill(1);
      },
    };
    const { socket, files } = await createFilesSession({ createRequestId: () => 'up-large' });
    const upload = files.uploadFile('/tmp', source);

    socket.message(JSON.stringify({ action: 'uploadstart', reqid: 'up-large' }));
    await vi.waitFor(() => expect(socket.sent).toHaveLength(2));
    expect(reads).toEqual([[0, fiveMiB]]);
    socket.message(JSON.stringify({ action: 'uploadack', reqid: 'up-large' }));
    await vi.waitFor(() => expect(socket.sent).toHaveLength(3));
    expect(reads).toEqual([
      [0, fiveMiB],
      [fiveMiB, fiveMiB + 3],
    ]);
    socket.message(JSON.stringify({ action: 'uploadack', reqid: 'up-large' }));
    await vi.waitFor(() => expect(socket.sent).toHaveLength(4));
    socket.message(JSON.stringify({ action: 'uploaddone', reqid: 'up-large' }));

    await expect(upload).resolves.toMatchObject({ size: fiveMiB + 3 });
  });

  it('supports empty files and waits for remote completion', async () => {
    const source: UploadSource = {
      name: 'empty.txt',
      size: 0,
      read: vi.fn(),
    };
    const { socket, files } = await createFilesSession({ createRequestId: () => 'up-empty' });

    const upload = files.uploadFile('', source);
    socket.message(JSON.stringify({ action: 'uploadstart', reqid: 'up-empty' }));
    await vi.waitFor(() => expect(socket.sent).toHaveLength(2));
    expect(socket.sent[1]).toBe('{"action":"uploaddone","reqid":"up-empty"}');
    socket.message(JSON.stringify({ action: 'uploaddone', reqid: 'up-empty' }));

    await expect(upload).resolves.toMatchObject({ size: 0 });
    expect(source.read).not.toHaveBeenCalled();
  });

  it('escapes upload chunks that could be mistaken for JSON commands', async () => {
    const source: UploadSource = {
      name: 'command-like.bin',
      size: 2,
      async read() {
        return new Uint8Array([123, 1]);
      },
    };
    const { socket, files } = await createFilesSession({ createRequestId: () => 'up-escape' });
    const upload = files.uploadFile('/tmp', source);
    socket.message(JSON.stringify({ action: 'uploadstart', reqid: 'up-escape' }));
    await vi.waitFor(() => expect(socket.sent).toHaveLength(2));

    expect(Array.from(socket.sent[1] as Uint8Array)).toEqual([0, 123, 1]);
    socket.message(JSON.stringify({ action: 'uploadack', reqid: 'up-escape' }));
    socket.message(JSON.stringify({ action: 'uploaddone', reqid: 'up-escape' }));
    await expect(upload).resolves.toMatchObject({ size: 2 });
  });

  it('cancels an upload and notifies the remote agent', async () => {
    const source: UploadSource = {
      name: 'demo.bin',
      size: 2,
      async read() {
        return new Uint8Array([1, 2]);
      },
    };
    const { socket, files } = await createFilesSession({ createRequestId: () => 'up-cancel' });

    const upload = files.uploadFile('/tmp', source);
    files.cancelActive('Stopped by user.');

    await expect(upload).rejects.toMatchObject({ code: 'cancelled' });
    expect(socket.sent[1]).toBe('{"action":"uploadcancel","reqid":"up-cancel"}');
  });

  it('does not start an operation with an already aborted signal', async () => {
    const { socket, files } = await createFilesSession();
    const controller = new AbortController();
    controller.abort();

    await expect(files.listDirectory('/tmp', { signal: controller.signal })).rejects.toMatchObject({
      code: 'cancelled',
    });
    expect(socket.sent).toEqual([]);
    const listing = files.listDirectory('/tmp');
    const request = JSON.parse(socket.sent[0] as string) as { reqid: string };
    socket.message(JSON.stringify({ reqid: request.reqid, path: '/tmp', dir: [] }));
    await expect(listing).resolves.toEqual({ path: '/tmp', entries: [] });
  });

  it('times out and terminates a pending directory operation', async () => {
    vi.useFakeTimers();
    const { socket, files } = await createFilesSession({ createRequestId: () => 'ls-timeout' });
    const listing = files.listDirectory('/tmp', { timeoutMs: 10 });
    const rejection = expect(listing).rejects.toMatchObject({ code: 'timed-out' });

    await vi.advanceTimersByTimeAsync(11);

    await rejection;
    expect(socket.sent).toHaveLength(1);
    vi.useRealTimers();
  });

  it('treats timeout as inactivity and resets it on matching responses', async () => {
    vi.useFakeTimers();
    const source: UploadSource = {
      name: 'demo.bin',
      size: 2,
      async read(start, end) {
        return new Uint8Array(end - start).fill(1);
      },
    };
    const { socket, files } = await createFilesSession({ createRequestId: () => 'up-active' });
    const upload = files.uploadFile('/tmp', source, { chunkSize: 1, timeoutMs: 10 });

    await vi.advanceTimersByTimeAsync(9);
    socket.message(JSON.stringify({ action: 'uploadstart', reqid: 'up-active' }));
    await vi.advanceTimersByTimeAsync(9);
    socket.message(JSON.stringify({ action: 'uploadack', reqid: 'up-active' }));
    await vi.advanceTimersByTimeAsync(9);
    socket.message(JSON.stringify({ action: 'uploadack', reqid: 'up-active' }));
    await vi.advanceTimersByTimeAsync(9);
    socket.message(JSON.stringify({ action: 'uploaddone', reqid: 'up-active' }));

    await expect(upload).resolves.toMatchObject({ size: 2 });
    vi.useRealTimers();
  });

  it('fails pending work when the relay connection is lost', async () => {
    const { socket, files } = await createFilesSession({ createRequestId: () => 'ls-lost' });
    const listing = files.listDirectory('/tmp');
    socket.close(1006, 'Network lost');

    await expect(listing).rejects.toMatchObject({ code: 'connection-lost' });
  });

  it('rejects unsafe paths and upload names', async () => {
    const { files } = await createFilesSession();
    expect(() => normalizeFilePath('../../secret')).toThrow(FileOperationError);
    await expect(
      files.uploadFile('/tmp', {
        name: '../secret.txt',
        size: 1,
        async read() {
          return new Uint8Array([1]);
        },
      }),
    ).rejects.toMatchObject({ code: 'invalid-path' });
  });
});
