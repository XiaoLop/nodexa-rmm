import type { DesktopTile } from '@meshcentral/relay';

export interface DesktopRenderStats {
  pendingTiles: number;
  pendingBytes: number;
  decodedTiles: number;
  drawBatches: number;
  drawnTiles: number;
  decodeMs: number;
  waitMs: number;
  waitP95Ms: number;
}
interface DecodedImage {
  width: number;
  height: number;
  close?: () => void;
}
interface Task<T> {
  tile: DesktopTile;
  queuedAt: number;
  decoded?: T;
}
/** Ordered incremental tiles: never discard live-generation updates. */
export class DesktopRenderQueue<T extends DecodedImage> {
  private tasks: Task<T>[] = [];
  private active = 0;
  private nextDecode = 0;
  private waits: number[] = [];
  private frame?: number;
  private stopped = false;
  private statsValue: DesktopRenderStats = {
    pendingTiles: 0,
    pendingBytes: 0,
    decodedTiles: 0,
    drawBatches: 0,
    drawnTiles: 0,
    decodeMs: 0,
    waitMs: 0,
    waitP95Ms: 0,
  };
  constructor(
    private readonly hooks: {
      decode(tile: DesktopTile): Promise<T>;
      draw(image: T, tile: DesktopTile): void;
      error(error: Error): void;
      overflow(): void;
      now?: () => number;
      requestFrame?: (callback: () => void) => number;
      cancelFrame?: (id: number) => void;
    },
  ) {}
  get stats(): DesktopRenderStats {
    const sorted = [...this.waits].sort((a, b) => a - b);
    return {
      ...this.statsValue,
      waitP95Ms: sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)] ?? 0,
    };
  }
  private now(): number {
    return this.hooks.now?.() ?? performance.now();
  }
  enqueue(tile: DesktopTile): void {
    if (this.stopped) return;
    if (this.statsValue.pendingBytes + tile.image.byteLength > 8 * 1024 * 1024) {
      this.dispose();
      this.hooks.overflow();
      return;
    }
    this.tasks.push({ tile, queuedAt: this.now() });
    this.statsValue.pendingTiles++;
    this.statsValue.pendingBytes += tile.image.byteLength;
    this.pump();
  }
  dispose(): void {
    this.stopped = true;
    if (this.frame !== undefined) (this.hooks.cancelFrame ?? cancelAnimationFrame)(this.frame);
    this.frame = undefined;
    for (const task of this.tasks) task.decoded?.close?.();
    this.tasks = [];
    this.nextDecode = 0;
    this.statsValue.pendingTiles = 0;
    this.statsValue.pendingBytes = 0;
  }
  private pump(): void {
    while (this.active < 3 && !this.stopped && this.nextDecode < this.tasks.length) {
      const task = this.tasks[this.nextDecode++]!;
      this.active++;
      const start = this.now();
      void Promise.resolve()
        .then(() => this.hooks.decode(task.tile))
        .then((image) => {
          if (this.stopped) {
            image.close?.();
            return;
          }
          task.decoded = image;
          this.statsValue.decodedTiles++;
          this.statsValue.decodeMs += this.now() - start;
          if (this.frame === undefined) {
            this.frame = (this.hooks.requestFrame ?? requestAnimationFrame)(() => this.flush());
          }
        })
        .catch((error: unknown) => {
          if (this.stopped) return;
          this.dispose();
          this.hooks.error(
            error instanceof Error ? error : new Error('Desktop image decode failed.'),
          );
        })
        .finally(() => {
          this.active--;
          this.pump();
        });
    }
  }
  private flush(): void {
    this.frame = undefined;
    if (this.stopped) return;
    let count = 0;
    try {
      while (this.tasks[0]?.decoded) {
        const task = this.tasks.shift()!;
        this.nextDecode--;
        const image = task.decoded!;
        try {
          this.hooks.draw(image, task.tile);
          const wait = this.now() - task.queuedAt;
          this.statsValue.waitMs += wait;
          this.waits.push(wait);
          if (this.waits.length > 2048) this.waits.shift();
          this.statsValue.pendingTiles--;
          this.statsValue.pendingBytes -= task.tile.image.byteLength;
          count++;
          this.statsValue.drawnTiles++;
        } finally {
          image.close?.();
        }
      }
      if (count) this.statsValue.drawBatches++;
    } catch (error) {
      this.dispose();
      this.hooks.error(error instanceof Error ? error : new Error('Desktop drawing failed.'));
    }
  }
}
