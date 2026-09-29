import { describe, expect, it, vi } from 'vitest';
import type { MeshCentralClient } from '@meshcentral/control-client';
import {
  clearBackupCodes,
  clearTotp,
  completeWebAuthnRegistration,
  confirmTotpSetup,
  createWebAuthnCredential,
  getSecurityKeys,
  generateBackupCodes,
  removeSecurityKey,
  requestTotpSetup,
  requestWebAuthnRegistration,
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
  } as unknown as MeshCentralClient;
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

  it('lists and removes security keys', async () => {
    const runtime = createClient();
    const listPending = getSecurityKeys(runtime.client);
    expect(runtime.send).toHaveBeenLastCalledWith({ action: 'otp-hkey-get' });
    runtime.emit({
      action: 'otp-hkey-get',
      keys: [{ i: 1234, name: 'Office key', type: 3 }],
    });
    await expect(listPending).resolves.toEqual([
      { index: 1234, name: 'Office key', type: 3 },
    ]);

    const removePending = removeSecurityKey(runtime.client, 1234);
    expect(runtime.send.mock.calls.slice(-2).map(([payload]) => payload)).toEqual([
      { action: 'otp-hkey-remove', index: 1234 },
      { action: 'otp-hkey-get' },
    ]);
    runtime.emit({ action: 'otp-hkey-get', keys: [] });
    await expect(removePending).resolves.toEqual([]);
  });

  it('starts and completes WebAuthn registration', async () => {
    const runtime = createClient();
    const challengePending = requestWebAuthnRegistration(runtime.client, 'Office key');
    expect(runtime.send).toHaveBeenLastCalledWith({
      action: 'webauthn-startregister',
      name: 'Office key',
    });
    runtime.emit({
      action: 'webauthn-startregister',
      keyname: 'Office key',
      request: {
        rp: { name: 'Anonymous Service' },
        user: { id: 'dXNlci8vYWRtaW4=', name: 'user//admin', displayName: 'admin' },
        challenge: 'Y2hhbGxlbmdl',
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
        timeout: 60000,
        attestation: 'none',
        userVerification: 'preferred',
      },
    });
    await expect(challengePending).resolves.toMatchObject({ keyName: 'Office key' });

    const response = {
      rawId: 'Y3JlZGVudGlhbA==',
      type: 'public-key',
      response: {
        attestationObject: 'YXR0ZXN0YXRpb24=',
        clientDataJSON: 'Y2xpZW50',
      },
    };
    const completionPending = completeWebAuthnRegistration(runtime.client, response);
    expect(runtime.send).toHaveBeenLastCalledWith({
      action: 'webauthn-endregister',
      response,
    });
    runtime.emit({
      action: 'otp-hkey-setup-response',
      result: true,
      name: 'Office key',
      index: 1234,
    });
    await expect(completionPending).resolves.toEqual({ name: 'Office key', index: 1234 });
  });

  it('preserves WebAuthn registration errors', async () => {
    const runtime = createClient();
    const pending = completeWebAuthnRegistration(runtime.client, {
      rawId: 'aWQ=',
      type: 'public-key',
      response: { attestationObject: 'YQ==', clientDataJSON: 'Yg==' },
    });
    runtime.emit({
      action: 'otp-hkey-setup-response',
      result: false,
      error: 'User was NOT presented during authentication!',
    });
    await expect(pending).rejects.toMatchObject({
      code: 'User was NOT presented during authentication!',
    });
  });

  it('converts WebAuthn challenge and credential buffers', async () => {
    class MockAuthenticatorAttestationResponse {
      attestationObject = Uint8Array.from([4, 5, 6]).buffer;
      clientDataJSON = Uint8Array.from([7, 8, 9]).buffer;
    }
    class MockPublicKeyCredential {
      rawId = Uint8Array.from([1, 2, 3]).buffer;
      type = 'public-key';
      response = new MockAuthenticatorAttestationResponse();
    }
    const create = vi.fn().mockResolvedValue(new MockPublicKeyCredential());
    vi.stubGlobal('AuthenticatorAttestationResponse', MockAuthenticatorAttestationResponse);
    vi.stubGlobal('PublicKeyCredential', MockPublicKeyCredential);
    vi.stubGlobal('navigator', { credentials: { create } });

    await expect(
      createWebAuthnCredential({
        keyName: 'Office key',
        request: {
          rp: { name: 'Anonymous Service' },
          user: {
            id: 'dXNlci8vYWRtaW4=',
            name: 'user//admin',
            displayName: 'admin',
          },
          challenge: 'Y2hhbGxlbmdl',
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
        },
      }),
    ).resolves.toEqual({
      rawId: 'AQID',
      type: 'public-key',
      response: {
        attestationObject: 'BAUG',
        clientDataJSON: 'BwgJ',
      },
    });
    const options = create.mock.calls[0]?.[0] as CredentialCreationOptions;
    expect(Array.from(new Uint8Array(options.publicKey?.challenge as ArrayBuffer))).toEqual([
      99, 104, 97, 108, 108, 101, 110, 103, 101,
    ]);
    expect(Array.from(new Uint8Array(options.publicKey?.user.id as ArrayBuffer))).toEqual([
      117, 115, 101, 114, 47, 47, 97, 100, 109, 105, 110,
    ]);

    vi.unstubAllGlobals();
  });
});