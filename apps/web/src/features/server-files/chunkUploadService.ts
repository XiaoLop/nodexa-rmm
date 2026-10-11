export interface ChunkUploadProgress {
  phase: 'hashing' | 'uploading' | 'merging' | 'completed';
  percent: number;
  uploadedBytes: number;
  totalBytes: number;
  currentChunk: number;
  totalChunks: number;
  isExisting?: boolean;
  concurrency?: number;
}

export interface ChunkUploadOptions {
  chunkSize?: number;
  initialConcurrency?: number;
  maxConcurrency?: number;
  minConcurrency?: number;
  targetDurationMs?: number;
}

export const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB
export const DEFAULT_MAX_CONCURRENCY = 6;
export const DEFAULT_TARGET_DURATION_MS = 5000; // 5 秒阈值

export async function calculateFileHash(file: File): Promise<string> {
  // 采样哈希策略：取首尾各 2MB + 文件属性，几毫秒内完成且不消耗大内存
  const sampleSize = 2 * 1024 * 1024;
  const chunks: Blob[] = [file.slice(0, Math.min(file.size, sampleSize))];
  if (file.size > sampleSize * 2) {
    const mid = Math.floor(file.size / 2);
    chunks.push(file.slice(mid, mid + sampleSize));
    chunks.push(file.slice(file.size - sampleSize));
  }
  const metaString = `${file.name}_${file.size}_${file.lastModified}`;
  chunks.push(new Blob([metaString]));

  const arrayBuffer = await new Blob(chunks).arrayBuffer();
  const digestBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hex = Array.from(new Uint8Array(digestBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${hex.slice(0, 32)}_${file.size}`;
}

export async function uploadFileInChunks(
  file: File,
  spaceId: string,
  pathSegments: string[],
  onProgress?: (progress: ChunkUploadProgress) => void,
  signal?: AbortSignal,
  options?: ChunkUploadOptions,
): Promise<{ success: boolean; isExisting?: boolean }> {
  const effectiveChunkSize = options?.chunkSize ?? CHUNK_SIZE;
  const totalChunks = Math.max(1, Math.ceil(file.size / effectiveChunkSize));

  onProgress?.({
    phase: 'hashing',
    percent: 0,
    uploadedBytes: 0,
    totalBytes: file.size,
    currentChunk: 0,
    totalChunks,
  });

  const fileHash = await calculateFileHash(file);

  // 1. 状态预检（采用 GET 请求，参数经由 URLSearchParams 传递，天然不受 body-parser 限制）
  const searchParams = new URLSearchParams({
    fileHash,
    spaceId,
    fileName: file.name,
    fileSize: String(file.size),
    path: pathSegments.join('/'),
  });

  const statusRes = await fetch(`/api/chunkuploader/status?${searchParams.toString()}`, {
    method: 'GET',
    signal,
  });

  if (!statusRes.ok) {
    const err = (await statusRes.json().catch(() => ({}))) as { message?: string };
    throw new Error(err.message || 'Status check failed');
  }

  const statusData = (await statusRes.json()) as {
    isExisting?: boolean;
    uploadedChunks?: number[];
  };

  if (statusData.isExisting) {
    onProgress?.({
      phase: 'completed',
      percent: 100,
      uploadedBytes: file.size,
      totalBytes: file.size,
      currentChunk: totalChunks,
      totalChunks,
      isExisting: true,
    });
    return { success: true, isExisting: true };
  }

  const uploadedSet = new Set<number>(statusData.uploadedChunks ?? []);

  // 2. 准备切片队列与进度状态
  const pendingChunkIndices: number[] = [];
  let initialUploadedBytes = 0;
  for (let i = 0; i < totalChunks; i++) {
    const start = i * effectiveChunkSize;
    const end = Math.min(file.size, start + effectiveChunkSize);
    const size = end - start;
    if (uploadedSet.has(i)) {
      initialUploadedBytes += size;
    } else {
      pendingChunkIndices.push(i);
    }
  }

  let currentConcurrency = Math.max(1, options?.initialConcurrency ?? 1);
  const maxConcurrency = Math.max(1, options?.maxConcurrency ?? DEFAULT_MAX_CONCURRENCY);
  const minConcurrency = Math.max(1, options?.minConcurrency ?? 1);
  const targetDurationMs = options?.targetDurationMs ?? DEFAULT_TARGET_DURATION_MS;

  let completedChunksCount = totalChunks - pendingChunkIndices.length;
  let uploadedBytes = initialUploadedBytes;

  const emitProgress = (phase: ChunkUploadProgress['phase'] = 'uploading') => {
    const percent = Math.min(100, Math.round((uploadedBytes / file.size) * 100));
    onProgress?.({
      phase,
      percent,
      uploadedBytes,
      totalBytes: file.size,
      currentChunk: completedChunksCount,
      totalChunks,
      concurrency: currentConcurrency,
    });
  };

  emitProgress('uploading');

  // 3. 动态自适应并发上传切片
  let queuePointer = 0;
  while (queuePointer < pendingChunkIndices.length) {
    if (signal?.aborted) throw new Error('Upload aborted');

    // 动态提取本批待上传切片（受限于当前并发度和剩余分片）
    const batchChunkIndices = pendingChunkIndices.slice(
      queuePointer,
      queuePointer + currentConcurrency,
    );
    queuePointer += batchChunkIndices.length;

    const batchStartTime = performance.now();

    // 并发上传当前批次
    await Promise.all(
      batchChunkIndices.map(async (chunkIndex) => {
        if (signal?.aborted) throw new Error('Upload aborted');
        const start = chunkIndex * effectiveChunkSize;
        const end = Math.min(file.size, start + effectiveChunkSize);
        const chunkSize = end - start;
        const chunkBlob = file.slice(start, end);
        const chunkBuffer = await chunkBlob.arrayBuffer();

        const uploadUrl = `/api/chunkuploader/chunk?fileHash=${encodeURIComponent(
          fileHash,
        )}&chunkIndex=${chunkIndex}&spaceId=${encodeURIComponent(spaceId)}`;

        const chunkRes = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: chunkBuffer,
          signal,
        });

        if (!chunkRes.ok) {
          const err = (await chunkRes.json().catch(() => ({}))) as { message?: string };
          throw new Error(err.message || `Chunk ${chunkIndex} upload failed`);
        }

        // 单切片完成后立即推进进度
        uploadedBytes += chunkSize;
        completedChunksCount += 1;
        emitProgress('uploading');
      }),
    );

    const batchDurationMs = performance.now() - batchStartTime;

    // 自适应调整并发度：
    // 若本批次在 5 秒（targetDurationMs）内完成，且仍有待上传分片，则并发度 +1
    if (batchDurationMs <= targetDurationMs) {
      currentConcurrency = Math.min(maxConcurrency, currentConcurrency + 1);
    } else {
      // 耗时超过 5 秒，则退回 / 降级并发度，但不能低于 minConcurrency
      currentConcurrency = Math.max(minConcurrency, currentConcurrency - 1);
    }
  }

  // 4. 服务端流式合并
  onProgress?.({
    phase: 'merging',
    percent: 100,
    uploadedBytes: file.size,
    totalBytes: file.size,
    currentChunk: totalChunks,
    totalChunks,
    concurrency: currentConcurrency,
  });

  const mergeRes = await fetch('/api/chunkuploader/merge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileHash,
      fileName: file.name,
      fileSize: file.size,
      totalChunks,
      spaceId,
      path: pathSegments,
    }),
    signal,
  });

  if (!mergeRes.ok) {
    const err = (await mergeRes.json().catch(() => ({}))) as { message?: string };
    throw new Error(err.message || 'File merge failed');
  }

  onProgress?.({
    phase: 'completed',
    percent: 100,
    uploadedBytes: file.size,
    totalBytes: file.size,
    currentChunk: totalChunks,
    totalChunks,
  });

  return { success: true };
}
