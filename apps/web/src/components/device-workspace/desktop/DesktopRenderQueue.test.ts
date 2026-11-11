import { describe, expect, it, vi } from 'vitest';
import type { DesktopTile } from '@meshcentral/relay';
import { DesktopRenderQueue } from './DesktopRenderQueue';
const tile = (x: number, bytes = 1): DesktopTile => ({
  x,
  y: 0,
  image: new Uint8Array(bytes),
  imageFormat: 'jpeg',
});
function setup() {
  const pending: Array<{
    resolve: (image: { width: number; height: number; close: () => void }) => void;
    reject: (error: Error) => void;
  }> = [];
  const frames = new Map<number, () => void>();
  const draw = vi.fn(),
    error = vi.fn(),
    overflow = vi.fn();
  const decode = vi.fn(
    () =>
      new Promise<{ width: number; height: number; close: () => void }>((resolve, reject) =>
        pending.push({ resolve, reject }),
      ),
  );
  let id = 0,
    now = 0;
  const queue = new DesktopRenderQueue({
    decode,
    draw,
    error,
    overflow,
    now: () => now,
    requestFrame: (cb) => {
      frames.set(++id, cb);
      return id;
    },
    cancelFrame: (n) => {
      frames.delete(n);
    },
  });
  const image = () => ({ width: 10, height: 10, close: vi.fn() });
  const flush = () => {
    for (const [key, cb] of [...frames]) {
      frames.delete(key);
      cb();
    }
  };
  return {
    queue,
    pending,
    draw,
    decode,
    frames,
    error,
    overflow,
    image,
    flush,
    time: (value: number) => {
      now = value;
    },
  };
}
const settle = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
describe('DesktopRenderQueue', () => {
  it('limits decode concurrency and draws out-of-order completions in protocol order', async () => {
    const s = setup();
    for (let i = 0; i < 5; i++) s.queue.enqueue(tile(i));
    await settle();
    expect(s.decode).toHaveBeenCalledTimes(3);
    s.pending[1]!.resolve(s.image());
    await settle();
    s.flush();
    expect(s.draw).not.toHaveBeenCalled();
    expect(s.decode).toHaveBeenCalledTimes(4);
    s.pending[0]!.resolve(s.image());
    await settle();
    s.time(25);
    s.flush();
    expect(s.draw.mock.calls.map((call) => call[1].x)).toEqual([0, 1]);
    expect(s.queue.stats).toMatchObject({
      pendingTiles: 3,
      pendingBytes: 3,
      drawnTiles: 2,
      drawBatches: 1,
      waitP95Ms: 25,
    });
    s.queue.dispose();
  });
  it('cancels waiting work and releases late images without drawing into a new generation', async () => {
    const s = setup();
    for (let i = 0; i < 4; i++) s.queue.enqueue(tile(i));
    await settle();
    const first = s.image();
    s.pending[0]!.resolve(first);
    await settle();
    s.queue.dispose();
    expect(first.close).toHaveBeenCalledOnce();
    expect(s.frames.size).toBe(0);
    const late = s.image();
    s.pending[1]!.resolve(late);
    await settle();
    s.flush();
    expect(late.close).toHaveBeenCalledOnce();
    expect(s.draw).not.toHaveBeenCalled();
    expect(s.queue.stats.pendingBytes).toBe(0);
    const next = setup();
    next.queue.enqueue(tile(7));
    await settle();
    next.pending[0]!.resolve(next.image());
    await settle();
    next.flush();
    expect(next.draw.mock.calls[0]![1].x).toBe(7);
    next.queue.dispose();
  });
  it('ends the queue on decode failure without an unhandled rejection', async () => {
    const s = setup();
    s.queue.enqueue(tile(0));
    await settle();
    s.pending[0]!.reject(new Error('bad image'));
    await settle();
    expect(s.error).toHaveBeenCalledOnce();
    expect(s.queue.stats.pendingTiles).toBe(0);
    s.queue.enqueue(tile(1));
    await settle();
    expect(s.decode).toHaveBeenCalledTimes(1);
  });
  it('allows exactly 8 MiB then stops without silently dropping live tiles', async () => {
    const s = setup();
    s.queue.enqueue(tile(0, 8 * 1024 * 1024));
    expect(s.overflow).not.toHaveBeenCalled();
    s.queue.enqueue(tile(1));
    expect(s.overflow).toHaveBeenCalledOnce();
    expect(s.queue.stats.pendingBytes).toBe(0);
    await settle();
    s.pending[0]!.resolve(s.image());
    await settle();
    expect(s.draw).not.toHaveBeenCalled();
  });
  it('releases images and terminates when drawing fails', async () => {
    const s = setup();
    s.draw.mockImplementation(() => {
      throw new Error('canvas lost');
    });
    s.queue.enqueue(tile(0));
    await settle();
    const image = s.image();
    s.pending[0]!.resolve(image);
    await settle();
    s.flush();
    expect(image.close).toHaveBeenCalledOnce();
    expect(s.error).toHaveBeenCalledOnce();
  });
});
