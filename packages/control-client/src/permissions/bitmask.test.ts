import { describe, expect, it } from 'vitest';
import {
  FULL_RIGHTS,
  composeRights,
  hasAllRights,
  hasAnyRight,
  isFullRights,
  normalizeRights,
} from './bitmask';

describe('permission bitmasks', () => {
  it('normalizes signed protocol values to unsigned 32-bit masks', () => {
    expect(normalizeRights(-1)).toBe(FULL_RIGHTS);
    expect(normalizeRights(undefined)).toBe(0);
    expect(isFullRights(-1)).toBe(true);
  });

  it('composes and checks rights', () => {
    const rights = composeRights([0x8, 0x10, 0x20]);

    expect(rights).toBe(56);
    expect(hasAllRights(rights, 0x8 | 0x10)).toBe(true);
    expect(hasAllRights(rights, 0x40)).toBe(false);
    expect(hasAnyRight(rights, 0x20 | 0x40)).toBe(true);
    expect(hasAllRights(FULL_RIGHTS, 0x800000)).toBe(true);
  });
});