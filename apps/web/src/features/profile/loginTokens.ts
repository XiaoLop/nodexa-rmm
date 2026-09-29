import type { MeshCentralClient } from '@meshcentral/control-client';

const DEFAULT_TIMEOUT_MS = 10_000;

export interface LoginToken {
  name: string;
  tokenUser: string;
  created: number;
  expire: number;
}

export interface CreatedLoginToken extends LoginToken {
  tokenPass: string;
}

export class LoginTokenError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'LoginTokenError';
  }
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value != null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : undefined;
}

function parseLoginToken(value: unknown): LoginToken {
  const token = record(value);
  if (
    typeof token?.name !== 'string' ||
    typeof token.tokenUser !== 'string' ||
    typeof token.created !== 'number' ||
    typeof token.expire !== 'number'
  ) {
    throw new LoginTokenError('invalidResponse');
  }
  return {
    name: token.name,
    tokenUser: token.tokenUser,
    created: token.created,
    expire: token.expire,
  };
}

function parseLoginTokens(response: Record<string, unknown>): LoginToken[] {
  if (!Array.isArray(response.loginTokens)) {
    throw new LoginTokenError('invalidResponse');
  }
  return response.loginTokens.map(parseLoginToken);
}

function request<T>(
  client: MeshCentralClient,
  payload: Record<string, unknown>,
  responseAction: string,
  parse: (response: Record<string, unknown>) => T,
): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      unsubscribe();
      callback();
    };
    const unsubscribe = client.on('message', (message) => {
      const response = record(message);
      if (response?.action !== responseAction) return;
      try {
        const result = parse(response);
        finish(() => resolve(result));
      } catch (error) {
        finish(() => reject(error));
      }
    });
    const timeout = setTimeout(
      () => finish(() => reject(new LoginTokenError('timeout'))),
      DEFAULT_TIMEOUT_MS,
    );

    try {
      client.send(payload);
    } catch (error) {
      finish(() => reject(error));
    }
  });
}

export function listLoginTokens(client: MeshCentralClient): Promise<LoginToken[]> {
  return request(client, { action: 'loginTokens' }, 'loginTokens', parseLoginTokens);
}

export function removeLoginToken(
  client: MeshCentralClient,
  tokenUser: string,
): Promise<LoginToken[]> {
  return request(
    client,
    { action: 'loginTokens', remove: [tokenUser] },
    'loginTokens',
    parseLoginTokens,
  );
}

export function createLoginToken(
  client: MeshCentralClient,
  name: string,
  expire = 0,
): Promise<CreatedLoginToken> {
  return request(
    client,
    { action: 'createLoginToken', name, expire },
    'createLoginToken',
    (response) => {
      const token = parseLoginToken(response);
      if (typeof response.tokenPass !== 'string') {
        throw new LoginTokenError('invalidResponse');
      }
      return { ...token, tokenPass: response.tokenPass };
    },
  );
}