import type { DesktopScreenSize, DesktopTile } from '@meshcentral/relay';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

export interface DesktopCanvasHandle {
  setScreen(screen: DesktopScreenSize): void;
  clear(): void;
  drawTile(tile: DesktopTile): void;
}

interface DesktopCanvasProps {
  scale: string;
  onReady?: () => void;
  onDecodeError?: (error: Error) => void;
}

interface CoverageRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function unionArea(rectangles: CoverageRect[]): number {
  const xs = [...new Set(rectangles.flatMap((rect) => [rect.left, rect.right]))].sort((a, b) => a - b);
  let area = 0;
  for (let index = 0; index < xs.length - 1; index += 1) {
    const left = xs[index]!;
    const right = xs[index + 1]!;
    const intervals = rectangles
      .filter((rect) => rect.left < right && rect.right > left)
      .map((rect) => [rect.top, rect.bottom] as const)
      .sort((first, second) => first[0] - second[0]);
    let coveredHeight = 0;
    let start = -1;
    let end = -1;
    for (const [top, bottom] of intervals) {
      if (top > end) {
        if (end > start) coveredHeight += end - start;
        start = top;
        end = bottom;
      } else end = Math.max(end, bottom);
    }
    if (end > start) coveredHeight += end - start;
    area += (right - left) * coveredHeight;
  }
  return area;
}

function applyScale(canvas: HTMLCanvasElement, screen: DesktopScreenSize | undefined, scale: string): void {
  if (!screen) return;
  if (scale === 'fit') {
    const container = canvas.parentElement;
    if (!container) return;
    const factor = Math.min(container.clientWidth / screen.width, container.clientHeight / screen.height);
    canvas.style.width = `${Math.max(1, Math.floor(screen.width * factor))}px`;
    canvas.style.height = `${Math.max(1, Math.floor(screen.height * factor))}px`;
    canvas.style.maxWidth = 'none';
    canvas.style.maxHeight = 'none';
    return;
  }
  const factor = Math.max(1, Number(scale) || 100) / 100;
  canvas.style.width = `${Math.round(screen.width * factor)}px`;
  canvas.style.height = `${Math.round(screen.height * factor)}px`;
  canvas.style.maxWidth = 'none';
  canvas.style.maxHeight = 'none';
}

export const DesktopCanvas = forwardRef<DesktopCanvasHandle, DesktopCanvasProps>(function DesktopCanvas(
  { scale, onReady, onDecodeError },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const screenRef = useRef<DesktopScreenSize | undefined>(undefined);
  const drawQueue = useRef(Promise.resolve());
  const generationRef = useRef(0);
  const coverageRef = useRef<CoverageRect[]>([]);
  const readyRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = canvas?.parentElement;
    if (!canvas || !container) return;
    const resize = () => applyScale(canvas, screenRef.current, scale);
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => observer.disconnect();
  }, [scale]);

  useImperativeHandle(ref, () => ({
    setScreen(screen) {
      const current = screenRef.current;
      if (current?.width === screen.width && current.height === screen.height) return;
      const canvas = canvasRef.current;
      screenRef.current = { ...screen };
      generationRef.current += 1;
      coverageRef.current = [];
      readyRef.current = false;
      if (!canvas) return;
      canvas.width = screen.width;
      canvas.height = screen.height;
      applyScale(canvas, screen, scale);
      canvas.getContext('2d')?.clearRect(0, 0, screen.width, screen.height);
    },
    clear() {
      const canvas = canvasRef.current;
      generationRef.current += 1;
      coverageRef.current = [];
      readyRef.current = false;
      screenRef.current = undefined;
      if (!canvas) return;
      canvas.width = 0;
      canvas.height = 0;
    },
    drawTile(tile) {
      const generation = generationRef.current;
      drawQueue.current = drawQueue.current.then(async () => {
        const canvas = canvasRef.current;
        const screen = screenRef.current;
        if (!canvas || !screen || generation !== generationRef.current) return;
        const mime = tile.imageFormat === 'jpeg' ? 'image/jpeg' : `image/${tile.imageFormat}`;
        const imageBytes = new Uint8Array(tile.image.byteLength);
        imageBytes.set(tile.image);
        const blob = new Blob([imageBytes.buffer], { type: mime });
        let decoded: ImageBitmap | HTMLImageElement | undefined;
        let objectUrl: string | undefined;
        try {
          if ('createImageBitmap' in window) decoded = await createImageBitmap(blob);
          else {
            objectUrl = URL.createObjectURL(blob);
            decoded = await new Promise<HTMLImageElement>((resolve, reject) => {
              const image = new Image();
              image.onload = () => resolve(image);
              image.onerror = () => reject(new Error('Desktop image decode failed.'));
              image.src = objectUrl!;
            });
          }
          if (generation !== generationRef.current) return;
          canvas.getContext('2d')?.drawImage(decoded, tile.x, tile.y);
          if (!readyRef.current) {
            const left = Math.max(0, tile.x);
            const top = Math.max(0, tile.y);
            const right = Math.min(screen.width, tile.x + decoded.width);
            const bottom = Math.min(screen.height, tile.y + decoded.height);
            if (right > left && bottom > top) coverageRef.current.push({ left, top, right, bottom });
            if (unionArea(coverageRef.current) >= screen.width * screen.height) {
              readyRef.current = true;
              onReady?.();
            }
          }
        } finally {
          if (decoded instanceof ImageBitmap) decoded.close();
          if (objectUrl) URL.revokeObjectURL(objectUrl);
        }
      }).catch((error: unknown) => onDecodeError?.(error instanceof Error ? error : new Error('Desktop image decode failed.')));
    },
  }), [onDecodeError, onReady, scale]);

  return <canvas ref={canvasRef} className="desktop-canvas" aria-label="远程桌面画面" />;
});
