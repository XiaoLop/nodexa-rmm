// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { requestMeshLogout } from './logout';

describe('requestMeshLogout', () => {
  it('posts to the JSON auth logout endpoint with the session cookie', async () => {
    const fetcher = vi.fn(async () => new Response(
      JSON.stringify({ code: 200, status: 'SUCCESS' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ));

    await requestMeshLogout(fetcher);

    expect(fetcher).toHaveBeenCalledWith('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
  });

  it('rejects unsuccessful logout responses', async () => {
    const fetcher = vi.fn(async () => new Response(
      JSON.stringify({ code: 500, status: 'SERVER_UNAVAILABLE' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    ));

    await expect(requestMeshLogout(fetcher)).rejects.toThrow('mesh-logout-failed');
  });
});