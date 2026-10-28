import { chmod, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { McpToolError } from '../errors';
import type { StoredOAuthTokens } from './oauth-types';

export interface OAuthTokenStoreOptions {
  readonly file: string;
  readonly platform?: string;
}

export async function readStoredOAuthTokens(
  options: OAuthTokenStoreOptions,
): Promise<StoredOAuthTokens | undefined> {
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
      `The OAuth token file is readable by other users: ${options.file}`,
      {
        hint: `Run "chmod 600 ${options.file}" and try again.`,
      },
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(options.file, 'utf8'));
  } catch (error) {
    if (isNotFound(error)) return undefined;
    throw new McpToolError('SESSION_EXPIRED', 'The stored OAuth token file is corrupted.', {
      hint: 'Run `meshcentral-mcp login` to authorize again.',
      cause: error,
    });
  }
  return normalize(parsed, options.file);
}

export async function writeStoredOAuthTokens(
  options: OAuthTokenStoreOptions,
  tokens: StoredOAuthTokens,
): Promise<void> {
  await mkdir(path.dirname(options.file), { recursive: true });
  await writeFile(options.file, `${JSON.stringify(tokens, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
  if ((options.platform ?? process.platform) !== 'win32') await chmod(options.file, 0o600);
}

export async function removeStoredOAuthTokens(options: OAuthTokenStoreOptions): Promise<void> {
  await rm(options.file, { force: true });
}

function normalize(value: unknown, file: string): StoredOAuthTokens {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw invalid(file);
  const record = value as Record<string, unknown>;
  if (
    record.version !== 1 ||
    typeof record.serverUrl !== 'string' ||
    typeof record.clientId !== 'string' ||
    typeof record.refreshToken !== 'string' ||
    !Array.isArray(record.scope) ||
    !record.scope.every((item) => typeof item === 'string') ||
    typeof record.issuedAt !== 'string'
  )
    throw invalid(file);
  return {
    version: 1,
    serverUrl: record.serverUrl,
    clientId: record.clientId,
    refreshToken: record.refreshToken,
    scope: record.scope,
    issuedAt: record.issuedAt,
  };
}

function invalid(file: string): McpToolError {
  return new McpToolError('SESSION_EXPIRED', `The stored OAuth token file is invalid: ${file}`, {
    hint: 'Run `meshcentral-mcp login` to authorize again.',
  });
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'ENOENT'
  );
}
