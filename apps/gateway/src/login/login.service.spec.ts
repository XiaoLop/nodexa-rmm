import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';

import type { GatewayConfig } from '../config/gateway-config';
import { LoginService } from './login.service';

const servers: ReturnType<typeof createServer>[] = [];

afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
  );
});

function configFor(origin: string): GatewayConfig {
  return {
    port: 0,
    publicOrigin: new URL('https://console.example.com'),
    upstreamBaseUrl: new URL(origin),
    domainPath: '/customer/',
    trustProxy: false,
    upstreamTimeoutMs: 1_000,
    loginValidationTimeoutMs: 500,
    wsIdleTimeoutMs: 0,
    tlsRejectUnauthorized: true,
    allowMissingOrigin: true,
  };
}

describe('LoginService', () => {
  it('forwards the form and rewrites each Set-Cookie independently', async () => {
    let receivedBody = '';
    const server = createServer((request, response) => {
      expect(request.url).toBe('/customer/login');
      request.setEncoding('utf8');
      request.on('data', (chunk: string) => {
        receivedBody += chunk;
      });
      request.on('end', () => {
        response.setHeader('Set-Cookie', [
          'xid=abc; Domain=mesh.internal; Path=/customer; HttpOnly',
          'xid.sig=xyz; Path=/; Expires=Wed, 21 Oct 2037 07:28:00 GMT',
        ]);
        response.end('<html><script>var authCookie = "present";</script></html>');
      });
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as AddressInfo;

    const result = await new LoginService(configFor(`http://127.0.0.1:${address.port}`)).login(
      'alice',
      'secret',
    );

    expect(receivedBody).toBe('action=login&username=alice&password=secret');
    expect(result.cookies).toHaveLength(2);
    expect(result.cookies[0]).toBe('xid=abc; Path=/api; HttpOnly; SameSite=Lax; Secure');
    expect(result.cookies[1]).toContain('xid.sig=xyz; Path=/api; HttpOnly; SameSite=Lax');
    expect(result.cookies.join(' ')).not.toContain('Domain=');
    expect(result.outcome).toEqual({ accepted: true });
  });

  it.each([
    [112, 'INVALID_CREDENTIALS', false],
    [114, 'RATE_LIMITED', true],
    [115, 'UPSTREAM_UNAVAILABLE', true],
  ] as const)('maps messageid %i to %s', async (messageId, code, retryable) => {
    const server = createServer((_request, response) => {
      response.end(
        `<html><div id="loginpanel"></div><script>var messageid = parseInt('${messageId}'); var loginMode = '1';</script></html>`,
      );
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as AddressInfo;

    const result = await new LoginService(configFor(`http://127.0.0.1:${address.port}`)).login(
      'alice',
      'secret',
    );

    expect(result.outcome).toEqual({ accepted: false, code, retryable });
  });

  it('returns the temporary session cookies when MFA is required', async () => {
    const server = createServer((_request, response) => {
      response.setHeader('Set-Cookie', [
        'xid=temporary; Path=/; HttpOnly',
        'xid.sig=signature; Path=/; HttpOnly',
      ]);
      response.end(
        '<html><div id="loginpanel"></div><script>var messageid = parseInt(\'0\'); var loginMode = \'4\';</script></html>',
      );
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as AddressInfo;

    const result = await new LoginService(configFor(`http://127.0.0.1:${address.port}`)).login(
      'alice',
      'secret',
    );

    expect(result.cookies).toHaveLength(2);
    expect(result.outcome).toEqual({ accepted: false, code: 'MFA_REQUIRED', retryable: false });
  });

  it('maps the password reset panel to PASSWORD_CHANGE_REQUIRED', async () => {
    const server = createServer((_request, response) => {
      response.end(
        '<html><div id="loginpanel"></div><script>var messageid = parseInt(\'113\'); var loginMode = \'6\';</script></html>',
      );
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as AddressInfo;

    const result = await new LoginService(configFor(`http://127.0.0.1:${address.port}`)).login(
      'alice',
      'secret',
    );

    expect(result.outcome).toEqual({
      accepted: false,
      code: 'PASSWORD_CHANGE_REQUIRED',
      retryable: false,
    });
  });

  it('forwards the browser session cookie when verifying MFA', async () => {
    let receivedCookie = '';
    let receivedBody = '';
    const server = createServer((request, response) => {
      receivedCookie = request.headers.cookie ?? '';
      request.setEncoding('utf8');
      request.on('data', (chunk: string) => {
        receivedBody += chunk;
      });
      request.on('end', () => {
        response.end(
          '<html><div id="loginpanel"></div><script>var messageid = parseInt(\'108\'); var loginMode = \'4\';</script></html>',
        );
      });
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as AddressInfo;

    const result = await new LoginService(
      configFor(`http://127.0.0.1:${address.port}`),
    ).verifyMfa('123456', 'hardware-key', 'xid=temporary; xid.sig=signature');

    expect(receivedCookie).toBe('xid=temporary; xid.sig=signature');
    expect(receivedBody).toBe('action=tokenlogin&token=123456&hwtoken=hardware-key');
    expect(result.outcome).toEqual({ accepted: false, code: 'MFA_INVALID', retryable: true });
  });
});
