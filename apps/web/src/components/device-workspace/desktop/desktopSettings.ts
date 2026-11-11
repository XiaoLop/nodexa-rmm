import type { DesktopCompressionOptions } from '@meshcentral/relay';
export type DesktopPreset = 'smooth' | 'balanced' | 'clear' | 'custom';
export const DESKTOP_PRESETS = {
  smooth: { imageFormat: 'webp', quality: 45, frameTimer: 50 },
  balanced: { imageFormat: 'webp', quality: 58, frameTimer: 50 },
  clear: { imageFormat: 'webp', quality: 75, frameTimer: 100 },
} as const;
/** Agent scaling compatibility is not accepted yet: keep full-size transport. */
export function desktopCompression(settings: DesktopCompressionOptions): DesktopCompressionOptions {
  return {
    imageFormat: settings.imageFormat,
    quality: settings.quality,
    frameTimer: settings.frameTimer,
    scaling: 1024,
  };
}
