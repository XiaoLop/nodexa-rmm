import { describe, expect, it } from 'vitest';

import { McpToolError } from '../errors';
import { loadMcpConfig, parseServerUrl, resolveControlUrl } from './mcp-config';

describe('parseServerUrl', () => {
  it('derives the http origin from an https url', () => {
    expect(parseServerUrl('https://mesh.example.com')).toEqual({
      httpBaseUrl: 'https://mesh.example.com',
    });
  });

  it('keeps an explicit websocket endpoint', () => {
    expect(parseServerUrl('wss://mesh.example.com/control')).toEqual({
      httpBaseUrl: 'https://mesh.example.com',
      explicitWebSocketUrl: 'wss://mesh.example.com/control',
    });
  });

  it('treats a trailing control.ashx path as the websocket endpoint', () => {
    expect(parseServerUrl('https://mesh.example.com/control.ashx').explicitWebSocketUrl).toBe(
      'wss://mesh.example.com/control.ashx',
    );
  });

  it('rejects unsupported protocols', () => {
    expect(() => parseServerUrl('ftp://mesh.example.com')).toThrow(McpToolError);
  });
});

describe('resolveControlUrl', () => {
  it('appends control.ashx to a plain origin', () => {
    expect(resolveControlUrl('https://mesh.example.com')).toBe(
      'wss://mesh.example.com/control.ashx',
    );
  });

  it('keeps a domain path prefix', () => {
    expect(resolveControlUrl('https://mesh.example.com/site')).toBe(
      'wss://mesh.example.com/site/control.ashx',
    );
  });

  it('passes an explicit websocket url through unchanged', () => {
    expect(resolveControlUrl('wss://mesh.example.com/control')).toBe(
      'wss://mesh.example.com/control',
    );
  });
});

describe('loadMcpConfig', () => {
  it('requires a server url', () => {
    expect(() => loadMcpConfig({})).toThrow(McpToolError);
  });

  it('applies defaults', () => {
    const config = loadMcpConfig({ MESHCENTRAL_URL: 'https://mesh.example.com' });
    expect(config.controlUrl).toBe('wss://mesh.example.com/control.ashx');
    expect(config.authPath).toBe('/auth');
    expect(config.auth).toEqual({ kind: 'session' });
    expect(config.limits.defaultPageSize).toBe(50);
    expect(config.limits.maxPageSize).toBe(200);
    expect(config.allowInsecureTls).toBe(false);
    expect(config.keepAliveIntervalMs).toBe(25_000);
    expect(config.scope).toBeUndefined();
  });

  it('clamps numeric options', () => {
    const config = loadMcpConfig({
      MESHCENTRAL_URL: 'https://mesh.example.com',
      MESHCENTRAL_MCP_PAGE_SIZE: '100000',
      MESHCENTRAL_MCP_MAX_CONCURRENT_CALLS: '0',
    });
    expect(config.limits.defaultPageSize).toBe(200);
    expect(config.maxConcurrentCalls).toBe(1);
  });

  it('parses the device scope lists', () => {
    const config = loadMcpConfig({
      MESHCENTRAL_URL: 'https://mesh.example.com',
      MESHCENTRAL_MCP_SCOPE_DEVICE_GROUPS: 'mesh//a, mesh//b',
      MESHCENTRAL_MCP_SCOPE_DEVICES: 'node//c',
    });
    expect(config.scope).toEqual({
      deviceGroups: ['mesh//a', 'mesh//b'],
      devices: ['node//c'],
    });
  });

  it('requires credentials for meshauth mode', () => {
    expect(() =>
      loadMcpConfig({ MESHCENTRAL_URL: 'https://mesh.example.com', MESHCENTRAL_AUTH: 'meshauth' }),
    ).toThrow(McpToolError);
  });

  it('accepts meshauth credentials from the environment', () => {
    const config = loadMcpConfig({
      MESHCENTRAL_URL: 'https://mesh.example.com',
      MESHCENTRAL_AUTH: 'meshauth',
      MESHCENTRAL_USERNAME: 'admin',
      MESHCENTRAL_PASSWORD: 'secret',
    });
    expect(config.auth).toEqual({
      kind: 'meshauth',
      username: 'admin',
      password: 'secret',
    });
  });

  it('applies command line overrides', () => {
    const config = loadMcpConfig(
      { MESHCENTRAL_URL: 'https://mesh.example.com' },
      { serverUrl: 'https://other.example.com', allowInsecureTls: true },
    );
    expect(config.controlUrl).toBe('wss://other.example.com/control.ashx');
    expect(config.allowInsecureTls).toBe(true);
  });
});
