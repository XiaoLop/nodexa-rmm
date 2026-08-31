/// <reference lib="webworker" />

import {
  FileOperationError,
  FilesSession,
  RELAY_PROTOCOLS,
  RelayClient,
  browserFileSource,
  type RelayControlChannel,
  type RelaySession,
} from '@meshcentral/relay';
import type { BatchUploadConfig, BatchUploadDeviceSnapshot, BatchUploadTaskStatus } from './types';

interface RunMessage {
  type: 'run';
  taskId: string;
  device: BatchUploadDeviceSnapshot;
  config: BatchUploadConfig;
  baseUrl: string;
  chunkSize: number;
}

interface CancelMessage {
  type: 'cancel';
  taskId: string;
}

interface ShutdownMessage {
  type: 'shutdown';
}

interface RpcSuccessMessage {
  type: 'rpc-result';
  requestId: string;
  result: unknown;
}

interface RpcFailureMessage {
  type: 'rpc-error';
  requestId: string;
  error: string;
}

type MainMessage = RunMessage | CancelMessage | ShutdownMessage | RpcSuccessMessage | RpcFailureMessage;

type WorkerOutboundMessage =
  | { type: 'ready' }
  | { type: 'control-request'; requestId: string; payload: Record<string, unknown>; timeoutMs?: number }
  | { type: 'control-send'; requestId: string; payload: unknown }
  | { type: 'status'; taskId: string; status: BatchUploadTaskStatus; detail?: string }
  | {
      type: 'progress';
      taskId: string;
      sentBytes: number;
      acknowledgedBytes: number;
      totalBytes: number;
      percentage: number;
    }
  | { type: 'completed'; taskId: string; result: 'success' | 'skipped'; detail?: string }
  | { type: 'failed'; taskId: string; errorCode: string; error: string }
  | { type: 'cancelled'; taskId: string };

interface PendingRpc {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

const workerScope = self as DedicatedWorkerGlobalScope;
const pendingRpc = new Map<string, PendingRpc>();
let rpcSequence = 0;
let currentTaskId: string | undefined;
let currentAbort: AbortController | undefined;
let currentFiles: FilesSession | undefined;
let currentRelay: RelaySession | undefined;
let lastProgressAt = 0;

function post(message: WorkerOutboundMessage): void {
  workerScope.postMessage(message);
}

const control: RelayControlChannel = {
  request<T = unknown>(payload: Record<string, unknown>, timeoutMs?: number): Promise<T> {
    const requestId = `rpc-${Date.now().toString(36)}-${++rpcSequence}`;
    return new Promise<T>((resolve, reject) => {
      pendingRpc.set(requestId, {
        resolve: (value) => resolve(value as T),
        reject,
      });
      post({ type: 'control-request', requestId, payload, timeoutMs });
    });
  },
  send(payload: unknown): void {
    const requestId = `rpc-${Date.now().toString(36)}-${++rpcSequence}`;
    post({ type: 'control-send', requestId, payload });
  },
};

function updateStatus(taskId: string, status: BatchUploadTaskStatus, detail?: string): void {
  post({ type: 'status', taskId, status, detail });
}

function findExistingFile(files: FilesSession, path: string, fileName: string, signal: AbortSignal) {
  return files
    .listDirectory(path, { signal, timeoutMs: 20_000 })
    .then((listing) => listing.entries.find((entry) => entry.kind === 'file' && entry.name === fileName));
}

function errorCode(error: unknown): string {
  if (error instanceof FileOperationError) return error.code;
  if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
  return 'unknown';
}

async function runTask(message: RunMessage): Promise<void> {
  if (currentTaskId) {
    post({ type: 'failed', taskId: message.taskId, errorCode: 'worker-busy', error: '上传 Worker 正忙。' });
    return;
  }

  currentTaskId = message.taskId;
  currentAbort = new AbortController();
  const { signal } = currentAbort;
  lastProgressAt = 0;

  try {
    updateStatus(message.taskId, 'connecting');
    const relayClient = new RelayClient({ baseUrl: message.baseUrl, control });
    currentRelay = await relayClient.createSession({
      deviceId: message.device.id,
      protocol: RELAY_PROTOCOLS.files,
      signal,
      authorizationTimeoutMs: 15_000,
      connectionTimeoutMs: 20_000,
      handshakeTimeoutMs: 20_000,
    });
    currentFiles = new FilesSession(currentRelay);

    updateStatus(message.taskId, 'checking');
    const existing = await findExistingFile(
      currentFiles,
      message.config.targetDirectory,
      message.config.targetFileName,
      signal,
    );
    if (existing && message.config.overwritePolicy === 'skip') {
      post({ type: 'completed', taskId: message.taskId, result: 'skipped', detail: '远端已存在同名文件。' });
      return;
    }

    updateStatus(message.taskId, 'uploading');
    await currentFiles.uploadFile(
      message.config.targetDirectory,
      browserFileSource(message.config.file),
      {
        name: message.config.targetFileName,
        signal,
        timeoutMs: 60_000,
        chunkSize: message.chunkSize,
        onProgress: (progress) => {
          const now = performance.now();
          const finalProgress = progress.percentage >= 100 || ['failed', 'cancelled'].includes(progress.state);
          if (!finalProgress && now - lastProgressAt < 150) return;
          lastProgressAt = now;
          post({
            type: 'progress',
            taskId: message.taskId,
            sentBytes: progress.sentBytes,
            acknowledgedBytes: progress.acknowledgedBytes,
            totalBytes: progress.totalBytes,
            percentage: progress.percentage,
          });
        },
      },
    );
    post({ type: 'completed', taskId: message.taskId, result: 'success' });
  } catch (error) {
    if (signal.aborted || errorCode(error) === 'cancelled') {
      post({ type: 'cancelled', taskId: message.taskId });
    } else {
      post({
        type: 'failed',
        taskId: message.taskId,
        errorCode: errorCode(error),
        error: error instanceof Error ? error.message : '未知上传错误。',
      });
    }
  } finally {
    currentFiles?.dispose();
    currentRelay?.cancel('Batch upload task finished.');
    currentFiles = undefined;
    currentRelay = undefined;
    currentAbort = undefined;
    currentTaskId = undefined;
    post({ type: 'ready' });
  }
}

function cancelCurrent(taskId: string): void {
  if (currentTaskId !== taskId) return;
  updateStatus(taskId, 'cancelling');
  currentAbort?.abort();
  currentFiles?.cancelActive('用户取消上传。');
  currentRelay?.cancel('Batch upload task cancelled.');
  rejectAllRpc('批量上传任务已取消。');
}

function rejectAllRpc(reason: string): void {
  for (const pending of pendingRpc.values()) pending.reject(new Error(reason));
  pendingRpc.clear();
}

workerScope.onmessage = (event: MessageEvent<MainMessage>) => {
  const message = event.data;
  switch (message.type) {
    case 'run':
      void runTask(message);
      break;
    case 'cancel':
      cancelCurrent(message.taskId);
      break;
    case 'rpc-result': {
      const pending = pendingRpc.get(message.requestId);
      if (!pending) break;
      pendingRpc.delete(message.requestId);
      pending.resolve(message.result);
      break;
    }
    case 'rpc-error': {
      const pending = pendingRpc.get(message.requestId);
      if (!pending) break;
      pendingRpc.delete(message.requestId);
      pending.reject(new Error(message.error));
      break;
    }
    case 'shutdown':
      currentAbort?.abort();
      currentFiles?.cancelActive('上传 Worker 已关闭。');
      currentRelay?.cancel('Batch upload worker shutdown.');
      rejectAllRpc('上传 Worker 已关闭。');
      workerScope.close();
      break;
  }
};

post({ type: 'ready' });
