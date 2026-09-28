// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import {
  registerMeshUser,
  requestRegistrationAvailability,
} from './registration';
import type { RegistrationError } from './registration';

describe('requestRegistrationAvailability', () => {
  it('gets registration availability with the session cookie', async () => {
    const fetcher = vi.fn(async () => new Response(
      JSON.stringify({ allowed: true, isFirstUser: true, userCount: 0 }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ));

    await expect(requestRegistrationAvailability(fetcher)).resolves.toMatchObject({
      allowed: true,
      isFirstUser: true,
    });
    expect(fetcher).toHaveBeenCalledWith('/api/auth/can-register', {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
  });

  it('rejects malformed availability responses', async () => {
    const fetcher = vi.fn(async () => new Response(
      JSON.stringify({ reason: 'unavailable' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ));

    await expect(requestRegistrationAvailability(fetcher)).rejects.toThrow(
      'registration-availability-unavailable',
    );
  });

  it('posts a new account to the JSON registration endpoint', async () => {
    const fetcher = vi.fn(async () => new Response(
      JSON.stringify({
        code: 201,
        status: 'SUCCESS',
        message: '注册成功',
        data: {
          id: 'user//alice',
          username: 'alice',
          email: 'alice@example.com',
          isAdmin: true,
        },
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } },
    ));

    await expect(registerMeshUser({
      username: 'alice',
      email: 'alice@example.com',
      password: 'secret',
      token: 'invite-only',
    }, fetcher)).resolves.toMatchObject({ username: 'alice', isAdmin: true });
    expect(fetcher).toHaveBeenCalledWith('/api/auth/register', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'alice',
        email: 'alice@example.com',
        password: 'secret',
        token: 'invite-only',
      }),
    });
  });

  it('preserves registration error status for localized messages', async () => {
    const fetcher = vi.fn(async () => new Response(
      JSON.stringify({
        code: 409,
        status: 'USERNAME_EXISTS',
        message: '用户名已存在',
      }),
      { status: 409, headers: { 'Content-Type': 'application/json' } },
    ));

    await expect(registerMeshUser({
      username: 'alice',
      email: 'alice@example.com',
      password: 'secret',
    }, fetcher)).rejects.toMatchObject({
      status: 'USERNAME_EXISTS',
    } satisfies Partial<RegistrationError>);
  });
});