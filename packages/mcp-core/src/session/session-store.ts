import { chmod, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { McpToolError } from '../errors';

export interface StoredSession {
  readonly version: 1;
  readonly serverUrl: string;
  readonly cookieHeader: string;
  readonly userId?: string;
  readonly userName?: string;
  readonly siteAdmin?: boolean;
  readonly issuedAt: string;
}

export interface SessionStoreOptions {
  readonly file: string;
  readonly platform?: string;
}

export async function readStoredSession(options: SessionStoreOptions): Promise<StoredSession | undefined> {
  let fileStat;
  try {
    fileStat = await stat(options.file);
  } catch (error) {
    if (isNotFound(error)) return undefined;
    throw error;
  }

  const platform = options.platform ?? process.platform;
  if (platform !== 'win32' && (fileStat.mode & 0o077) !== 0) {
    throw new McpToolError(
      'INSECURE_SESSION_FILE',
      `The session file is readable by other users: ${options.file}`,
      {
        hint: `Run "chmod 600 ${options.file}" and try again.`,
      },
    );
  }

  let raw: string;
  try {
    raw = await readFile(options.file, 'utf8');
  } catch (error) {
    if (isNotFound(error)) return undefined;
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new McpToolError(
      'SESSION_EXPIRED',
      'The stored MeshCentral session file is corrupted.',
      { hint: 'Run `meshcentral-mcp login` to create a new session.' },
    );
  }

  return normalizeSession(parsed, options.file);
}

export async function writeStoredSession(
  options: SessionStoreOptions,
  session: StoredSession,
): Promise<void> {
  await mkdir(path.dirname(options.file), { recursive: true });
  await writeFile(options.file, `${JSON.stringify(session, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
  if ((options.platform ?? process.platform) !== 'win32') {
    await chmod(options.file, 0o600);
  }
}

export async function removeStoredSession(options: SessionStoreOptions): Promise<void> {
  await rm(options.file, { force: true });
}

function normalizeSession(value: unknown, file: string): StoredSession {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw invalidSession(file);
  }
  const record = value as Record<string, unknown>;
  if (record.version !== 1) throw invalidSession(file);
  if (typeof record.serverUrl !== 'string' || record.serverUrl.length === 0) throw invalidSession(file);
  if (typeof record.cookieHeader !== 'string' || record.cookieHeader.length === 0) {
    throw invalidSession(file);
  }
  if (typeof record.issuedAt !== 'string' || record.issuedAt.length === 0) throw invalidSession(file);

  return {
    version: 1,
    serverUrl: record.serverUrl,
    cookieHeader: record.cookieHeader,
    issuedAt: record.issuedAt,
    ...(typeof record.userId === 'string' ? { userId: record.userId } : {}),
    ...(typeof record.userName === 'string' ? { userName: record.userName } : {}),
    ...(typeof record.siteAdmin === 'boolean' ? { siteAdmin: record.siteAdmin } : {}),
  };
}

function invalidSession(file: string): McpToolError {
  return new McpToolError('SESSION_EXPIRED', `The stored MeshCentral session is invalid: ${file}`, {
    hint: 'Run `meshcentral-mcp login` to create a new session.',
  });
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === 'ENOENT'
  );
}
