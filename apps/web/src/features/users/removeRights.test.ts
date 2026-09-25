import { describe, expect, it } from 'vitest';
import {
  composeRemoveRights,
  formatRemoveRightsHex,
  selectedRemoveRights,
} from './removeRights';

describe('user feature restrictions', () => {
  it('combines terminal and file restrictions', () => {
    const removeRights = composeRemoveRights([0x00000200, 0x00000400], 0);
    expect(removeRights).toBe(1536);
    expect(formatRemoveRightsHex(removeRights)).toBe('0x00000600');
  });

  it('restores all known features without discarding unknown restriction bits', () => {
    expect(composeRemoveRights([], 0x80000600)).toBe(0x80000000);
    expect(selectedRemoveRights(0x80000600)).toEqual([0x00000200, 0x00000400]);
  });
});