import { describe, expect, it } from 'vitest';
import { getCenteredSquareCrop } from './avatarImage';

describe('getCenteredSquareCrop', () => {
  it('crops a landscape image from the horizontal center', () => {
    expect(getCenteredSquareCrop(1200, 800)).toEqual({ x: 200, y: 0, size: 800 });
  });

  it('crops a portrait image from the vertical center', () => {
    expect(getCenteredSquareCrop(600, 1000)).toEqual({ x: 0, y: 200, size: 600 });
  });

  it('keeps square images unchanged', () => {
    expect(getCenteredSquareCrop(256, 256)).toEqual({ x: 0, y: 0, size: 256 });
  });
});