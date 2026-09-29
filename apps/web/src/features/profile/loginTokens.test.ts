import type { MeshCentralClient } from '@meshcentral/control-client';
import { describe, expect, it, vi } from 'vitest';
import { createLoginToken, listLoginTokens, removeLoginToken } from './loginTokens';

function createClient() {
  let listener: ((message: unknown) => void) | undefined;
  const unsubscribe = vi.fn();
  const send = vi.fn();
  const client = {
    on: vi.fn((_channel: string, nextListener: (message: unknown) => void) => {
      listener = nextListener;
      return unsubscribe;
    }),
    send,
  } as unknown as MeshCentralClient;
  return { client, send, unsubscribe, emit: (message: unknown) => listener?.(message) };
}

describe('login tokens', () => {
  it('lists login tokens', async () => {
    const runtime = createClient();
    const pending = listLoginTokens(runtime.client);
    expect(runtime.send).toHaveBeenCalledWith({ action: 'loginTokens' });

    runtime.emit({
      action: 'loginTokens',
      loginTokens: [
        { name: 'test', tokenUser: '~t:xWwaV4RVCBSCyXed', created: 1790669172939, expire: 0 },
      ],
    });

    await expect(pending).resolves.toEqual([
      { name: 'test', tokenUser: '~t:xWwaV4RVCBSCyXed', created: 1790669172939, expire: 0 },
    ]);
    expect(runtime.unsubscribe).toHaveBeenCalledOnce();
  });

  it('creates a login token with a seven-day expiration', async () => {
    const runtime = createClient();
    const pending = createLoginToken(runtime.client, 'test', 10080);
    expect(runtime.send).toHaveBeenCalledWith({
      action: 'createLoginToken',
      name: 'test',
      expire: 10080,
    });

    runtime.emit({
      action: 'createLoginToken',
      name: 'test',
      tokenUser: '~t:xWwaV4RVCBSCyXed',
      tokenPass: 'ubmJYOreEYZgv8W1k8TA',
      created: 1790669172939,
      expire: 1791273972939,
    });

    await expect(pending).resolves.toEqual({
      name: 'test',
      tokenUser: '~t:xWwaV4RVCBSCyXed',
      tokenPass: 'ubmJYOreEYZgv8W1k8TA',
      created: 1790669172939,
      expire: 1791273972939,
    });
  });

  it('removes a login token and returns the remaining list', async () => {
    const runtime = createClient();
    const pending = removeLoginToken(runtime.client, '~t:xWwaV4RVCBSCyXed');
    expect(runtime.send).toHaveBeenCalledWith({
      action: 'loginTokens',
      remove: ['~t:xWwaV4RVCBSCyXed'],
    });

    runtime.emit({ action: 'loginTokens', loginTokens: [] });

    await expect(pending).resolves.toEqual([]);
    expect(runtime.unsubscribe).toHaveBeenCalledOnce();
  });

  it('rejects malformed responses', async () => {
    const runtime = createClient();
    const pending = listLoginTokens(runtime.client);
    runtime.emit({ action: 'loginTokens', loginTokens: [{ name: 'test' }] });
    await expect(pending).rejects.toMatchObject({ code: 'invalidResponse' });
  });
});