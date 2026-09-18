import { Inject, Injectable } from '@nestjs/common';
import setCookieParser from 'set-cookie-parser';

import { buildUpstreamUrl, GATEWAY_CONFIG, type GatewayConfig } from '../config/gateway-config';

export interface LoginResult {
  status: number;
  cookies: string[];
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

  async login(username: string, password: string): Promise<LoginResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.upstreamTimeoutMs);

    try {
      const url = buildUpstreamUrl(this.config, '/login');
      const response = await fetch(url, {
        method: 'POST',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ action: 'login', username, password }),
      });
      const rawCookies = response.headers.getSetCookie();
      const forceSecure = this.config.publicOrigin.protocol === 'https:';
      const cookies = rawCookies.map((value) =>
        serializeCookie(setCookieParser.parseString(value), forceSecure),
      );
      await response.body?.cancel();
      return { status: response.status, cookies };
    } catch (error) {
      console.error(error);
      return { status: 500, cookies: [] };
    }
    finally {
      clearTimeout(timeout);
    }
  }
}
