import { describe, expect, it } from 'vitest';
import { inspectConnectionMessage, requiredConnectionSignals } from './codec';

describe('gateway connection inspection', () => {
  it('treats serverinfo and userinfo as the required legacy connection signals', () => {
    expect(requiredConnectionSignals).toEqual(['serverinfo', 'userinfo']);
    expect(inspectConnectionMessage({ action: 'serverinfo' })).toEqual({
      status: 'pending',
      signal: 'serverinfo',
    });
    expect(
      inspectConnectionMessage({ action: 'userinfo', userinfo: { _id: 'user//operator' } }),
    ).toEqual({ status: 'pending', signal: 'userinfo' });
  });

  it('still accepts and rejects explicit authentication results', () => {
    expect(inspectConnectionMessage({ type: 'authenticated' })).toEqual({ status: 'accepted' });
    expect(inspectConnectionMessage({ type: 'authenticationFailed', message: 'Denied' })).toEqual({
      status: 'rejected',
      error: 'Denied',
    });
  });
});