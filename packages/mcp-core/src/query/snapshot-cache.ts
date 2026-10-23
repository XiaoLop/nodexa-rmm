export interface SnapshotCacheOptions {
  readonly ttlMs: number;
  readonly now?: () => number;
}

export class SnapshotCache<T> {
  private readonly now: () => number;
  private hasValue = false;
  private value?: T;
  private loadedAt = 0;
  private inflight?: Promise<T>;

  constructor(private readonly options: SnapshotCacheOptions) {
    this.now = options.now ?? Date.now;
  }

  async get(loader: () => Promise<T>): Promise<T> {
    if (this.hasValue && this.now() - this.loadedAt < this.options.ttlMs) {
      return this.value as T;
    }
    if (this.inflight) return this.inflight;

    const inflight = loader().then(
      (value) => {
        this.value = value;
        this.hasValue = true;
        this.loadedAt = this.now();
        if (this.inflight === inflight) this.inflight = undefined;
        return value;
      },
      (error: unknown) => {
        if (this.inflight === inflight) this.inflight = undefined;
        throw error;
      },
    );

    this.inflight = inflight;
    return inflight;
  }

  peek(): T | undefined {
    return this.hasValue ? this.value : undefined;
  }

  invalidate(): void {
    this.hasValue = false;
    this.value = undefined;
    this.loadedAt = 0;
  }
}
