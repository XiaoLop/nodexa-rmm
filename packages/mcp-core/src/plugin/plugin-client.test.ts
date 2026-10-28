import { describe, expect, it, vi } from 'vitest';
import { McpPluginTransport } from './plugin-client';

const config = {
  httpBaseUrl: 'https://mesh.example.test',
  mcpPluginPath: '/plugin/mcp/v1',
  requestTimeoutMs: 1000,
} as never;

describe('McpPluginTransport', () => {
  it('calls health with a bearer token', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    const tokens = { accessToken: vi.fn().mockResolvedValue('access-1')     } as unknown as {
      accessToken: () => Promise<string>;
      refreshOnce: () => Promise<{ accessToken: string }>;
    };
    const client = new McpPluginTransport(config, tokens as never, { fetch });

    await expect(client.health()).resolves.toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledWith(
      'https://mesh.example.test/plugin/mcp/v1/health',
      expect.objectContaining({ headers: { Accept: 'application/json', Authorization: 'Bearer access-1' } }),
    );
  });

  it('refreshes once and retries a rejected token', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'invalid_token' }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ groups: [] }), { status: 200 }));
    const tokens = {
      accessToken: vi.fn().mockResolvedValue('expired'),
      refreshOnce: vi.fn().mockResolvedValue({ accessToken: 'fresh' }),
    } as {
      accessToken: () => Promise<string>;
      refreshOnce: ReturnType<typeof vi.fn>;
    };
    const client = new McpPluginTransport(config, tokens as never, { fetch });

    await expect(client.groupsList()).resolves.toEqual([]);
    expect(tokens.refreshOnce).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
