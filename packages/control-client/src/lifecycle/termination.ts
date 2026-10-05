import { isRecord, stringValue } from '../protocol/normalizers';

export type DisconnectDisposition =
  | 'retryable'
  | 'stopped'
  | 'authentication-required'
  | 'forbidden-origin'
  | 'session-expired'
  | 'account-locked'
  | 'account-removed'
  | 'token-revoked';

export interface ConnectionTermination {
  disposition: DisconnectDisposition;
  message?: string;
  cause?: string;
  requiresLogin: boolean;
  retryAllowed: boolean;
  occurredAt: string;
}

const AUTHENTICATION_MESSAGES = new Set([
  'tokenrequired',
  'email2fa',
  'sms2fa',
  'msg2fa',
  'emailvalidationrequired',
]);

export function normalizeConnectionTermination(value: unknown): ConnectionTermination | undefined {
  if (!isRecord(value)) return undefined;
  const raw = isRecord(value.event) ? value.event : value;
  if (raw.action === 'stopped') {
    return {
      disposition: 'stopped',
      message: stringValue(raw.msg) ?? stringValue(raw.message),
      requiresLogin: false,
      retryAllowed: false,
      occurredAt: new Date().toISOString(),
    };
  }
  if (value.action !== 'close') return undefined;
  const cause = stringValue(value.cause)?.toLowerCase();
  const message = stringValue(value.msg) ?? stringValue(value.message);
  const normalizedMessage = message?.toLowerCase();
  let disposition: DisconnectDisposition;
  if (cause === 'invalidorigin') disposition = 'forbidden-origin';
  else if (cause === 'expired') disposition = 'session-expired';
  else if (cause === 'banned' || cause === 'locked') disposition = 'account-locked';
  else if (
    cause === 'noauth' ||
    cause === 'emailvalidation' ||
    (normalizedMessage !== undefined && AUTHENTICATION_MESSAGES.has(normalizedMessage))
  ) {
    disposition = 'authentication-required';
  } else {
    return undefined;
  }
  return {
    disposition,
    message,
    cause,
    requiresLogin: true,
    retryAllowed: false,
    occurredAt: new Date().toISOString(),
  };
}