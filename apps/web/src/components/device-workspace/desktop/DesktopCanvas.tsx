import type {
  DesktopMouseButton,
  DesktopScreenSize,
  DesktopSession,
  DesktopTile,
} from '@meshcentral/relay';
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import { useTranslation } from 'react-i18next';

export interface DesktopCanvasHandle {
  setScreen(screen: DesktopScreenSize): void;
  clear(): void;
  drawTile(tile: DesktopTile): void;
  releaseInput(): void;
}

interface DesktopCanvasProps {
  scale: string;
  session?: DesktopSession;
  keyboardEnabled: boolean;
  mouseEnabled: boolean;
  onReady?: () => void;
  onDecodeError?: (error: Error) => void;
}

interface CoverageRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const MAX_CONCURRENT_DECODES = 3;

function unionArea(rectangles: CoverageRect[]): number {
  const xs = [...new Set(rectangles.flatMap((rect) => [rect.left, rect.right]))].sort(
    (a, b) => a - b,
  );
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

function applyScale(
  canvas: HTMLCanvasElement,
  screen: DesktopScreenSize | undefined,
  scale: string,
): void {
  if (!screen) return;
  const container = canvas.parentElement;
  if (!container) return;

  if (scale === 'fit') {
    // 保持被控端原始屏幕的真实纵横比，在画面容器内最大化居中呈现，不变形
    const factor = Math.min(
      container.clientWidth / screen.width,
      container.clientHeight / screen.height,
    );
    canvas.style.width = `${Math.max(1, Math.floor(screen.width * factor))}px`;
    canvas.style.height = `${Math.max(1, Math.floor(screen.height * factor))}px`;
    canvas.style.maxWidth = 'none';
    canvas.style.maxHeight = 'none';
    return;
  }
  if (scale === 'stretch') {
    canvas.style.width = `${container.clientWidth}px`;
    canvas.style.height = `${container.clientHeight}px`;
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

const EXTENDED_KEYS = new Set([
  'ArrowLeft',
  'ArrowUp',
  'ArrowRight',
  'ArrowDown',
  'Insert',
  'Delete',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'NumpadEnter',
  'ControlRight',
  'AltRight',
]);

function desktopKeyCode(event: Pick<KeyboardEvent, 'code' | 'key'>): number | undefined {
  if (/^Key[A-Z]$/.test(event.code)) return event.code.charCodeAt(3);
  if (/^Digit[0-9]$/.test(event.code)) return event.code.charCodeAt(5);
  if (/^F(?:[1-9]|1[0-2])$/.test(event.code)) return 111 + Number(event.code.slice(1));
  const codes: Record<string, number> = {
    Backspace: 8,
    Tab: 9,
    Enter: 13,
    ShiftLeft: 16,
    ShiftRight: 16,
    ControlLeft: 17,
    ControlRight: 17,
    AltLeft: 18,
    AltRight: 18,
    Pause: 19,
    CapsLock: 20,
    Escape: 27,
    Space: 32,
    PageUp: 33,
    PageDown: 34,
    End: 35,
    Home: 36,
    ArrowLeft: 37,
    ArrowUp: 38,
    ArrowRight: 39,
    ArrowDown: 40,
    PrintScreen: 44,
    Insert: 45,
    Delete: 46,
    MetaLeft: 91,
    MetaRight: 92,
    ContextMenu: 93,
    NumLock: 144,
    ScrollLock: 145,
    Semicolon: 186,
    Equal: 187,
    Comma: 188,
    Minus: 189,
    Period: 190,
    Slash: 191,
    Backquote: 192,
    BracketLeft: 219,
    Backslash: 220,
    BracketRight: 221,
    Quote: 222,
  };
  return (
    codes[event.code] ??
    (event.key.length === 1 && event.key.charCodeAt(0) <= 0xff
      ? event.key.toUpperCase().charCodeAt(0)
      : undefined)
  );
}

function mouseButton(button: number): DesktopMouseButton | undefined {
  if (button === 0) return 'left';
  if (button === 1) return 'middle';
  if (button === 2) return 'right';
  return undefined;
}

export const DesktopCanvas = forwardRef<DesktopCanvasHandle, DesktopCanvasProps>(
  function DesktopCanvas(
    { scale, session, keyboardEnabled, mouseEnabled, onReady, onDecodeError },
    ref,
  ) {
    const { t } = useTranslation();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const screenRef = useRef<DesktopScreenSize | undefined>(undefined);
    const drawQueue = useRef(Promise.resolve());
    const decodeLanesRef = useRef(
      Array.from({ length: MAX_CONCURRENT_DECODES }, () => Promise.resolve()),
    );
    const nextDecodeLaneRef = useRef(0);
    const generationRef = useRef(0);
    const coverageRef = useRef<CoverageRect[]>([]);
    const readyRef = useRef(false);
    const pressedKeysRef = useRef(new Map<string, { keyCode: number; extended: boolean }>());
    const pressedButtonsRef = useRef(new Set<DesktopMouseButton>());
    const pendingMoveRef = useRef<{ x: number; y: number } | undefined>(undefined);
    const moveFrameRef = useRef<number | undefined>(undefined);

    const pointFromEvent = (event: { clientX: number; clientY: number }) => {
      const canvas = canvasRef.current;
      const screen = screenRef.current;
      if (!canvas || !screen) return undefined;
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return undefined;
      return {
        x: Math.min(
          screen.width - 1,
          Math.max(0, Math.round(((event.clientX - rect.left) / rect.width) * screen.width)),
        ),
        y: Math.min(
          screen.height - 1,
          Math.max(0, Math.round(((event.clientY - rect.top) / rect.height) * screen.height)),
        ),
      };
    };

    const releaseInput = () => {
      if (session?.state === 'closed' || session?.state === 'error') return;
      for (const { keyCode, extended } of pressedKeysRef.current.values())
        session?.sendKey(keyCode, 'up', extended);
      pressedKeysRef.current.clear();
      const canvas = canvasRef.current;
      const screen = screenRef.current;
      const point =
        canvas && screen
          ? { x: Math.floor(screen.width / 2), y: Math.floor(screen.height / 2) }
          : undefined;
      if (point)
        for (const button of pressedButtonsRef.current)
          session?.sendMouseButton(button, 'up', point);
      pressedButtonsRef.current.clear();
    };

    useEffect(() => {
      const handleWindowBlur = () => releaseInput();
      window.addEventListener('blur', handleWindowBlur);
      return () => window.removeEventListener('blur', handleWindowBlur);
    }, [session]);

    useEffect(() => {
      if (!keyboardEnabled || !mouseEnabled) releaseInput();
    }, [keyboardEnabled, mouseEnabled, session]);

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

    useImperativeHandle(
      ref,
      () => ({
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
          releaseInput();
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
          const mime = tile.imageFormat === 'jpeg' ? 'image/jpeg' : `image/${tile.imageFormat}`;
          const imageBytes =
            tile.image.buffer instanceof ArrayBuffer
              ? new Uint8Array(tile.image.buffer, tile.image.byteOffset, tile.image.byteLength)
              : Uint8Array.from(tile.image);
          const blob = new Blob([imageBytes], { type: mime });
          const lane = nextDecodeLaneRef.current;
          nextDecodeLaneRef.current = (lane + 1) % MAX_CONCURRENT_DECODES;
          let objectUrl: string | undefined;
          const decode = decodeLanesRef.current[lane]!.then(
            async (): Promise<ImageBitmap | HTMLImageElement> => {
              if ('createImageBitmap' in window) return createImageBitmap(blob);
              return new Promise<HTMLImageElement>((resolve, reject) => {
                objectUrl = URL.createObjectURL(blob);
                const image = new Image();
                image.onload = () => resolve(image);
                image.onerror = () => reject(new Error('Desktop image decode failed.'));
                image.src = objectUrl;
              });
            },
          );
          decodeLanesRef.current[lane] = decode.then(
            () => undefined,
            () => undefined,
          );

          drawQueue.current = drawQueue.current
            .then(async () => {
              const canvas = canvasRef.current;
              const screen = screenRef.current;
              let decoded: ImageBitmap | HTMLImageElement | undefined;
              try {
                decoded = await decode;
                if (!canvas || !screen || generation !== generationRef.current) return;
                canvas.getContext('2d')?.drawImage(decoded, tile.x, tile.y);
                if (!readyRef.current) {
                  const left = Math.max(0, tile.x);
                  const top = Math.max(0, tile.y);
                  const right = Math.min(screen.width, tile.x + decoded.width);
                  const bottom = Math.min(screen.height, tile.y + decoded.height);
                  if (right > left && bottom > top)
                    coverageRef.current.push({ left, top, right, bottom });
                  if (unionArea(coverageRef.current) >= screen.width * screen.height) {
                    readyRef.current = true;
                    onReady?.();
                  }
                }
              } finally {
                if (decoded instanceof ImageBitmap) decoded.close();
                if (objectUrl) URL.revokeObjectURL(objectUrl);
              }
            })
            .catch((error: unknown) =>
              onDecodeError?.(
                error instanceof Error ? error : new Error('Desktop image decode failed.'),
              ),
            );
        },
        releaseInput,
      }),
      [onDecodeError, onReady, scale, session],
    );

    const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!session || !mouseEnabled) return;
      const point = pointFromEvent(event);
      if (!point) return;
      pendingMoveRef.current = point;
      if (moveFrameRef.current !== undefined) return;
      moveFrameRef.current = requestAnimationFrame(() => {
        moveFrameRef.current = undefined;
        if (pendingMoveRef.current) session.sendMouseMove(pendingMoveRef.current);
      });
    };

    const handlePointerButton = (
      event: ReactPointerEvent<HTMLCanvasElement>,
      phase: 'down' | 'up',
    ) => {
      if (!session || !mouseEnabled) return;
      const button = mouseButton(event.button);
      const point = pointFromEvent(event);
      if (!button || !point) return;
      event.preventDefault();
      if (phase === 'down') {
        event.currentTarget.focus();
        event.currentTarget.setPointerCapture(event.pointerId);
        pressedButtonsRef.current.add(button);
      } else {
        pressedButtonsRef.current.delete(button);
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId);
      }
      session.sendMouseButton(button, phase, point);
    };

    const handleWheel = (event: ReactWheelEvent<HTMLCanvasElement>) => {
      if (!session || !mouseEnabled) return;
      const point = pointFromEvent(event);
      if (!point) return;
      session.sendMouseWheel(point, event.deltaY < 0 ? 120 : -120);
    };

    const handleKey = (event: ReactKeyboardEvent<HTMLCanvasElement>, phase: 'down' | 'up') => {
      if (!session || !keyboardEnabled || event.nativeEvent.isComposing) return;
      const keyCode = desktopKeyCode(event.nativeEvent);
      if (keyCode === undefined) return;
      event.preventDefault();
      const extended = EXTENDED_KEYS.has(event.code);
      if (phase === 'down') pressedKeysRef.current.set(event.code, { keyCode, extended });
      else pressedKeysRef.current.delete(event.code);
      session.sendKey(keyCode, phase, extended);
    };

    const handleComposition = (event: React.CompositionEvent<HTMLCanvasElement>) => {
      if (!session || !keyboardEnabled) return;
      for (let index = 0; index < event.data.length; index += 1) {
        const codeUnit = event.data.charCodeAt(index);
        session.sendUnicode(codeUnit, 'down');
        session.sendUnicode(codeUnit, 'up');
      }
    };

    return (
      <canvas
        ref={canvasRef}
        className="desktop-canvas"
        aria-label={t('deviceWorkspace.remoteDesktop.canvasLabel')}
        tabIndex={0}
        onPointerMove={handlePointerMove}
        onPointerDown={(event) => handlePointerButton(event, 'down')}
        onPointerUp={(event) => handlePointerButton(event, 'up')}
        onWheel={handleWheel}
        onContextMenu={(event) => {
          if (mouseEnabled) event.preventDefault();
        }}
        onKeyDown={(event) => handleKey(event, 'down')}
        onKeyUp={(event) => handleKey(event, 'up')}
        onBlur={releaseInput}
        onCompositionEnd={handleComposition}
      />
    );
  },
);
