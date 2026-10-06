import { describe, expect, it } from 'vitest';
import { MeshCentralValidationError } from '../errors';
import { MAX_SERVER_FILE_BYTES, type ServerFileTree } from '../serverFiles.types';
import type {
  ConnectionStateChange,
  MeshCentralClientEvents,
  MeshCentralEventChannel,
  MeshCentralListener,
} from '../types';
import { ServerFilesResource } from './serverFiles';

class FakeClient {
  readonly sent: unknown[] = [];
  private readonly listeners = new Map<MeshCentralEventChannel, Set<MeshCentralListener<never>>>();

  send(payload: unknown): void {
    this.sent.push(payload);
  }

  on<K extends MeshCentralEventChannel>(
    channel: K,
    listener: MeshCentralListener<MeshCentralClientEvents[K]>,
  ): () => void {
    const listeners = this.listeners.get(channel) ?? new Set<MeshCentralListener<never>>();
    listeners.add(listener as MeshCentralListener<never>);
    this.listeners.set(channel, listeners);
    return () => listeners.delete(listener as MeshCentralListener<never>);
  }

  emit<K extends MeshCentralEventChannel>(channel: K, value: MeshCentralClientEvents[K]): void {
    for (const listener of [...(this.listeners.get(channel) ?? [])]) listener(value as never);
  }
}

function tree(names: string[], destinationNames: string[] = []): ServerFileTree {
  return {
    receivedAt: new Date(),
    spaces: [
      {
        id: 'user//admin',
        name: 'My Files',
        kind: 'user',
        path: ['user//admin'],
        usedBytes: 0,
        entries: [
          {
            name: 'source',
            kind: 'directory',
            path: ['user//admin', 'source'],
            children: names.map((name) => ({
              name,
              kind: 'file' as const,
              path: ['user//admin', 'source', name],
            })),
          },
          {
            name: 'destination',
            kind: 'directory',
            path: ['user//admin', 'destination'],
            children: destinationNames.map((name) => ({
              name,
              kind: 'file' as const,
              path: ['user//admin', 'destination', name],
            })),
          },
        ],
      },
    ],
  };
}

describe('ServerFilesResource', () => {
  it('lists files from the next files push', async () => {
    const client = new FakeClient();
    const resource = new ServerFilesResource(client);
    const pending = resource.list();

    await Promise.resolve();
    expect(client.sent).toEqual([{ action: 'files' }]);
    const snapshot = tree(['one.txt']);
    client.emit('files', snapshot);
    await expect(pending).resolves.toBe(snapshot);
  });

  it('matches file reads by tag and decodes Base64', async () => {
    const client = new FakeClient();
    const resource = new ServerFilesResource(client);
    const pending = resource.getFile(['user//admin', 'source'], 'one.txt');
    const request = client.sent[0] as Record<string, unknown>;

    client.emit('message', {
      action: 'fileoperation',
      fileop: 'get',
      tag: 'other',
      data: 'bm8=',
    });
    client.emit('message', {
      action: 'fileoperation',
      fileop: 'get',
      tag: request.tag,
      data: 'aGk=',
    });

    await expect(pending).resolves.toEqual(Uint8Array.from([104, 105]));
    expect(request).toMatchObject({
      action: 'fileoperation',
      fileop: 'get',
      path: ['user//admin', 'source'],
      file: 'one.txt',
    });
  });

  it('coalesces concurrent reads of the same file', async () => {
    const client = new FakeClient();
    const resource = new ServerFilesResource(client);
    const first = resource.getFile(['user//admin', 'source'], 'one.txt');
    const second = resource.getFile(['user//admin', 'source'], 'one.txt');

    expect(second).toBe(first);
    expect(client.sent).toHaveLength(1);
    const request = client.sent[0] as Record<string, unknown>;
    client.emit('message', {
      action: 'fileoperation',
      fileop: 'get',
      tag: request.tag,
      data: 'aGk=',
    });

    await expect(Promise.all([first, second])).resolves.toEqual([
      Uint8Array.from([104, 105]),
      Uint8Array.from([104, 105]),
    ]);
  });

  it('waits until every deleted item is absent', async () => {
    const client = new FakeClient();
    const resource = new ServerFilesResource(client);
    let settled = false;
    const pending = resource
      .delete(['user//admin', 'source'], ['one.txt', 'two.txt'])
      .then(() => {
        settled = true;
      });

    client.emit('files', tree(['two.txt']));
    await Promise.resolve();
    expect(settled).toBe(false);
    client.emit('files', tree([]));
    await pending;
    expect(client.sent[0]).toEqual({
      action: 'fileoperation',
      fileop: 'delete',
      path: ['user//admin', 'source'],
      delfiles: ['one.txt', 'two.txt'],
      rec: false,
    });
  });

  it('confirms move only after source and destination both change', async () => {
    const client = new FakeClient();
    const resource = new ServerFilesResource(client);
    let settled = false;
    const pending = resource
      .move(
        ['user//admin', 'source'],
        ['user//admin', 'destination'],
        ['one.txt'],
      )
      .then(() => {
        settled = true;
      });

    client.emit('files', tree(['one.txt'], ['one.txt']));
    await Promise.resolve();
    expect(settled).toBe(false);
    client.emit('files', tree([], ['one.txt']));
    await pending;
  });

  it('enforces names, connection closure, and the inline size boundary', async () => {
    const client = new FakeClient();
    const resource = new ServerFilesResource(client);
    expect(() => resource.createFolder(['user//admin'], '.hidden')).toThrow(
      MeshCentralValidationError,
    );
    expect(() =>
      resource.setFile(['user//admin'], 'large.bin', new Uint8Array(MAX_SERVER_FILE_BYTES)),
    ).toThrow(MeshCentralValidationError);

    const accepted = resource.setFile(
      ['user//admin'],
      'small.bin',
      new Uint8Array(MAX_SERVER_FILE_BYTES - 1),
    );
    const state: ConnectionStateChange = {
      previous: 'connected',
      current: 'disconnected',
      reconnectAttempt: 0,
    };
    client.emit('connection', state);
    await expect(accepted).rejects.toThrow('Control connection closed');
  });
});