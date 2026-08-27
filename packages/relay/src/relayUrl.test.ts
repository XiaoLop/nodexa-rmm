import { describe, expect, it } from 'vitest';
import { buildAgentRelayPath, buildRelayUrl } from './relayUrl';

describe('relay URLs', () => {
  it('builds a browser relay URL from an HTTP domain base URL', () => {
    const url = new URL(
      buildRelayUrl({
        baseUrl: 'https://mesh.example.com/domain/',
        deviceId: 'node//one',
        protocol: 5,
        relayId: 'relay-id',
        authCookie: 'browser cookie',
      }),
    );

    expect(url.protocol).toBe('wss:');
    expect(url.pathname).toBe('/domain/meshrelay.ashx');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      browser: '1',
      p: '5',
      nodeid: 'node//one',
      id: 'relay-id',
      auth: 'browser cookie',
    });
  });

  it('builds an encoded agent relay path', () => {
    expect(buildAgentRelayPath('node//one', 1, 'relay-id', 'agent cookie')).toBe(
      '*/meshrelay.ashx?p=1&nodeid=node%2F%2Fone&id=relay-id&rauth=agent+cookie',
    );
  });
});
