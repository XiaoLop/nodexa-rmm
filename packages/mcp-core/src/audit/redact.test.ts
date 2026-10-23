import { describe, expect, it } from 'vitest';

import { redactSensitive } from './redact';

describe('redactSensitive', () => {
  it('redacts known sensitive keys at any depth', () => {
    expect(
      redactSensitive({
        username: 'alice',
        password: 'p',
        nested: { cookie: 'xid=1', token: 'abc' },
      }),
    ).toEqual({
      username: 'alice',
      password: '[redacted]',
      nested: { cookie: '[redacted]', token: '[redacted]' },
    });
  });

  it('is case insensitive', () => {
    expect(redactSensitive({ Authorization: 'Bearer x' })).toEqual({
      Authorization: '[redacted]',
    });
  });

  it('handles arrays', () => {
    expect(redactSensitive([{ secret: 'x' }, { ok: true }])).toEqual([
      { secret: '[redacted]' },
      { ok: true },
    ]);
  });

  it('keeps primitives', () => {
    expect(redactSensitive('value')).toBe('value');
    expect(redactSensitive(3)).toBe(3);
    expect(redactSensitive(null)).toBeNull();
  });
});
