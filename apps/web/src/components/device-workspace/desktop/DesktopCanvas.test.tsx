/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DesktopSession } from '@meshcentral/relay';
import { DesktopCanvas, type DesktopCanvasHandle } from './DesktopCanvas';

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal('PointerEvent', MouseEvent);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    clearRect: vi.fn(),
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) =>
    window.setTimeout(() => cb(0), 0),
  );
  vi.stubGlobal('cancelAnimationFrame', (id: number) => window.clearTimeout(id));
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function setup() {
  const session = {
    state: 'ready',
    sendMouseMove: vi.fn(),
    sendMouseButton: vi.fn(),
    sendMouseWheel: vi.fn(),
    sendKey: vi.fn(),
  };
  const ref = createRef<DesktopCanvasHandle>();
  const view = render(
    <DesktopCanvas
      ref={ref}
      scale="fit"
      session={session as unknown as DesktopSession}
      keyboardEnabled
      mouseEnabled
    />,
  );
  const canvas = view.container.querySelector('canvas')!;
  canvas.getBoundingClientRect = () => ({
    x: 20,
    y: 30,
    left: 20,
    top: 30,
    width: 500,
    height: 250,
    right: 520,
    bottom: 280,
    toJSON() {},
  });
  canvas.setPointerCapture = vi.fn();
  canvas.hasPointerCapture = () => false;
  act(() => ref.current!.setScreen({ width: 1000, height: 500 }));
  return { session, ref, canvas, ...view };
}
describe('DesktopCanvas input coordinates and lifecycle', () => {
  it('releases decoded images from an old screen and paints only the current screen', async () => {
    const pending: Array<(image: ImageBitmap) => void> = [];
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(() => new Promise<ImageBitmap>((resolve) => pending.push(resolve))),
    );
    const s = setup();
    const tile = { x: 0, y: 0, image: new Uint8Array([1]), imageFormat: 'jpeg' as const };
    await act(async () => {
      s.ref.current!.drawTile(tile);
    });
    act(() => s.ref.current!.setScreen({ width: 500, height: 250 }));
    const oldImage = { width: 1000, height: 500, close: vi.fn() } as unknown as ImageBitmap;
    await act(async () => {
      pending[0]!(oldImage);
    });
    expect(oldImage.close).toHaveBeenCalledOnce();
    expect(s.canvas.getContext('2d')!.drawImage).not.toHaveBeenCalled();
    await act(async () => {
      s.ref.current!.drawTile(tile);
    });
    const newImage = { width: 500, height: 250, close: vi.fn() } as unknown as ImageBitmap;
    await act(async () => {
      pending[1]!(newImage);
    });
    act(() => vi.runOnlyPendingTimers());
    expect(s.canvas.getContext('2d')!.drawImage).toHaveBeenCalledOnce();
    expect(newImage.close).toHaveBeenCalledOnce();
    act(() => s.ref.current!.clear());
    expect(s.canvas.width).toBe(0);
  });

  it('maps displayed coordinates to returned dimensions across scaling and clamps edges', () => {
    const s = setup();
    fireEvent.pointerMove(s.canvas, { clientX: 270, clientY: 155 });
    act(() => vi.runOnlyPendingTimers());
    expect(s.session.sendMouseMove).toHaveBeenLastCalledWith({ x: 500, y: 250 });
    act(() => s.ref.current!.setScreen({ width: 500, height: 250 }));
    fireEvent.pointerMove(s.canvas, { clientX: 270, clientY: 155 });
    act(() => vi.runOnlyPendingTimers());
    expect(s.session.sendMouseMove).toHaveBeenLastCalledWith({ x: 250, y: 125 });
    fireEvent.pointerMove(s.canvas, { clientX: -10, clientY: 900 });
    act(() => vi.runOnlyPendingTimers());
    expect(s.session.sendMouseMove).toHaveBeenLastCalledWith({ x: 0, y: 249 });
  });
  it('delivers wheel and releases drag/keys on blur; cancels pending movement on unmount', () => {
    const s = setup();
    fireEvent.pointerDown(s.canvas, { clientX: 270, clientY: 155, button: 0 });
    fireEvent.keyDown(s.canvas, { code: 'KeyA', key: 'a' });
    fireEvent.wheel(s.canvas, { clientX: 270, clientY: 155, deltaY: 100 });
    expect(s.session.sendMouseWheel).toHaveBeenCalledWith({ x: 500, y: 250 }, -120);
    fireEvent.blur(window);
    expect(s.session.sendMouseButton).toHaveBeenLastCalledWith('left', 'up', { x: 500, y: 250 });
    expect(s.session.sendKey).toHaveBeenLastCalledWith(65, 'up', false);
    fireEvent.pointerMove(s.canvas, { clientX: 100, clientY: 100 });
    s.unmount();
    act(() => vi.runOnlyPendingTimers());
    expect(s.session.sendMouseMove).not.toHaveBeenCalled();
  });
});
