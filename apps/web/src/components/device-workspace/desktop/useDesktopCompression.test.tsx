/** @vitest-environment jsdom */
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDesktopCompression } from './useDesktopCompression';
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
describe('desktop compression scheduling', () => {
  it('debounces encoding changes and ignores display-only rerenders', () => {
    vi.useFakeTimers();
    const session = { setCompression: vi.fn() },
      error = vi.fn();
    const { rerender, unmount } = renderHook(
      ({ quality, scale }) => {
        void scale;
        useDesktopCompression(
          session,
          true,
          { quality, frameTimer: 50, imageFormat: 'webp' },
          error,
        );
      },
      { initialProps: { quality: 45, scale: 'fit' } },
    );
    act(() => vi.advanceTimersByTime(100));
    rerender({ quality: 50, scale: 'fit' });
    act(() => vi.advanceTimersByTime(149));
    expect(session.setCompression).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(session.setCompression).toHaveBeenCalledWith({
      imageFormat: 'webp',
      quality: 50,
      frameTimer: 50,
      scaling: 1024,
    });
    rerender({ quality: 50, scale: '75' });
    act(() => vi.advanceTimersByTime(150));
    expect(session.setCompression).toHaveBeenCalledTimes(1);
    rerender({ quality: 75, scale: 'fit' });
    unmount();
    act(() => vi.advanceTimersByTime(150));
    expect(session.setCompression).toHaveBeenCalledTimes(1);
  });
  it('waits for the screen and reports transport failure', () => {
    vi.useFakeTimers();
    const error = vi.fn();
    const session = {
      setCompression: vi.fn(() => {
        throw new Error('closed');
      }),
    };
    const { rerender } = renderHook(
      ({ ready }) => useDesktopCompression(session, ready, { quality: 58 }, error),
      { initialProps: { ready: false } },
    );
    act(() => vi.advanceTimersByTime(150));
    expect(session.setCompression).not.toHaveBeenCalled();
    rerender({ ready: true });
    act(() => vi.advanceTimersByTime(150));
    expect(error).toHaveBeenCalledOnce();
  });
});
