import { Inject, Injectable } from '@nestjs/common';
import setCookieParser from 'set-cookie-parser';

import { buildUpstreamUrl, GATEWAY_CONFIG, type GatewayConfig } from '../config/gateway-config';

export interface LoginResult {
  status: number;
  cookies: string[];
  outcome:
    | { accepted: true }
    | {
        accepted: false;
        code: LoginErrorCode;
        retryable: boolean;
      };
}

export type LoginErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'MFA_REQUIRED'
  | 'MFA_INVALID'
  | 'PASSWORD_CHANGE_REQUIRED'
  | 'AUTH_METHOD_REQUIRED'
  | 'RATE_LIMITED'
  | 'UPSTREAM_UNAVAILABLE'
  | 'UPSTREAM_PROTOCOL_ERROR'
  | 'UNKNOWN_AUTH_ERROR';

interface MeshLoginPage {
  messageId: number;
  loginMode: number;
  hasLoginPanel: boolean;
  hasDashboardPanel: boolean;
}

function parseMeshLoginPage(html: string): MeshLoginPage {
  const messageMatch =
    html.match(/var\s+messageid\s*=\s*parseInt\(\s*['"](\d+)['"]\s*\)/i) ??
    html.match(/messageid\s*:\s*(\d+)/i);
  const loginModeMatch =
    html.match(/var\s+loginMode\s*=\s*['"](\d*)['"]/i) ??
    html.match(/loginmode\s*:\s*(\d+)/i);

  return {
    messageId: messageMatch?.[1] ? Number.parseInt(messageMatch[1], 10) : 0,
    loginMode:
      loginModeMatch?.[1] ? Number.parseInt(loginModeMatch[1], 10) : 0,
    hasLoginPanel: /id\s*=\s*['"]?loginpanel(?:['"\s>])/i.test(html),
    hasDashboardPanel: /\b(?:authCookie|meshnodes|currentNode|logoutControls)\b/.test(html),
  };
}

function hasCookie(rawCookies: string[], name: string): boolean {
  return rawCookies.some((value) => setCookieParser.parseString(value).name === name);
}

function serializeCookie(cookie: setCookieParser.Cookie, forceSecure: boolean): string {
  const sameSite = cookie.sameSite === 'None' ? 'None' : 'Lax';
  const parts = [`${cookie.name}=${cookie.value}`, 'Path=/api', 'HttpOnly', `SameSite=${sameSite}`];
  if (cookie.expires) parts.push(`Expires=${cookie.expires.toUTCString()}`);
  if (cookie.maxAge !== undefined) parts.push(`Max-Age=${cookie.maxAge}`);
  if (cookie.secure || forceSecure || sameSite === 'None') parts.push('Secure');
  return parts.join('; ');
}

@Injectable()
export class LoginService {
  constructor(@Inject(GATEWAY_CONFIG) private readonly config: GatewayConfig) {}

  login(username: string, password: string): Promise<LoginResult> {
    return this.submit(
      new URLSearchParams({ action: 'login', username, password }),
      undefined,
      false,
    );
  }

  verifyMfa(token: string, hwtoken: string | undefined, cookie: string): Promise<LoginResult> {
    const body = new URLSearchParams({ action: 'tokenlogin', token });
    if (hwtoken) body.set('hwtoken', hwtoken);
    return this.submit(body, cookie, true);
  }

  private async submit(
    body: URLSearchParams,
    cookie: string | undefined,
    isMfaStep: boolean,
  ): Promise<LoginResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.upstreamTimeoutMs);

    try {
      const url = buildUpstreamUrl(this.config, '/login');
      const headers: Record<string, string> = {
        'Content-Type': 'application/x-www-form-urlencoded',
      };
      if (cookie) headers.Cookie = cookie;
      const response = await fetch(url, {
        method: 'POST',
        redirect: 'manual',
        signal: controller.signal,
        headers,
        body,
      });
      const rawCookies = response.headers.getSetCookie();
      const forceSecure = this.config.publicOrigin.protocol === 'https:';
      const cookies = rawCookies.map((value) =>
        serializeCookie(setCookieParser.parseString(value), forceSecure),
      );
      const html = await response.text();
      const page = parseMeshLoginPage(html);
      const hasSessionCookies = hasCookie(rawCookies, 'xid') && hasCookie(rawCookies, 'xid.sig');

      if (response.status === 429 || page.messageId === 114) {
        return {
          status: response.status,
          cookies,
          outcome: { accepted: false, code: 'RATE_LIMITED', retryable: true },
        };
      }
      if (response.status >= 500 || page.messageId === 115) {
        return {
          status: response.status,
          cookies,
          outcome: { accepted: false, code: 'UPSTREAM_UNAVAILABLE', retryable: true },
        };
      }
      if (page.loginMode === 6 || page.messageId === 113) {
        return {
          status: response.status,
          cookies,
          outcome: { accepted: false, code: 'PASSWORD_CHANGE_REQUIRED', retryable: false },
        };
      }
      if (isMfaStep && (page.messageId === 108 || page.loginMode === 4)) {
        return {
          status: response.status,
          cookies,
          outcome: { accepted: false, code: 'MFA_INVALID', retryable: true },
        };
      }
      if (!isMfaStep && page.loginMode === 4 && hasCookie(rawCookies, 'xid')) {
        return {
          status: response.status,
          cookies,
          outcome: { accepted: false, code: 'MFA_REQUIRED', retryable: false },
        };
      }
      if ([110, 111, 112].includes(page.messageId)) {
        return {
          status: response.status,
          cookies,
          outcome: { accepted: false, code: 'INVALID_CREDENTIALS', retryable: false },
        };
      }

      const redirected = response.status >= 300 && response.status < 400;
      const dashboardLoaded = page.hasDashboardPanel && !page.hasLoginPanel;
      if (hasSessionCookies && (redirected || dashboardLoaded)) {
        return { status: response.status, cookies, outcome: { accepted: true } };
      }
      if (response.status >= 400) {
        return {
          status: response.status,
          cookies,
          outcome: { accepted: false, code: 'UPSTREAM_PROTOCOL_ERROR', retryable: true },
        };
      }
      return {
        status: response.status,
        cookies,
        outcome: { accepted: false, code: 'UNKNOWN_AUTH_ERROR', retryable: false },
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
