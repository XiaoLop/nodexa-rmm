import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BatchUploadManager,
  calculateFileHash,
  uploadFileInChunks,
  type BatchUploadItem,
  type BatchUploadSummary,
  type ChunkUploadProgress,
} from './chunkUploadService';

describe('chunkUploadService dynamic concurrency', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calculates deterministic sampling hash', async () => {
    const file = new File(['hello world'], 'test.txt', {
      type: 'text/plain',
      lastModified: 1700000000000,
    });
    const hash = await calculateFileHash(file);
    expect(typeof hash).toBe('string');
    expect(hash).toContain('_11');
  });

  it('adapts concurrency dynamically based on 5s batch completion time', async () => {
    // 构造一个 5 个切片的文件（每个切片 10 字节，总共 50 字节）
    const fileContent = 'A'.repeat(50);
    const file = new File([fileContent], 'large.bin', {
      type: 'application/octet-stream',
      lastModified: 1700000000000,
    });

    const recordedConcurrencies: number[] = [];
    const progressList: ChunkUploadProgress[] = [];

    // Mock fetch - 模拟在 targetDurationMs 内完成
    globalThis.fetch = vi.fn().mockImplementation((url: string | URL) => {
      const urlStr = String(url);

      // Status check
      if (urlStr.includes('/api/chunkuploader/status')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ isExisting: false, uploadedChunks: [] }),
        });
      }

      // Chunk upload (快速完成，在 targetDurationMs 内)
      if (urlStr.includes('/api/chunkuploader/chunk')) {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: () => Promise.resolve({ success: true }),
            });
          }, 5);
        });
      }

      // Merge
      if (urlStr.includes('/api/chunkuploader/merge')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });
      }

      return Promise.reject(new Error(`Unhandled url: ${urlStr}`));
    }) as unknown as typeof fetch;

    const result = await uploadFileInChunks(
      file,
      'user//alice',
      ['folder'],
      (p) => {
        progressList.push(p);
        if (p.concurrency) {
          recordedConcurrencies.push(p.concurrency);
        }
      },
      undefined,
      {
        chunkSize: 10, // 每个切片 10 字节，一共 5 块
        initialConcurrency: 1,
        maxConcurrency: 4,
        targetDurationMs: 50, // 设为 50ms 方便单元测试快速验证
      },
    );

    expect(result.success).toBe(true);
    expect(progressList.some((p) => p.phase === 'completed')).toBe(true);

    // 观察并发度提升：初始为 1，第 1 批完成后提升到 2
    expect(recordedConcurrencies).toContain(1);
    expect(recordedConcurrencies).toContain(2);
  });

  it('backs off concurrency when batch duration exceeds target threshold', async () => {
    // 构造一个 6 个切片的文件（每个切片 10 字节）
    const fileContent = 'B'.repeat(60);
    const file = new File([fileContent], 'slow.bin', {
      type: 'application/octet-stream',
      lastModified: 1700000000000,
    });

    const observedConcurrencies: number[] = [];

    // 模拟批次 1 超时 (> 50ms)
    let call = 0;
    globalThis.fetch = vi.fn().mockImplementation((url: string | URL) => {
      const urlStr = String(url);
      if (urlStr.includes('/status')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ isExisting: false, uploadedChunks: [] }),
        });
      }
      if (urlStr.includes('/chunk')) {
        call++;
        // 前两个分片（批次 1，初始并发 2）模拟耗时 100ms > 阈值 50ms
        const delay = call <= 2 ? 100 : 10;
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: () => Promise.resolve({ success: true }),
            });
          }, delay);
        });
      }
      if (urlStr.includes('/merge')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });
      }
      return Promise.reject(new Error(`Unhandled: ${urlStr}`));
    }) as unknown as typeof fetch;

    await uploadFileInChunks(
      file,
      'user//alice',
      [],
      (p) => {
        if (p.concurrency) observedConcurrencies.push(p.concurrency);
      },
      undefined,
      {
        chunkSize: 10,
        initialConcurrency: 2, // 初始为 2
        maxConcurrency: 4,
        minConcurrency: 1,
        targetDurationMs: 50, // 设小阈值以快速触发降速测试
      },
    );

    // 初始批次并发为 2，超时后降回 1
    expect(observedConcurrencies[0]).toBe(2);
    expect(observedConcurrencies).toContain(1);
  });

  describe('BatchUploadManager', () => {
    it('manages queue with active concurrency limit and calculates summary', async () => {
      globalThis.fetch = vi.fn().mockImplementation((url: string | URL) => {
        const urlStr = String(url);
        if (urlStr.includes('/status')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ isExisting: false, uploadedChunks: [] }),
          });
        }
        if (urlStr.includes('/chunk')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true }),
          });
        }
        if (urlStr.includes('/merge')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true }),
          });
        }
        return Promise.reject(new Error(`Unhandled: ${urlStr}`));
      }) as unknown as typeof fetch;

      const file1 = new File(['content1'], 'file1.txt', { type: 'text/plain' });
      const file2 = new File(['content2'], 'file2.txt', { type: 'text/plain' });
      const file3 = new File(['content3'], 'file3.txt', { type: 'text/plain' });

      let finalSummary: BatchUploadSummary | undefined;
      const completedFiles: string[] = [];

      await new Promise<void>((resolve) => {
        const manager = new BatchUploadManager('user//alice', ['test'], {
          maxActiveFiles: 2,
          chunkSize: 1024,
          onFileCompleted: (item: BatchUploadItem) => {
            completedFiles.push(item.file.name);
          },
          onAllCompleted: (summary) => {
            finalSummary = summary;
            resolve();
          },
        });

        manager.addFiles([file1, file2, file3]);
      });

      expect([...completedFiles].sort()).toEqual(['file1.txt', 'file2.txt', 'file3.txt']);
      expect(finalSummary).toBeDefined();
      expect(finalSummary?.totalFiles).toBe(3);
      expect(finalSummary?.completedFiles).toBe(3);
      expect(finalSummary?.failedFiles).toBe(0);
      expect(finalSummary?.overallPercent).toBe(100);
    });

    it('isolates errors and continues processing remaining queued files', async () => {
      globalThis.fetch = vi.fn().mockImplementation((url: string | URL) => {
        const urlStr = String(url);
        if (urlStr.includes('/status')) {
          if (urlStr.includes('badfile.txt')) {
            return Promise.resolve({
              ok: false,
              json: () => Promise.resolve({ message: 'Disk full' }),
            });
          }
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ isExisting: false, uploadedChunks: [] }),
          });
        }
        if (urlStr.includes('/chunk')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true }),
          });
        }
        if (urlStr.includes('/merge')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true }),
          });
        }
        return Promise.reject(new Error(`Unhandled: ${urlStr}`));
      }) as unknown as typeof fetch;

      const goodFile1 = new File(['good1'], 'good1.txt', { type: 'text/plain' });
      const badFile = new File(['bad'], 'badfile.txt', { type: 'text/plain' });
      const goodFile2 = new File(['good2'], 'good2.txt', { type: 'text/plain' });

      let finalSummary: BatchUploadSummary | undefined;

      await new Promise<void>((resolve) => {
        const manager = new BatchUploadManager('user//alice', [], {
          maxActiveFiles: 1,
          chunkSize: 1024,
          onAllCompleted: (summary) => {
            finalSummary = summary;
            resolve();
          },
        });

        manager.addFiles([goodFile1, badFile, goodFile2]);
      });

      expect(finalSummary?.totalFiles).toBe(3);
      expect(finalSummary?.completedFiles).toBe(2);
      expect(finalSummary?.failedFiles).toBe(1);
    });

    it('passes subPath segments when uploading nested folder items', async () => {
      const fetchMock = vi.fn().mockImplementation((url: string | URL) => {
        const urlStr = String(url);
        if (urlStr.includes('/status')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ isExisting: false, uploadedChunks: [] }),
          });
        }
        if (urlStr.includes('/chunk')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true }),
          });
        }
        if (urlStr.includes('/merge')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true }),
          });
        }
        return Promise.reject(new Error(`Unhandled: ${urlStr}`));
      });
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      const file = new File(['sub'], 'subfile.txt', { type: 'text/plain' });

      await new Promise<void>((resolve) => {
        const manager = new BatchUploadManager('user//alice', ['base', 'folder'], {
          maxActiveFiles: 1,
          chunkSize: 1024,
          onAllCompleted: () => resolve(),
        });

        manager.addFiles([
          {
            file,
            subPath: ['deep', 'dir'],
            relativePath: 'deep/dir/subfile.txt',
          },
        ]);
      });

      const mergeCall = fetchMock.mock.calls.find((call) =>
        String(call[0]).includes('/merge'),
      );
      expect(mergeCall).toBeDefined();

      const mergeInit = mergeCall?.[1] as RequestInit | undefined;
      const parsedBody = JSON.parse(String(mergeInit?.body)) as { path?: string[] };
      expect(parsedBody.path).toEqual(['base', 'folder', 'deep', 'dir']);
    });
  });
});
