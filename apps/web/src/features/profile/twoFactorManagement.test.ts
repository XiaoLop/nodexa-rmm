import { describe, expect, it, vi } from 'vitest';
import type { GatewayClient } from '@meshcentral/control-client';
import {
  clearBackupCodes,
  clearTotp,
  confirmTotpSetup,
  generateBackupCodes,
  requestTotpSetup,
  setEmailTwoFactor,
} from './twoFactorManagement';

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
  } as unknown as GatewayClient;
  return { client, send, unsubscribe, emit: (message: unknown) => listener?.(message) };
}

describe('two-factor management', () => {
  it('requests and confirms a TOTP setup', async () => {
    const runtime = createClient();
    const setupPending = requestTotpSetup(runtime.client);
    expect(runtime.send).toHaveBeenLastCalledWith({ action: 'otpauth-request' });
    runtime.emit({ action: 'otpauth-request', secret: 'SECRET', url: 'otpauth://totp/test' });
    await expect(setupPending).resolves.toEqual({ secret: 'SECRET', url: 'otpauth://totp/test' });

    const confirmPending = confirmTotpSetup(runtime.client, 'SECRET', '123456');
    expect(runtime.send).toHaveBeenLastCalledWith({
      action: 'otpauth-setup',
      secret: 'SECRET',
      token: '123456',
    });
    runtime.emit({ action: 'otpauth-setup', success: true });
    await expect(confirmPending).resolves.toBeUndefined();
  });

  it('clears TOTP and toggles email 2FA', async () => {
    const runtime = createClient();
    const clearPending = clearTotp(runtime.client);
    runtime.emit({ action: 'otpauth-clear', success: true });
    await expect(clearPending).resolves.toBeUndefined();

    const emailPending = setEmailTwoFactor(runtime.client, true);
    expect(runtime.send).toHaveBeenLastCalledWith({ action: 'otpemail', enabled: true });
    runtime.emit({ action: 'otpemail', success: true, enabled: true });
    await expect(emailPending).resolves.toBeUndefined();
  });

  it('generates and clears backup codes', async () => {
    const runtime = createClient();
    const generatePending = generateBackupCodes(runtime.client);
    runtime.emit({
      action: 'otpauth-getpasswords',
      passwords: [{ p: 12345678, u: true }, { p: 87654321, u: false }],
    });
    await expect(generatePending).resolves.toEqual([
      { code: 12345678, unused: true },
      { code: 87654321, unused: false },
    ]);

    const clearPending = clearBackupCodes(runtime.client);
    runtime.emit({ action: 'otpauth-getpasswords', passwords: null });
    await expect(clearPending).resolves.toBeUndefined();
  });

  it('rejects protocol errors and removes its listener', async () => {
    const runtime = createClient();
    const pending = requestTotpSetup(runtime.client);
    runtime.emit({ action: 'otpauth-request', err: 4 });
    await expect(pending).rejects.toMatchObject({ code: 'error_4' });
    expect(runtime.unsubscribe).toHaveBeenCalledOnce();
  });
});