import { createServer, type RequestListener } from 'node:http';
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
    tlsRejectUnauthorized: true,
  };
}

async function startServer(
  handler: RequestListener,
): Promise<{ origin: string }> {
  const server = createServer(handler);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as AddressInfo;
  return { origin: `http://127.0.0.1:${address.port}` };
}

describe('LoginService', () => {
  it('posts JSON credentials and rewrites authentication cookies', async () => {
    let receivedBody = '';
    let contentType = '';
    let receivedCookie = '';
    const { origin } = await startServer((request, response) => {
      expect(request.url).toBe('/customer/api/auth/login');
      contentType = request.headers['content-type'] ?? '';
      receivedCookie = request.headers.cookie ?? '';
      request.setEncoding('utf8');
      request.on('data', (chunk: string) => {
        receivedBody += chunk;
      });
      request.on('end', () => {
        response.setHeader('Content-Type', 'application/json');
        response.setHeader('Set-Cookie', [
          'xid=abc; Domain=mesh.internal; Path=/customer; HttpOnly',
          'xid.sig=xyz; Path=/; Expires=Wed, 21 Oct 2037 07:28:00 GMT',
          'twofactor=trusted; Path=/; HttpOnly; SameSite=Strict',
        ]);
        response.end(JSON.stringify({
          code: 200,
          status: 'SUCCESS',
          message: '登录成功',
          data: { username: 'Alice' },
        }));
      });
    });

    const result = await new LoginService(configFor(origin)).login(
      'alice',
      'secret',
      true,
      'twofactor=existing-trust',
    );

    expect(contentType).toBe('application/json');
    expect(receivedCookie).toBe('twofactor=existing-trust');
    expect(JSON.parse(receivedBody)).toEqual({
      username: 'alice',
      password: 'secret',
      rememberToken: true,
    });
    expect(result.cookies).toHaveLength(3);
    expect(result.cookies[0]).toBe('xid=abc; Path=/api; HttpOnly; SameSite=Lax; Secure');
    expect(result.cookies[1]).toContain('xid.sig=xyz; Path=/api; HttpOnly; SameSite=Lax');
    expect(result.cookies[2]).toBe('twofactor=trusted; Path=/api; HttpOnly; SameSite=Lax; Secure');
    expect(result.cookies.join(' ')).not.toContain('Domain=');
    expect(result.response).toMatchObject({ status: 'SUCCESS', data: { username: 'Alice' } });
  });

  it('returns a structured 2FA challenge', async () => {
    const { origin } = await startServer((_request, response) => {
      response.setHeader('Content-Type', 'application/json');
      response.statusCode = 202;
      response.end(JSON.stringify({
        code: 202,
        status: 'REQUIRE_2FA',
        message: '密码验证通过，请完成二阶段验证',
        data: {
          transactionId: 'a'.repeat(64),
          expiresIn: 300,
          methods: [
            { type: 'totp', supported: true },
            { type: 'webauthn', supported: false },
          ],
        },
      }));
    });

    const result = await new LoginService(configFor(origin)).login('alice', 'secret', false);

    expect(result.status).toBe(202);
    expect(result.response).toMatchObject({
      status: 'REQUIRE_2FA',
      data: { transactionId: 'a'.repeat(64), expiresIn: 300 },
    });
  });

  it('posts the 2FA transaction to the verification endpoint', async () => {
    let receivedBody = '';
    const { origin } = await startServer((request, response) => {
      expect(request.url).toBe('/customer/api/auth/login/verify-2fa');
      request.setEncoding('utf8');
      request.on('data', (chunk: string) => {
        receivedBody += chunk;
      });
      request.on('end', () => {
        response.setHeader('Content-Type', 'application/json');
        response.end(JSON.stringify({ code: 200, status: 'SUCCESS', message: '登录成功' }));
      });
    });

    const result = await new LoginService(configFor(origin)).verifyTwoFactor(
      'a'.repeat(64),
      'totp',
      '123456',
      true,
    );

    expect(JSON.parse(receivedBody)).toEqual({
      transactionId: 'a'.repeat(64),
      type: 'totp',
      code: '123456',
      rememberToken: true,
    });
    expect(result.response.status).toBe('SUCCESS');
  });

  it('preserves plugin error statuses', async () => {
    const { origin } = await startServer((_request, response) => {
      response.setHeader('Content-Type', 'application/json');
      response.statusCode = 423;
      response.end(JSON.stringify({
        code: 423,
        status: 'ACCOUNT_LOCKED',
        message: '登录尝试次数过多，请稍后再试',
      }));
    });

    const result = await new LoginService(configFor(origin)).login('alice', 'bad', false);

    expect(result.status).toBe(423);
    expect(result.response.status).toBe('ACCOUNT_LOCKED');
  });

  it('rejects non-jsonauth upstream responses', async () => {
    const { origin } = await startServer((_request, response) => {
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ accepted: true }));
    });

    await expect(
      new LoginService(configFor(origin)).login('alice', 'secret', false),
    ).rejects.toThrow('invalid-jsonauth-response');
  });
});