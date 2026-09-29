import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AVATAR_JPEG_QUALITY,
  AVATAR_SIZE,
  getCenteredSquareCrop,
  prepareAvatarImage,
} from './avatarImage';

afterEach(() => {
  vi.unstubAllGlobals();
});

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

describe('prepareAvatarImage', () => {
  it('center-crops, resamples, smooths, and encodes the avatar as JPEG', async () => {
    const drawImage = vi.fn();
    const toDataURL = vi.fn(() => 'data:image/jpeg;base64,YXZhdGFy');
    const context = {
      imageSmoothingEnabled: false,
      imageSmoothingQuality: 'low',
      webkitImageSmoothingEnabled: false,
      mozImageSmoothingEnabled: false,
      drawImage,
    };
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
      toDataURL,
    };
    const bitmap = { width: 1200, height: 800, close: vi.fn() };
    const createImageBitmap = vi.fn(async () => bitmap);

    vi.stubGlobal('createImageBitmap', createImageBitmap);
    vi.stubGlobal('document', { createElement: vi.fn(() => canvas) });

    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' });
    await expect(prepareAvatarImage(file)).resolves.toBe('data:image/jpeg;base64,YXZhdGFy');

    expect(createImageBitmap).toHaveBeenCalledWith(file, { imageOrientation: 'from-image' });
    expect(canvas.width).toBe(AVATAR_SIZE);
    expect(canvas.height).toBe(AVATAR_SIZE);
    expect(context.imageSmoothingEnabled).toBe(true);
    expect(context.webkitImageSmoothingEnabled).toBe(true);
    expect(context.mozImageSmoothingEnabled).toBe(true);
    expect(context.imageSmoothingQuality).toBe('high');
    expect(drawImage).toHaveBeenCalledWith(
      bitmap,
      200,
      0,
      800,
      800,
      0,
      0,
      AVATAR_SIZE,
      AVATAR_SIZE,
    );
    expect(toDataURL).toHaveBeenCalledOnce();
    expect(toDataURL).toHaveBeenCalledWith('image/jpeg', AVATAR_JPEG_QUALITY);
    expect(bitmap.close).toHaveBeenCalledOnce();
  });
});