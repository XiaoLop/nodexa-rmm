import type { MeshCentralClient } from '@meshcentral/control-client';

const DEFAULT_TIMEOUT_MS = 10_000;

export const TWO_FACTOR_METHODS = [
  'totp',
  'webauthn',
  'email',
  'sms',
  'messaging',
  'duo',
  'devicePush',
  'backupCodes',
] as const;

export type TwoFactorMethod = (typeof TWO_FACTOR_METHODS)[number];

export interface TwoFactorMethodCapability {
  enabled: boolean;
  canConfigure: boolean;
  configured: boolean;
}

export interface TwoFactorCapabilities {
  supported: boolean;
  locked: boolean;
  forced: boolean;
  domainId: string;
  maxFidoKeys: number | null;
  messagingProviders: number;
  methods: Record<TwoFactorMethod, TwoFactorMethodCapability>;
}

export class TwoFactorCapabilitiesError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'TwoFactorCapabilitiesError';
  }
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value != null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : undefined;
}

function parseMethod(value: unknown): TwoFactorMethodCapability | undefined {
  const method = record(value);
  if (
    method == null ||
    typeof method.enabled !== 'boolean' ||
    typeof method.canConfigure !== 'boolean' ||
    !(method.configured === undefined || typeof method.configured === 'boolean')
  ) {
    return undefined;
  }
  return {
    enabled: method.enabled,
    canConfigure: method.canConfigure,
    configured: method.configured === true,
  };
}

function parseCapabilities(value: unknown): TwoFactorCapabilities | undefined {
  const capabilities = record(value);
  const methods = record(capabilities?.methods);
  if (
    capabilities == null ||
    methods == null ||
    typeof capabilities.supported !== 'boolean' ||
    typeof capabilities.locked !== 'boolean' ||
    typeof capabilities.forced !== 'boolean' ||
    typeof capabilities.domainId !== 'string' ||
    !(
      capabilities.maxFidoKeys === null ||
      typeof capabilities.maxFidoKeys === 'number'
    ) ||
    typeof capabilities.messagingProviders !== 'number'
  ) {
    return undefined;
  }

  const parsedMethods = {} as Record<TwoFactorMethod, TwoFactorMethodCapability>;
  for (const methodName of TWO_FACTOR_METHODS) {
    const method = parseMethod(methods[methodName]);
    if (method == null) return undefined;
    parsedMethods[methodName] = method;
  }

  return {
    supported: capabilities.supported,
    locked: capabilities.locked,
    forced: capabilities.forced,
    domainId: capabilities.domainId,
    maxFidoKeys: capabilities.maxFidoKeys,
    messagingProviders: capabilities.messagingProviders,
    methods: parsedMethods,
  };
}

export function getTwoFactorCapabilities(
  client: MeshCentralClient,
  options: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<TwoFactorCapabilities> {
  const requestId = `profile-2fa-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      unsubscribe();
      options.signal?.removeEventListener('abort', abort);
      callback();
    };
    const abort = () =>
      finish(() => reject(new TwoFactorCapabilitiesError('cancelled')));
    const unsubscribe = client.on('message', (message) => {
      const response = record(message);
      if (
        response?.action !== 'plugin' ||
        response.plugin !== 'utils' ||
        response.subAction !== 'getTwoFactorCapabilities' ||
        response.requestId !== requestId
      ) {
        return;
      }
      if (response.success !== true) {
        finish(() =>
          reject(
            new TwoFactorCapabilitiesError(
              typeof response.error === 'string' ? response.error : 'requestFailed',
            ),
          ),
        );
        return;
      }
      const capabilities = parseCapabilities(response.capabilities);
      if (capabilities == null) {
        finish(() => reject(new TwoFactorCapabilitiesError('invalidResponse')));
        return;
      }
      finish(() => resolve(capabilities));
    });

    const timeout = setTimeout(
      () => finish(() => reject(new TwoFactorCapabilitiesError('timeout'))),
      timeoutMs,
    );
    options.signal?.addEventListener('abort', abort, { once: true });
    if (options.signal?.aborted) {
      abort();
      return;
    }

    try {
      client.send({
        action: 'plugin',
        plugin: 'utils',
        subAction: 'getTwoFactorCapabilities',
        requestId,
      });
    } catch (error) {
      finish(() => reject(error));
    }
  });
}