import { describe, expect, it } from 'vitest';
import {
  calculateBatchUploadChunkSize,
  readBatchUploadBandwidthConfig,
} from './bandwidth';

describe('batch upload bandwidth configuration', () => {
  it('calculates a fair chunk size from total bandwidth and concurrency', () => {
    const config = readBatchUploadBandwidthConfig({
      VITE_BATCH_UPLOAD_BANDWIDTH_MBPS: '200',
      VITE_BATCH_UPLOAD_CHUNK_INTERVAL_MS: '150',
      VITE_BATCH_UPLOAD_MIN_CHUNK_KIB: '256',
      VITE_BATCH_UPLOAD_MAX_CHUNK_KIB: '5120',
    });

    expect(calculateBatchUploadChunkSize(config, 1)).toBe(3_750_000);
    expect(calculateBatchUploadChunkSize(config, 2)).toBe(1_875_000);
    expect(calculateBatchUploadChunkSize(config, 4)).toBe(937_500);
    expect(calculateBatchUploadChunkSize(config, 8)).toBe(468_750);
  });

  it('uses safe defaults and clamps calculated chunk sizes', () => {
    const defaults = readBatchUploadBandwidthConfig({
      VITE_BATCH_UPLOAD_BANDWIDTH_MBPS: 'invalid',
      VITE_BATCH_UPLOAD_MIN_CHUNK_KIB: '512',
      VITE_BATCH_UPLOAD_MAX_CHUNK_KIB: '256',
    });

    expect(defaults.bandwidthMbps).toBe(200);
    expect(defaults.maxChunkBytes).toBe(defaults.minChunkBytes);
    expect(calculateBatchUploadChunkSize(defaults, 100)).toBe(512 * 1024);
  });
});
