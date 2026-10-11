import type { MeshCentralClient } from '@meshcentral/control-client';
import { batchUploadBandwidthConfig, calculateBatchUploadChunkSize } from './bandwidth';
import { resolveTargetFilePath } from './fileSystem';
import {
  normalizeBatchUploadItem,
  type BatchUploadConfig,
  type BatchUploadDetail,
  type BatchUploadDeviceSnapshot,
  type BatchUploadSnapshot,
  type BatchUploadTask,
  type BatchUploadTaskStatus,
} from './types';

interface WorkerControlRequest {
  type: 'control-request';
  requestId: string;
  payload: Record<string, unknown>;
  timeoutMs?: number;
}

interface WorkerControlSend {
  type: 'control-send';
  requestId: string;
  payload: unknown;
}

interface WorkerStatus {
  type: 'status';
  taskId: string;
  status: BatchUploadTaskStatus;
  detail?: BatchUploadDetail;
}

interface WorkerProgress {
  type: 'progress';
  taskId: string;
  sentBytes: number;
  acknowledgedBytes: number;
  totalBytes: number;
  percentage: number;
}

interface WorkerCompleted {
  type: 'completed';
  taskId: string;
  result: 'success' | 'skipped';
  detail?: BatchUploadDetail;
}

interface WorkerFailed {
  type: 'failed';
  taskId: string;
  errorCode: string;
  error?: BatchUploadDetail;
}

interface WorkerCancelled {
  type: 'cancelled';
  taskId: string;
}

interface WorkerReady {
  type: 'ready';
}

type WorkerMessage =
  | WorkerControlRequest
  | WorkerControlSend
  | WorkerStatus
  | WorkerProgress
  | WorkerCompleted
  | WorkerFailed
  | WorkerCancelled
  | WorkerReady;

interface WorkerSlot {
  id: string;
  worker: Worker;
  taskId?: string;
  ready: boolean;
}

type Listener = () => void;

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function isTerminal(status: BatchUploadTaskStatus): boolean {
  return ['success', 'skipped', 'failed', 'cancelled'].includes(status);
}

export class BatchUploadManager {
  private snapshot: BatchUploadSnapshot = { status: 'configuring', tasks: [] };
  private readonly listeners = new Set<Listener>();
  private readonly workers: WorkerSlot[] = [];
  private queue: string[] = [];
  private meshCentralClient?: MeshCentralClient;
  private baseUrl?: string;
  private disposed = false;
  private cancellingAll = false;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): BatchUploadSnapshot => this.snapshot;

  activate(): void {
    this.disposed = false;
  }

  configure(devices: BatchUploadDeviceSnapshot[]): void {
    if (this.snapshot.status === 'running' || this.snapshot.status === 'cancelling') return;
    const batchId = createId('batch');
    this.snapshot = {
      id: batchId,
      status: 'configuring',
      tasks: devices.map((device) => ({
        id: createId('device-task'),
        batchId,
        device,
        status: 'queued',
        totalBytes: 0,
        sentBytes: 0,
        acknowledgedBytes: 0,
        percentage: 0,
        retryCount: 0,
      })),
    };
    this.emit();
  }

  reset(): void {
    if (this.snapshot.status === 'running' || this.snapshot.status === 'cancelling') return;
    this.queue = [];
    this.meshCentralClient = undefined;
    this.baseUrl = undefined;
    this.cancellingAll = false;
    this.snapshot = { status: 'configuring', tasks: [] };
    this.emit();
  }

  start(config: BatchUploadConfig, meshCentralClient: MeshCentralClient, baseUrl: string): void {
    if (this.disposed || !this.snapshot.id || this.snapshot.status !== 'configuring') return;
    this.meshCentralClient = meshCentralClient;
    this.baseUrl = baseUrl;
    this.cancellingAll = false;
    const now = Date.now();
    const normalizedItems = config.files.map(normalizeBatchUploadItem);
    const tasks = this.snapshot.tasks.flatMap((task) =>
      normalizedItems.map((item) => {
        const { targetDirectory, targetFileName } = resolveTargetFilePath(
          config.targetDirectory,
          item.relativePath,
          task.device.platform,
        );
        return {
          ...task,
          id: createId('file-task'),
          file: item.file,
          targetFileName,
          targetRelativePath: item.relativePath,
          resolvedTargetDirectory: targetDirectory,
          status: task.device.online ? ('queued' as const) : ('skipped' as const),
          totalBytes: item.file.size,
          completedAt: task.device.online ? undefined : now,
          detail: task.device.online ? undefined : { code: 'deviceOffline' },
        };
      }),
    );
    this.snapshot = {
      ...this.snapshot,
      status: 'running',
      config,
      tasks,
      createdAt: now,
      completedAt: undefined,
    };
    this.queue = tasks.filter((task) => task.status === 'queued').map((task) => task.id);
    const workerCount = Math.min(config.concurrency, this.queue.length, 8);
    for (let index = 0; index < workerCount; index += 1) this.createWorker();
    this.emit();
    this.schedule();
    this.finishIfDone();
  }

  cancelTask(taskId: string): void {
    const task = this.findTask(taskId);
    if (!task || isTerminal(task.status)) return;
    if (task.status === 'queued') {
      this.queue = this.queue.filter((id) => id !== taskId);
      this.updateTask(taskId, {
        status: 'cancelled',
        completedAt: Date.now(),
        detail: { code: 'cancelledByUser' },
      });
      this.finishIfDone();
      return;
    }
    const slot = this.workers.find((candidate) => candidate.taskId === taskId);
    if (!slot) return;
    this.updateTask(taskId, { status: 'cancelling', detail: { code: 'cancelling' } });
    slot.worker.postMessage({ type: 'cancel', taskId });
  }

  cancelAll(): void {
    if (!['running', 'cancelling'].includes(this.snapshot.status)) return;
    this.cancellingAll = true;
    this.snapshot = { ...this.snapshot, status: 'cancelling' };
    const now = Date.now();
    const queued = new Set(this.queue);
    this.queue = [];
    this.snapshot = {
      ...this.snapshot,
      tasks: this.snapshot.tasks.map((task) =>
        queued.has(task.id)
          ? { ...task, status: 'cancelled', completedAt: now, detail: { code: 'cancelledByUser' } }
          : task,
      ),
    };
    for (const slot of this.workers) {
      if (slot.taskId) {
        this.updateTask(slot.taskId, { status: 'cancelling', detail: { code: 'cancelling' } }, false);
        slot.worker.postMessage({ type: 'cancel', taskId: slot.taskId });
      }
    }
    this.emit();
    this.finishIfDone();
  }

  retryFailed(): void {
    const config = this.snapshot.config;
    if (!config || !this.meshCentralClient || !this.baseUrl) return;
    const failed = this.snapshot.tasks.filter((task) => task.status === 'failed');
    if (!failed.length) return;
    const failedIds = new Set(failed.map((task) => task.id));
    this.snapshot = {
      ...this.snapshot,
      status: 'running',
      completedAt: undefined,
      tasks: this.snapshot.tasks.map((task) =>
        failedIds.has(task.id)
          ? {
              ...task,
              status: 'queued',
              sentBytes: 0,
              acknowledgedBytes: 0,
              percentage: 0,
              errorCode: undefined,
              detail: undefined,
              startedAt: undefined,
              completedAt: undefined,
              workerId: undefined,
              retryCount: task.retryCount + 1,
            }
          : task,
      ),
    };
    this.queue.push(...failed.map((task) => task.id));
    const desired = Math.min(config.concurrency, this.queue.length, 8);
    while (this.workers.length < desired) this.createWorker();
    this.emit();
    this.schedule();
  }

  handleGatewayDisconnected(): void {
    if (this.snapshot.status !== 'running' || !this.queue.length) return;
    const queued = new Set(this.queue);
    this.queue = [];
    const now = Date.now();
    this.snapshot = {
      ...this.snapshot,
      tasks: this.snapshot.tasks.map((task) =>
        queued.has(task.id)
          ? {
              ...task,
              status: 'failed',
              errorCode: 'gateway-disconnected',
              detail: { code: 'gatewayDisconnected' },
              completedAt: now,
            }
          : task,
      ),
    };
    this.emit();
    this.finishIfDone();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const slot of this.workers) {
      slot.worker.postMessage({ type: 'shutdown' });
      slot.worker.terminate();
    }
    this.workers.splice(0);
    this.queue = [];
    this.listeners.clear();
  }

  private createWorker(): void {
    const worker = new Worker(new URL('./batchUpload.worker.ts', import.meta.url), {
      type: 'module',
    });
    const slot: WorkerSlot = { id: createId('worker'), worker, ready: false };
    worker.onmessage = (event: MessageEvent<WorkerMessage>) =>
      this.handleWorkerMessage(slot, event.data);
    worker.onerror = (event) => {
      const taskId = slot.taskId;
      if (taskId) {
        this.updateTask(taskId, {
          status: 'failed',
          errorCode: 'worker-error',
          detail: event.message ? { code: 'workerError', raw: event.message } : { code: 'workerError' },
          completedAt: Date.now(),
          workerId: undefined,
        });
      }
      this.removeWorker(slot);
      if (!this.cancellingAll && this.queue.length) this.createWorker();
      this.schedule();
      this.finishIfDone();
    };
    this.workers.push(slot);
  }

  private handleWorkerMessage(slot: WorkerSlot, message: WorkerMessage): void {
    switch (message.type) {
      case 'ready':
        slot.taskId = undefined;
        slot.ready = true;
        this.schedule();
        this.finishIfDone();
        break;
      case 'control-request':
        void this.handleControlRequest(slot, message);
        break;
      case 'control-send':
        this.handleControlSend(slot, message);
        break;
      case 'status':
        this.updateTask(message.taskId, {
          status: message.status,
          detail: message.detail,
          startedAt: this.findTask(message.taskId)?.startedAt ?? Date.now(),
        });
        break;
      case 'progress':
        this.updateTask(message.taskId, {
          sentBytes: message.sentBytes,
          acknowledgedBytes: message.acknowledgedBytes,
          totalBytes: message.totalBytes,
          percentage: message.percentage,
        });
        break;
      case 'completed':
        this.updateTask(message.taskId, {
          status: message.result,
          acknowledgedBytes:
            message.result === 'success' ? (this.findTask(message.taskId)?.totalBytes ?? 0) : 0,
          percentage: message.result === 'success' ? 100 : 0,
          detail: message.detail,
          completedAt: Date.now(),
          workerId: undefined,
        });
        break;
      case 'failed':
        this.updateTask(message.taskId, {
          status: 'failed',
          errorCode: message.errorCode,
          detail: message.error,
          completedAt: Date.now(),
          workerId: undefined,
        });
        break;
      case 'cancelled':
        this.updateTask(message.taskId, {
          status: 'cancelled',
          detail: { code: 'cancelledByUser' },
          completedAt: Date.now(),
          workerId: undefined,
        });
        break;
    }
  }

  private async handleControlRequest(
    slot: WorkerSlot,
    message: WorkerControlRequest,
  ): Promise<void> {
    if (!this.meshCentralClient || !slot.taskId) {
      slot.worker.postMessage({
        type: 'rpc-error',
        requestId: message.requestId,
        error: 'gateway-unavailable',
      });
      return;
    }
    try {
      const result = await this.meshCentralClient.request(message.payload, message.timeoutMs);
      if (slot.taskId)
        slot.worker.postMessage({ type: 'rpc-result', requestId: message.requestId, result });
    } catch (error) {
      if (slot.taskId) {
        slot.worker.postMessage({
          type: 'rpc-error',
          requestId: message.requestId,
          error: error instanceof Error ? error.message : 'gateway-request-failed',
        });
      }
    }
  }

  private handleControlSend(slot: WorkerSlot, message: WorkerControlSend): void {
    try {
      if (!this.meshCentralClient || !slot.taskId) throw new Error('gateway-unavailable');
      this.meshCentralClient.send(message.payload);
      slot.worker.postMessage({
        type: 'rpc-result',
        requestId: message.requestId,
        result: undefined,
      });
    } catch (error) {
      slot.worker.postMessage({
        type: 'rpc-error',
        requestId: message.requestId,
        error: error instanceof Error ? error.message : 'gateway-send-failed',
      });
    }
  }

  private schedule(): void {
    if (this.disposed || this.cancellingAll || this.snapshot.status !== 'running') return;
    const config = this.snapshot.config;
    if (!config || !this.baseUrl) return;
    const concurrentUploads = Math.max(
      1,
      Math.min(
        config.concurrency,
        this.workers.length,
        this.queue.length + this.activeWorkerCount(),
      ),
    );
    const chunkSize = calculateBatchUploadChunkSize(batchUploadBandwidthConfig, concurrentUploads);
    for (const slot of this.workers) {
      if (!slot.ready || slot.taskId || !this.queue.length) continue;
      const taskId = this.queue.shift();
      if (!taskId) break;
      const task = this.findTask(taskId);
      if (!task || task.status !== 'queued' || !task.file || !task.targetFileName) continue;
      slot.ready = false;
      slot.taskId = taskId;
      this.updateTask(taskId, {
        status: 'connecting',
        startedAt: Date.now(),
        workerId: slot.id,
        detail: undefined,
      });
      slot.worker.postMessage({
        type: 'run',
        taskId,
        device: task.device,
        targetDirectory: task.resolvedTargetDirectory ?? config.targetDirectory,
        overwritePolicy: config.overwritePolicy,
        file: task.file,
        targetFileName: task.targetFileName,
        baseUrl: this.baseUrl,
        chunkSize,
      });
    }
  }

  private activeWorkerCount(): number {
    return this.workers.filter((slot) => Boolean(slot.taskId)).length;
  }

  private finishIfDone(): void {
    if (!this.snapshot.tasks.length) return;
    const done = this.snapshot.tasks.every((task) => isTerminal(task.status));
    if (!done) return;
    const status = this.cancellingAll ? 'cancelled' : 'completed';
    this.snapshot = { ...this.snapshot, status, completedAt: Date.now() };
    for (const slot of [...this.workers]) this.removeWorker(slot);
    this.emit();
  }

  private removeWorker(slot: WorkerSlot): void {
    slot.worker.postMessage({ type: 'shutdown' });
    slot.worker.terminate();
    const index = this.workers.indexOf(slot);
    if (index >= 0) this.workers.splice(index, 1);
  }

  private findTask(taskId: string): BatchUploadTask | undefined {
    return this.snapshot.tasks.find((task) => task.id === taskId);
  }

  private updateTask(taskId: string, updates: Partial<BatchUploadTask>, shouldEmit = true): void {
    this.snapshot = {
      ...this.snapshot,
      tasks: this.snapshot.tasks.map((task) =>
        task.id === taskId ? { ...task, ...updates } : task,
      ),
    };
    if (shouldEmit) this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}
