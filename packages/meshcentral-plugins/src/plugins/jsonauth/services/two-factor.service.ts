import { isIP } from 'node:net';
import { authenticator } from 'otplib';
import type {
  MeshCentralDomain,
  MeshCentralHttpRequest,
  MeshCentralServer,
  MeshCentralUser,
} from '../../../types/meshcentral.types.js';
import type { SupportedTwoFactorMethod } from '../jsonauth.types.js';

export class TwoFactorService {
  getMethods(
    meshServer: MeshCentralServer,
    domain: MeshCentralDomain,
    user: MeshCentralUser,
  ): { supported: string[]; unsupported: string[] } {
    const supported: string[] = [];
    const unsupported: string[] = [];
    if (user.otpsecret != null) supported.push('totp');
    if (user.otpkeys?.keys?.some((key) => key.u === true)) supported.push('backup');
    if (user.otphkeys?.some((key) => key.type === 2)) unsupported.push('yubikey');
    if (user.otphkeys?.some((key) => key.type === 3)) unsupported.push('webauthn');
    if (user.otpekey != null && user.emailVerified === true && domain.mailserver != null) {
      unsupported.push('email');
    }
    if (user.phone != null && meshServer.smsserver != null) unsupported.push('sms');
    if (user.msghandle != null && meshServer.msgserver?.providers !== 0) {
      unsupported.push('messenger');
    }
    if (user.otpdev != null && meshServer.firebase != null) unsupported.push('push');
    if (user.otpduo != null) unsupported.push('duo');
    return { supported, unsupported };
  }

  requires(
    meshServer: MeshCentralServer,
    domain: MeshCentralDomain,
    user: MeshCentralUser,
  ): boolean {
    return (
      meshServer.config?.settings?.no2factorauth !== true &&
      (user.otpsecret != null ||
        user.otpduo != null ||
        (user.otphkeys != null && user.otphkeys.length > 0) ||
        (user.otpekey != null && user.emailVerified === true && domain.mailserver != null) ||
        (user.phone != null && meshServer.smsserver != null) ||
        (user.msghandle != null &&
          meshServer.msgserver != null &&
          meshServer.msgserver.providers !== 0))
    );
  }

  getSkipReason(
    meshServer: MeshCentralServer,
    request: MeshCentralHttpRequest,
    domain: MeshCentralDomain,
    user: MeshCentralUser,
    loginOptions?: Record<string, unknown>,
  ): string | null {
    if (meshServer.config?.settings?.no2factorauth === true) return 'disabled';
    if (typeof loginOptions?.tokenName === 'string') return 'tokenlogin';
    if (
      request.clientIp != null &&
      domain.passwordrequirements?.skip2factor?.some((rule) =>
        this.matchesIpRule(request.clientIp ?? '', rule),
      )
    ) {
      return 'ipaddr';
    }
    const cookieHeader = request.headers.cookie;
    if (typeof cookieHeader !== 'string' || meshServer.decodeCookie == null) return null;
    const cookieValue = cookieHeader
      .split('; ')
      .find((value) => value.startsWith('twofactor='))
      ?.slice(10);
    if (cookieValue == null) return null;
    const cookie = meshServer.decodeCookie(
      decodeURIComponent(cookieValue),
      meshServer.loginCookieEncryptionKey,
      30 * 24 * 60,
    );
    if (cookie == null || cookie.userid !== user._id) return null;
    if (typeof cookie.ip === 'string' && cookie.ip !== request.clientIp) return null;
    return 'cookie';
  }

  verify(
    user: MeshCentralUser,
    method: SupportedTwoFactorMethod,
    token: string,
    now: number,
  ): string | null {
    if (
      method === 'totp' &&
      user.otpsecret != null &&
      this.checkTotp(user.otpsecret, token, now)
    ) {
      return 'otp';
    }
    if (method === 'backup' && /^\d{8}$/u.test(token) && user.otpkeys?.keys != null) {
      const tokenNumber = Number.parseInt(token, 10);
      const backupKey = user.otpkeys.keys.find(
        (key) => key.p === tokenNumber && key.u === true,
      );
      if (backupKey != null) {
        backupKey.u = false;
        return 'backup';
      }
    }
    return null;
  }

  private checkTotp(secret: string, token: string, now: number): boolean {
    if (!/^\d{6}$/u.test(token)) return false;
    const verifier = authenticator.clone();
    verifier.options = { epoch: now, window: 2 };
    try {
      return verifier.check(token, secret);
    } catch {
      return false;
    }
  }

  private matchesIpRule(ip: string, rule: string): boolean {
    if (ip === rule) return true;
    if (rule.endsWith('.*')) return ip.startsWith(rule.slice(0, -1));
    if (!rule.includes('/') || isIP(ip) !== 4) return false;
    const [network, prefixText] = rule.split('/');
    if (network == null || isIP(network) !== 4 || prefixText == null) return false;
    const prefix = Number(prefixText);
    if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return false;
    const toNumber = (address: string) =>
      address
        .split('.')
        .reduce((value, part) => (value << 8) | Number(part), 0) >>> 0;
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    return (toNumber(ip) & mask) === (toNumber(network) & mask);
  }
}