export interface BatchUploadBandwidthConfig {
  bandwidthMbps: number;
  chunkIntervalMs: number;
  minChunkBytes: number;
  maxChunkBytes: number;
}

const DEFAULT_BANDWIDTH_MBPS = 200;
const DEFAULT_CHUNK_INTERVAL_MS = 150;
const DEFAULT_MIN_CHUNK_KIB = 256;
const DEFAULT_MAX_CHUNK_KIB = 5120;

function positiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function readBatchUploadBandwidthConfig(
  env: Record<string, string | boolean | undefined>,
): BatchUploadBandwidthConfig {
  const bandwidthMbps = positiveNumber(
    typeof env.VITE_BATCH_UPLOAD_BANDWIDTH_MBPS === 'string'
      ? env.VITE_BATCH_UPLOAD_BANDWIDTH_MBPS
      : undefined,
    DEFAULT_BANDWIDTH_MBPS,
  );
  const chunkIntervalMs = positiveNumber(
    typeof env.VITE_BATCH_UPLOAD_CHUNK_INTERVAL_MS === 'string'
      ? env.VITE_BATCH_UPLOAD_CHUNK_INTERVAL_MS
      : undefined,
    DEFAULT_CHUNK_INTERVAL_MS,
  );
  const minChunkBytes =
    positiveNumber(
      typeof env.VITE_BATCH_UPLOAD_MIN_CHUNK_KIB === 'string'
        ? env.VITE_BATCH_UPLOAD_MIN_CHUNK_KIB
        : undefined,
      DEFAULT_MIN_CHUNK_KIB,
    ) * 1024;
  const configuredMaxChunkBytes =
    positiveNumber(
      typeof env.VITE_BATCH_UPLOAD_MAX_CHUNK_KIB === 'string'
        ? env.VITE_BATCH_UPLOAD_MAX_CHUNK_KIB
        : undefined,
      DEFAULT_MAX_CHUNK_KIB,
    ) * 1024;

  return {
    bandwidthMbps,
    chunkIntervalMs,
    minChunkBytes,
    maxChunkBytes: Math.max(minChunkBytes, configuredMaxChunkBytes),
  };
}

export function calculateBatchUploadChunkSize(
  config: BatchUploadBandwidthConfig,
  concurrentUploads: number,
): number {
  const uploadCount = Math.max(1, Math.floor(concurrentUploads));
  const totalBytesPerSecond = (config.bandwidthMbps * 1_000_000) / 8;
  const calculatedBytes =
    (totalBytesPerSecond * config.chunkIntervalMs) / 1000 / uploadCount;
  const clampedBytes = Math.min(
    config.maxChunkBytes,
    Math.max(config.minChunkBytes, calculatedBytes),
  );

  return Math.max(1, Math.round(clampedBytes));
}

export const batchUploadBandwidthConfig = readBatchUploadBandwidthConfig(import.meta.env);
