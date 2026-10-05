import { describe, expect, it } from 'vitest';
import { normalizeConnectionTermination } from './termination';

describe('connection termination normalizer', () => {
  it('recognizes top-level and event-wrapped stopped messages', () => {
    expect(normalizeConnectionTermination({ action: 'stopped', msg: 'Session count exceed' }))
      .toMatchObject({ disposition: 'stopped', retryAllowed: false, requiresLogin: false });
    expect(normalizeConnectionTermination({
      action: 'event',
      event: { action: 'stopped', msg: 'Server stopped' },
    })).toMatchObject({ disposition: 'stopped', retryAllowed: false });
  });

  it.each([
    ['noauth', 'authentication-required'],
    ['invalidorigin', 'forbidden-origin'],
    ['expired', 'session-expired'],
    ['banned', 'account-locked'],
    ['locked', 'account-locked'],
  ])('classifies close cause %s', (cause, disposition) => {
    expect(normalizeConnectionTermination({ action: 'close', cause, msg: cause })).toMatchObject({
      disposition,
      cause,
      retryAllowed: false,
      requiresLogin: true,
    });
  });

  it('does not classify an ordinary message as a permanent termination', () => {
    expect(normalizeConnectionTermination({ action: 'event', event: { action: 'agentlog' } }))
      .toBeUndefined();
  });
});