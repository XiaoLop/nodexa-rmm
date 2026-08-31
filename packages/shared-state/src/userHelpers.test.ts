import { describe, expect, it } from 'vitest';
import { getGreetingTime, getUserDisplayName } from './userHelpers';

describe('useUiData user helpers', () => {
  it('returns correct greeting time', () => {
    expect(getGreetingTime(new Date('2026-08-18T08:00:00'))).toBe('早上好');
    expect(getGreetingTime(new Date('2026-08-18T12:00:00'))).toBe('中午好');
    expect(getGreetingTime(new Date('2026-08-18T15:00:00'))).toBe('下午好');
    expect(getGreetingTime(new Date('2026-08-18T20:00:00'))).toBe('晚上好');
  });

  it('resolves user display name in priority order', () => {
    expect(getUserDisplayName({ id: 'user//admin', name: '张三' }, 'admin')).toBe('张三');
    expect(getUserDisplayName({ id: 'user/domain/admin', name: '' }, 'admin')).toBe('admin');
    expect(getUserDisplayName(undefined, 'administrator')).toBe('administrator');
    expect(getUserDisplayName(undefined, undefined)).toBe('林默');
  });
});
