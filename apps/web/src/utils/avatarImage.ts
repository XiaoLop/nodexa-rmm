export const AVATAR_SIZE = 256;
export const MAX_AVATAR_FILE_SIZE = 10 * 1024 * 1024;
export const AVATAR_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;
export const AVATAR_JPEG_QUALITY = 0.88;

type CompatibleCanvasRenderingContext2D = CanvasRenderingContext2D & {
  webkitImageSmoothingEnabled?: boolean;
  mozImageSmoothingEnabled?: boolean;
};

export interface SquareCrop {
  x: number;
  y: number;
  size: number;
}

export function getCenteredSquareCrop(width: number, height: number): SquareCrop {
  const size = Math.min(width, height);
  return {
    x: (width - size) / 2,
    y: (height - size) / 2,
    size,
  };
}

export async function prepareAvatarImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const crop = getCenteredSquareCrop(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    const context = canvas.getContext('2d') as CompatibleCanvasRenderingContext2D | null;
    if (!context) throw new Error('Canvas 2D is unavailable.');

    context.imageSmoothingEnabled = true;
    context.webkitImageSmoothingEnabled = true;
    context.mozImageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(
      bitmap,
      crop.x,
      crop.y,
      crop.size,
      crop.size,
      0,
      0,
      AVATAR_SIZE,
      AVATAR_SIZE,
    );

    return canvas.toDataURL('image/jpeg', AVATAR_JPEG_QUALITY);
  } finally {
    bitmap.close();
  }
}