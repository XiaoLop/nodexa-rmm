import { Inject, Injectable } from '@nestjs/common';
import setCookieParser from 'set-cookie-parser';

import { buildUpstreamUrl, GATEWAY_CONFIG, type GatewayConfig } from '../config/gateway-config';

export type JsonAuthStatus =
  | 'SUCCESS'
  | 'BAD_PASSWORD'
  | 'ACCOUNT_LOCKED'
  | 'REQUIRE_2FA'
  | 'INVALID_2FA_TOKEN'
  | 'INVALID_AUTH_TRANSACTION'
  | 'AUTH_TRANSACTION_EXPIRED'
  | 'UNSUPPORTED_2FA_METHOD'
  | 'EMAIL_NOT_VERIFIED'
  | 'PASSWORD_EXPIRED'
  | 'PARAM_ERROR'
  | 'ACCESS_DENIED'
  | 'MAINTENANCE_MODE'
  | 'SERVER_UNAVAILABLE';

export interface TwoFactorMethod {
  type: string;
  supported: boolean;
}

export interface JsonAuthResponse {
  code: number;
  status: JsonAuthStatus;
  message: string;
  data?: {
    transactionId?: string;
    expiresIn?: number;
    methods?: TwoFactorMethod[];
    userid?: string;
    username?: string;
    siteadmin?: boolean;
    redirectUrl?: string;
    method?: string;
  };
}

export interface LoginResult {
  status: number;
  cookies: string[];
  response: JsonAuthResponse;
}

function serializeCookie(cookie: setCookieParser.Cookie, forceSecure: boolean): string {
  const sameSite = cookie.sameSite === 'None' ? 'None' : 'Lax';
  const parts = [`${cookie.name}=${cookie.value}`, 'Path=/api', 'HttpOnly', `SameSite=${sameSite}`];
  if (cookie.expires) parts.push(`Expires=${cookie.expires.toUTCString()}`);
  if (cookie.maxAge !== undefined) parts.push(`Max-Age=${cookie.maxAge}`);
  if (cookie.secure || forceSecure || sameSite === 'None') parts.push('Secure');
  return parts.join('; ');
}

function isJsonAuthResponse(value: unknown): value is JsonAuthResponse {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return false;
  const response = value as Record<string, unknown>;
  return (
    typeof response.code === 'number' &&
    typeof response.status === 'string' &&
    typeof response.message === 'string'
  );
}

@Injectable()
export class LoginService {
  constructor(@Inject(GATEWAY_CONFIG) private readonly config: GatewayConfig) {}

  login(
    username: string,
    password: string,
    rememberToken: boolean,
    trustedDeviceCookie?: string,
  ): Promise<LoginResult> {
    return this.submit(
      '/api/auth/login',
      { username, password, rememberToken },
      trustedDeviceCookie,
    );
  }

  verifyTwoFactor(
    transactionId: string,
    type: string,
    code: string,
    rememberToken: boolean,
  ): Promise<LoginResult> {
    return this.submit('/api/auth/login/verify-2fa', {
      transactionId,
      type,
      code,
      rememberToken,
    });
  }

  private async submit(
    path: string,
    body: Record<string, unknown>,
    cookie?: string,
  ): Promise<LoginResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.upstreamTimeoutMs);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (cookie) headers.Cookie = cookie;
      const response = await fetch(buildUpstreamUrl(this.config, path), {
        method: 'POST',
        redirect: 'manual',
        signal: controller.signal,
        headers,
        body: JSON.stringify(body),
      });
      const rawCookies = response.headers.getSetCookie();
      const forceSecure = this.config.publicOrigin.protocol === 'https:';
      const cookies = rawCookies.map((value) =>
        serializeCookie(setCookieParser.parseString(value), forceSecure),
      );
      const payload: unknown = await response.json();
      if (!isJsonAuthResponse(payload)) throw new Error('invalid-jsonauth-response');

      return { status: response.status, cookies, response: payload };
    } finally {
      clearTimeout(timeout);
    }
  }
}