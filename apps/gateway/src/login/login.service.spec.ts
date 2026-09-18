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
          'sid=abc; Domain=mesh.internal; Path=/customer; HttpOnly',
          'prefs=xyz; Path=/; Expires=Wed, 21 Oct 2037 07:28:00 GMT',
        ]);
        response.end('<html>ignored</html>');
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
    expect(result.cookies[0]).toBe('sid=abc; Path=/api; HttpOnly; SameSite=Lax; Secure');
    expect(result.cookies[1]).toContain('prefs=xyz; Path=/api; HttpOnly; SameSite=Lax');
    expect(result.cookies.join(' ')).not.toContain('Domain=');
  });
});
