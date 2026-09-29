import { describe, expect, it, vi } from 'vitest';
import type { MeshCentralClient } from '@meshcentral/control-client';
import { getTwoFactorCapabilities } from './twoFactorCapabilities';
import type { TwoFactorCapabilitiesError } from './twoFactorCapabilities';

function createClient() {
  let listener: ((message: unknown) => void) | undefined;
  const unsubscribe = vi.fn();
  const send = vi.fn();
  const client = {
    on: vi.fn((_channel: string, nextListener: (message: unknown) => void) => {
      listener = nextListener;
      return unsubscribe;
    }),
    send,
  } as unknown as MeshCentralClient;
  return {
    client,
    send,
    unsubscribe,
    emit(message: unknown) {
      listener?.(message);
    },
  };
}

function capabilities() {
  const method = { enabled: true, canConfigure: true, configured: false };
  return {
    supported: true,
    locked: false,
    forced: false,
    domainId: '',
    maxFidoKeys: 4,
    messagingProviders: 3,
    methods: {
      totp: method,
      webauthn: method,
      email: method,
      sms: method,
      messaging: method,
      duo: method,
      devicePush: method,
      backupCodes: method,
    },
  };
}

describe('getTwoFactorCapabilities', () => {
  it('matches the utils plugin response by requestId', async () => {
    const runtime = createClient();
    const pending = getTwoFactorCapabilities(runtime.client);
    const request = runtime.send.mock.calls[0]?.[0] as Record<string, unknown>;

    runtime.emit({ ...request, requestId: 'another-request', success: true, capabilities: capabilities() });
    runtime.emit({ ...request, success: true, capabilities: capabilities() });

    await expect(pending).resolves.toEqual(capabilities());
    expect(request).toMatchObject({
      action: 'plugin',
      plugin: 'utils',
      subAction: 'getTwoFactorCapabilities',
    });
    expect(runtime.unsubscribe).toHaveBeenCalledOnce();
  });

  it('preserves plugin error codes', async () => {
    const runtime = createClient();
    const pending = getTwoFactorCapabilities(runtime.client);
    const request = runtime.send.mock.calls[0]?.[0] as Record<string, unknown>;

    runtime.emit({ ...request, success: false, error: 'AUTHENTICATED_USER_REQUIRED' });

    await expect(pending).rejects.toMatchObject({
      code: 'AUTHENTICATED_USER_REQUIRED',
    } satisfies Partial<TwoFactorCapabilitiesError>);
  });

  it('accepts legacy plugin responses without configured state', async () => {
    const runtime = createClient();
    const pending = getTwoFactorCapabilities(runtime.client);
    const request = runtime.send.mock.calls[0]?.[0] as Record<string, unknown>;
    const legacyCapabilities = capabilities();
    for (const method of Object.values(legacyCapabilities.methods)) {
      delete (method as { configured?: boolean }).configured;
    }

    runtime.emit({ ...request, success: true, capabilities: legacyCapabilities });

    await expect(pending).resolves.toMatchObject({
      methods: {
        totp: { configured: false },
        email: { configured: false },
        backupCodes: { configured: false },
      },
    });
  });

  it('times out and removes the message listener', async () => {
    vi.useFakeTimers();
    const runtime = createClient();
    const pending = getTwoFactorCapabilities(runtime.client, { timeoutMs: 50 });
    const expectation = expect(pending).rejects.toMatchObject({ code: 'timeout' });

    await vi.advanceTimersByTimeAsync(50);

    await expectation;
    expect(runtime.unsubscribe).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});