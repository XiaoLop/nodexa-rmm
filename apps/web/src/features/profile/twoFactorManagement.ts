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

export interface SecurityKey {
  index: number;
  name: string;
  type: 1 | 2 | 3;
}

interface WebAuthnRegistrationRequest {
  rp: PublicKeyCredentialRpEntity;
  user: Omit<PublicKeyCredentialUserEntity, 'id'> & { id: string };
  challenge: string;
  pubKeyCredParams: PublicKeyCredentialParameters[];
  timeout?: number;
  attestation?: AttestationConveyancePreference;
  userVerification?: UserVerificationRequirement;
}

export interface WebAuthnRegistrationChallenge {
  keyName: string;
  request: WebAuthnRegistrationRequest;
}

export interface WebAuthnRegistrationResponse {
  rawId: string;
  type: string;
  response: {
    attestationObject: string;
    clientDataJSON: string;
  };
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

function parseSecurityKeys(response: Record<string, unknown>): SecurityKey[] {
  if (!Array.isArray(response.keys)) {
    throw new TwoFactorManagementError('invalidResponse');
  }
  return response.keys.map((value) => {
    const item = record(value);
    if (
      typeof item?.i !== 'number' ||
      typeof item.name !== 'string' ||
      !(item.type === 1 || item.type === 2 || item.type === 3)
    ) {
      throw new TwoFactorManagementError('invalidResponse');
    }
    return { index: item.i, name: item.name, type: item.type };
  });
}

function base64ToArrayBuffer(value: string): ArrayBuffer {
  try {
    const binary = atob(value);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0)).buffer;
  } catch {
    throw new TwoFactorManagementError('invalidResponse');
  }
}

function arrayBufferToBase64(value: ArrayBuffer): string {
  const bytes = new Uint8Array(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function getSecurityKeys(client: GatewayClient): Promise<SecurityKey[]> {
  return request(client, { action: 'otp-hkey-get' }, 'otp-hkey-get', parseSecurityKeys);
}

export function requestWebAuthnRegistration(
  client: GatewayClient,
  name: string,
): Promise<WebAuthnRegistrationChallenge> {
  return request(
    client,
    { action: 'webauthn-startregister', name },
    'webauthn-startregister',
    (response) => {
      const registrationRequest = record(response.request);
      const rp = record(registrationRequest?.rp);
      const user = record(registrationRequest?.user);
      if (
        typeof response.keyname !== 'string' ||
        registrationRequest == null ||
        typeof rp?.name !== 'string' ||
        typeof user?.id !== 'string' ||
        typeof user.name !== 'string' ||
        typeof user.displayName !== 'string' ||
        typeof registrationRequest.challenge !== 'string' ||
        !Array.isArray(registrationRequest.pubKeyCredParams)
      ) {
        throw new TwoFactorManagementError('invalidResponse');
      }
      return {
        keyName: response.keyname,
        request: registrationRequest as unknown as WebAuthnRegistrationRequest,
      };
    },
  );
}

export async function createWebAuthnCredential(
  challenge: WebAuthnRegistrationChallenge,
): Promise<WebAuthnRegistrationResponse> {
  if (!navigator.credentials?.create) {
    throw new TwoFactorManagementError('webauthnUnsupported');
  }
  const credential = await navigator.credentials.create({
    publicKey: {
      ...challenge.request,
      challenge: base64ToArrayBuffer(challenge.request.challenge),
      user: {
        ...challenge.request.user,
        id: base64ToArrayBuffer(challenge.request.user.id),
      },
    },
  });
  if (!(credential instanceof PublicKeyCredential)) {
    throw new TwoFactorManagementError('invalidCredential');
  }
  const attestation = credential.response;
  if (!(attestation instanceof AuthenticatorAttestationResponse)) {
    throw new TwoFactorManagementError('invalidCredential');
  }
  return {
    rawId: arrayBufferToBase64(credential.rawId),
    type: credential.type,
    response: {
      attestationObject: arrayBufferToBase64(attestation.attestationObject),
      clientDataJSON: arrayBufferToBase64(attestation.clientDataJSON),
    },
  };
}

export function completeWebAuthnRegistration(
  client: GatewayClient,
  response: WebAuthnRegistrationResponse,
): Promise<{ name: string; index: number }> {
  return request(
    client,
    { action: 'webauthn-endregister', response },
    'otp-hkey-setup-response',
    (message) => {
      if (message.result !== true) {
        throw new TwoFactorManagementError(
          typeof message.error === 'string' ? message.error : 'registrationFailed',
        );
      }
      if (typeof message.name !== 'string' || typeof message.index !== 'number') {
        throw new TwoFactorManagementError('invalidResponse');
      }
      return { name: message.name, index: message.index };
    },
  );
}

export function removeSecurityKey(
  client: GatewayClient,
  index: number,
): Promise<SecurityKey[]> {
  client.send({ action: 'otp-hkey-remove', index });
  return getSecurityKeys(client);
}