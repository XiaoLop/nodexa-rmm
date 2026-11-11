import { describe, expect, it } from 'vitest';
import { createCompressionMessage } from '@meshcentral/relay';
import { DESKTOP_PRESETS, desktopCompression } from './desktopSettings';
describe('desktop compression policy', () => {
  it('retains explicit preset parameters and full-size transport until acceptance', () => {
    expect(DESKTOP_PRESETS.smooth).toEqual({ imageFormat: 'webp', quality: 45, frameTimer: 50 });
    expect([...createCompressionMessage(desktopCompression(DESKTOP_PRESETS.smooth))]).toEqual([
      0, 5, 0, 10, 4, 45, 4, 0, 0, 50,
    ]);
    expect(desktopCompression({ quality: 58, scaling: 512 }).scaling).toBe(1024);
  });
});
