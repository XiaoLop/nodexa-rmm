import { chmod, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { McpToolError } from '../errors';
import { readStoredSession, removeStoredSession, writeStoredSession } from './session-store';

let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'mcp-session-'));
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe('session store', () => {
  it('returns undefined when the file is missing', async () => {
    const file = path.join(directory, 'session.json');
    expect(await readStoredSession({ file })).toBeUndefined();
  });

  it('writes and reads a session', async () => {
    const file = path.join(directory, 'nested', 'session.json');
    await writeStoredSession(
      { file },
      {
        version: 1,
        serverUrl: 'https://mesh.example.com',
        cookieHeader: 'xid=1; xid.sig=2',
        userId: 'user//1/alice',
        userName: 'alice',
        issuedAt: '2026-01-01T00:00:00.000Z',
      },
    );

    const stored = await readStoredSession({ file });
    expect(stored).toMatchObject({
      serverUrl: 'https://mesh.example.com',
      cookieHeader: 'xid=1; xid.sig=2',
      userName: 'alice',
    });
  });

  it('restricts file permissions on posix', async () => {
    if (process.platform === 'win32') return;

    const file = path.join(directory, 'session.json');
    await writeStoredSession(
      { file },
      {
        version: 1,
        serverUrl: 'https://mesh.example.com',
        cookieHeader: 'xid=1',
        issuedAt: '2026-01-01T00:00:00.000Z',
      },
    );
    expect((await stat(file)).mode & 0o777).toBe(0o600);
  });

  it('rejects world-readable session files on posix', async () => {
    if (process.platform === 'win32') return;

    const file = path.join(directory, 'session.json');
    await writeStoredSession(
      { file },
      {
        version: 1,
        serverUrl: 'https://mesh.example.com',
        cookieHeader: 'xid=1',
        issuedAt: '2026-01-01T00:00:00.000Z',
      },
    );
    await chmod(file, 0o644);

    await expect(readStoredSession({ file })).rejects.toBeInstanceOf(McpToolError);
  });

  it('rejects corrupted content', async () => {
    const file = path.join(directory, 'session.json');
    await writeFile(file, '{ not json', 'utf8');
    await expect(readStoredSession({ file })).rejects.toBeInstanceOf(McpToolError);
  });

  it('removes the file', async () => {
    const file = path.join(directory, 'session.json');
    await writeStoredSession(
      { file },
      {
        version: 1,
        serverUrl: 'https://mesh.example.com',
        cookieHeader: 'xid=1',
        issuedAt: '2026-01-01T00:00:00.000Z',
      },
    );
    await removeStoredSession({ file });
    await expect(readFile(file, 'utf8')).rejects.toThrow();
  });
});
