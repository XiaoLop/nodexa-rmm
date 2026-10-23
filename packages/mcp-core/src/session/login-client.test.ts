import { describe, expect, it, vi } from 'vitest';

import { appendMeshAuthQuery } from '../connection/socket-factory';
import { LoginClient, collectCookieHeader } from './login-client';

function responseWithCookies(cookies: readonly string[]): Response {
  const headers = new Headers();
  for (const cookie of cookies) headers.append('set-cookie', cookie);
  return new Response('{}', { status: 200, headers });
}

describe('collectCookieHeader', () => {
  it('keeps the MeshCentral session cookies', () => {
    const header = collectCookieHeader(
      responseWithCookies([
        'xid=abc; Path=/; HttpOnly; Secure',
        'xid.sig=def; Path=/; HttpOnly; Secure',
      ]),
    );
    expect(header).toBe('xid=abc; xid.sig=def');
  });

  it('drops trusted device cookies', () => {
    const header = collectCookieHeader(
      responseWithCookies([
        'xid=abc; Path=/',
        'twofactor=tok; Path=/; HttpOnly',
      ]),
    );
    expect(header).toBe('xid=abc');
  });

  it('returns undefined without a session cookie', () => {
    expect(collectCookieHeader(responseWithCookies(['theme=dark; Path=/']))).toBeUndefined();
    expect(collectCookieHeader(responseWithCookies([]))).toBeUndefined();
  });
});

describe('LoginClient non-JSON responses', () => {
  it('includes bounded response diagnostics when the server does not return JSON', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('<html>upstream error</html>', {
        status: 502,
        statusText: 'Bad Gateway',
        headers: { 'content-type': 'text/html' },
      }),
    );
    const client = new LoginClient({ httpBaseUrl: 'https://mesh.example.com', fetchImpl });

    await expect(client.login({ username: 'alice', password: 'secret' })).rejects.toMatchObject({
      code: 'LOGIN_FAILED',
      details: {
        status: 502,
        statusText: 'Bad Gateway',
        contentType: 'text/html',
        body: '<html>upstream error</html>',
      },
    });
  });

  it('truncates oversized response bodies in diagnostics', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response('x'.repeat(2_000)));
    const client = new LoginClient({ httpBaseUrl: 'https://mesh.example.com', fetchImpl });

    await expect(client.login({ username: 'alice', password: 'secret' })).rejects.toMatchObject({
      details: { body: expect.stringContaining('[truncated]') },
    });
  });
});

describe('appendMeshAuthQuery', () => {
  it('uses the correct separator', () => {
    expect(appendMeshAuthQuery('wss://host/control.ashx', 'a,b')).toBe(
      'wss://host/control.ashx?x-meshauth=a%2Cb',
    );
    expect(appendMeshAuthQuery('wss://host/control?x=1', 'a,b')).toBe(
      'wss://host/control?x=1&x-meshauth=a%2Cb',
    );
  });
});
