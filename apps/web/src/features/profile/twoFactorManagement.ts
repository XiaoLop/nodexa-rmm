import type { GatewayClient } from '@meshcentral/control-client';

const DEFAULT_TIMEOUT_MS = 10_000;

export interface TotpSetup {
  secret: string;
  url: string;
}

export interface BackupCode {
  code: number;
  unused: boolean;
}

export class TwoFactorManagementError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'TwoFactorManagementError';
  }
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value != null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : undefined;
}

function request<T>(
  client: GatewayClient,
  payload: Record<string, unknown>,
  responseAction: string,
  parse: (response: Record<string, unknown>) => T,
  timeoutMs = DEFAULT_TIMEOUT_MS,
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
      let result: T;
      try {
        result = parse(response);
      } catch (error) {
        finish(() => reject(error));
        return;
      }
      finish(() => resolve(result));
    });
    const timeout = setTimeout(
      () => finish(() => reject(new TwoFactorManagementError('timeout'))),
      timeoutMs,
    );

    try {
      client.send(payload);
    } catch (error) {
      finish(() => reject(error));
    }
  });
}

function requireSuccess(response: Record<string, unknown>): void {
  if (response.err != null) {
    throw new TwoFactorManagementError(`error_${String(response.err)}`);
  }
  if (response.success !== true) {
    throw new TwoFactorManagementError(
      typeof response.error === 'string' ? response.error : 'requestFailed',
    );
  }
}

function parseBackupCodes(response: Record<string, unknown>): BackupCode[] {
  if (response.passwords === null) return [];
  if (!Array.isArray(response.passwords)) {
    throw new TwoFactorManagementError('invalidResponse');
  }
  return response.passwords.map((value) => {
    const item = record(value);
    if (typeof item?.p !== 'number' || typeof item.u !== 'boolean') {
      throw new TwoFactorManagementError('invalidResponse');
    }
    return { code: item.p, unused: item.u };
  });
}

export function requestTotpSetup(client: GatewayClient): Promise<TotpSetup> {
  return request(client, { action: 'otpauth-request' }, 'otpauth-request', (response) => {
    if (response.err != null) {
      throw new TwoFactorManagementError(`error_${String(response.err)}`);
    }
    if (typeof response.secret !== 'string' || typeof response.url !== 'string') {
      throw new TwoFactorManagementError('invalidResponse');
    }
    return { secret: response.secret, url: response.url };
  });
}

export function confirmTotpSetup(
  client: GatewayClient,
  secret: string,
  token: string,
): Promise<void> {
  return request(
    client,
    { action: 'otpauth-setup', secret, token },
    'otpauth-setup',
    requireSuccess,
  );
}

export function clearTotp(client: GatewayClient): Promise<void> {
  return request(client, { action: 'otpauth-clear' }, 'otpauth-clear', requireSuccess);
}

export function setEmailTwoFactor(client: GatewayClient, enabled: boolean): Promise<void> {
  return request(
    client,
    { action: 'otpemail', enabled },
    'otpemail',
    (response) => {
      requireSuccess(response);
      if (response.enabled !== enabled) {
        throw new TwoFactorManagementError('invalidResponse');
      }
    },
  );
}

export function getBackupCodes(client: GatewayClient): Promise<BackupCode[]> {
  return request(
    client,
    { action: 'otpauth-getpasswords' },
    'otpauth-getpasswords',
    parseBackupCodes,
  );
}

export function generateBackupCodes(client: GatewayClient): Promise<BackupCode[]> {
  return request(
    client,
    { action: 'otpauth-getpasswords', subaction: 1 },
    'otpauth-getpasswords',
    parseBackupCodes,
  );
}

export function clearBackupCodes(client: GatewayClient): Promise<void> {
  return request(
    client,
    { action: 'otpauth-getpasswords', subaction: 2 },
    'otpauth-getpasswords',
    (response) => {
      if (response.passwords !== null) {
        throw new TwoFactorManagementError('invalidResponse');
      }
    },
  );
}