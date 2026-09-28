export const AVATAR_SIZE = 256;
export const MAX_AVATAR_FILE_SIZE = 10 * 1024 * 1024;
export const AVATAR_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;

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
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D is unavailable.');

    context.imageSmoothingEnabled = true;
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

    const webp = canvas.toDataURL('image/webp', 0.86);
    return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', 0.88);
  } finally {
    bitmap.close();
  }
}