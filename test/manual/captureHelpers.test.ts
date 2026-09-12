import { describe, expect, it } from 'vitest';
import { sanitize, tunnelRouteResult } from './captureHelpers';

describe('capture sanitization', () => {
  it('redacts secret fields, identifiers, absolute URLs and relative relay paths', () => {
    const result = sanitize({
      cookie: 'cookie-secret',
      nodeid: 'node//real-device',
      url: 'wss://mesh.example.test/meshrelay.ashx?auth=secret&id=relay',
      value: '*/meshrelay.ashx?p=1&nodeid=node%2F%2Freal&rauth=relay-secret',
      message: 'request failed: token=token-secret',
      links: {
        'node//real-device-key': { rights: 16 },
      },
      username: 'real-user',
      _id: 'node//raw-id',
      users: ['domain\\real-user'],
      user: 'real-user',
      msg: 'Started terminal session with private addresses',
      msgArgs: ['session-id', 'private-address'],
    });

    expect(JSON.stringify(result)).not.toContain('cookie-secret');
    expect(JSON.stringify(result)).not.toContain('real-device');
    expect(JSON.stringify(result)).not.toContain('relay-secret');
    expect(JSON.stringify(result)).not.toContain('token-secret');
    expect(JSON.stringify(result)).not.toContain('real-device-key');
    expect(JSON.stringify(result)).not.toContain('real-user');
    expect(JSON.stringify(result)).not.toContain('raw-id');
    expect(result).toMatchObject({
      cookie: '<redacted>',
      nodeid: expect.stringMatching(/^redacted-/),
      url: expect.stringContaining('auth=%3Credacted%3E'),
      value: expect.stringContaining('rauth=%3Credacted%3E'),
      message: 'request failed: token=<redacted>',
      username: '<redacted>',
      _id: expect.stringMatching(/^redacted-/),
      users: '<redacted>',
      user: '<redacted>',
      msg: '<redacted>',
      msgArgs: '<redacted>',
    });
  });

  it('classifies tunnel routing acknowledgements and failures', () => {
    expect(tunnelRouteResult({ action: 'msg', result: 'OK', responseid: 'relay-1' })).toEqual({
      responseId: 'relay-1',
      result: 'OK',
      failed: false,
    });
    expect(
      tunnelRouteResult({ action: 'msg', result: 'Unable to route', responseid: 'relay-1' }),
    ).toEqual({ responseId: 'relay-1', result: 'Unable to route', failed: true });
  });
});