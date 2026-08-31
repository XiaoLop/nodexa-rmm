import { describe, expect, it } from 'vitest';
import {
  summarizeBatchUpload,
  validateTargetDirectory,
  validateTargetFileName,
  type BatchUploadTask,
} from './types';

function task(overrides: Partial<BatchUploadTask>): BatchUploadTask {
  return {
    id: 'task',
    batchId: 'batch',
    device: { id: 'node', name: 'Node', online: true },
    status: 'queued',
    totalBytes: 100,
    sentBytes: 0,
    acknowledgedBytes: 0,
    percentage: 0,
    retryCount: 0,
    ...overrides,
  };
}

describe('batch upload validation', () => {
  it('rejects unsafe target paths and file names', () => {
    expect(validateTargetDirectory('../tmp')).toContain('父目录');
    expect(validateTargetDirectory('/tmp')).toBeUndefined();
    expect(validateTargetFileName('../file.txt')).toContain('单个安全文件名');
    expect(validateTargetFileName('file.txt')).toBeUndefined();
  });
});

describe('summarizeBatchUpload', () => {
  it('counts states and excludes skipped tasks from byte progress', () => {
    const summary = summarizeBatchUpload([
      task({ id: 'success', status: 'success', acknowledgedBytes: 100, percentage: 100 }),
      task({ id: 'uploading', status: 'uploading', acknowledgedBytes: 50, percentage: 50 }),
      task({ id: 'skipped', status: 'skipped', acknowledgedBytes: 0 }),
      task({ id: 'failed', status: 'failed', acknowledgedBytes: 25 }),
    ]);

    expect(summary).toMatchObject({
      total: 4,
      active: 1,
      success: 1,
      skipped: 1,
      failed: 1,
      acknowledgedBytes: 175,
      totalUploadBytes: 300,
    });
    expect(summary.percentage).toBeCloseTo(58.333, 2);
  });
});
