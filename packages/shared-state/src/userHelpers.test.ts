import { describe, expect, it } from 'vitest';
import { getGreetingPeriod, getGreetingTime, getUserDisplayName } from './userHelpers';

describe('useUiData user helpers', () => {
  it('classifies greeting periods', () => {
    expect(getGreetingPeriod(new Date('2026-08-18T08:00:00'))).toBe('morning');
    expect(getGreetingPeriod(new Date('2026-08-18T12:00:00'))).toBe('noon');
    expect(getGreetingPeriod(new Date('2026-08-18T15:00:00'))).toBe('afternoon');
    expect(getGreetingPeriod(new Date('2026-08-18T20:00:00'))).toBe('evening');
  });

  it('keeps the deprecated greeting helper language-neutral', () => {
    expect(getGreetingTime(new Date('2026-08-18T08:00:00'))).toBe('Good morning');
    expect(getGreetingTime(new Date('2026-08-18T20:00:00'))).toBe('Good evening');
  });

  it('resolves user display name in priority order', () => {
    expect(
      getUserDisplayName({ id: 'user//admin', name: '张三', removeRights: 0, links: {} }, 'admin'),
    ).toBe('张三');
    expect(
      getUserDisplayName(
        { id: 'user/domain/admin', name: '', removeRights: 0, links: {} },
        'admin',
      ),
    ).toBe('admin');
    expect(getUserDisplayName(undefined, 'administrator')).toBe('administrator');
    expect(getUserDisplayName(undefined, undefined)).toBe('—');
  });
});
