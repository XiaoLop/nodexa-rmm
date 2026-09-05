import type { Device } from '@meshcentral/shared-state';

export type BatchUploadOverwritePolicy = 'skip' | 'overwrite';

export type BatchUploadTaskStatus =
  | 'queued'
  | 'connecting'
  | 'checking'
  | 'uploading'
  | 'success'
  | 'skipped'
  | 'failed'
  | 'cancelling'
  | 'cancelled';

export type BatchUploadStatus =
  'configuring' | 'running' | 'cancelling' | 'completed' | 'cancelled' | 'failed';

export interface BatchUploadDeviceSnapshot {
  id: string;
  name: string;
  platform?: string;
  online: boolean;
}

export interface BatchUploadConfig {
  files: File[];
  targetDirectory: string;
  overwritePolicy: BatchUploadOverwritePolicy;
  concurrency: number;
}

export interface BatchUploadTask {
  id: string;
  batchId: string;
  device: BatchUploadDeviceSnapshot;
  file?: File;
  targetFileName?: string;
  status: BatchUploadTaskStatus;
  totalBytes: number;
  sentBytes: number;
  acknowledgedBytes: number;
  percentage: number;
  retryCount: number;
  startedAt?: number;
  completedAt?: number;
  errorCode?: string;
  detail?: string;
  workerId?: string;
}

export interface BatchUploadSnapshot {
  id?: string;
  status: BatchUploadStatus;
  config?: BatchUploadConfig;
  tasks: BatchUploadTask[];
  createdAt?: number;
  completedAt?: number;
}

export interface BatchUploadSummary {
  total: number;
  queued: number;
  active: number;
  success: number;
  skipped: number;
  failed: number;
  cancelled: number;
  acknowledgedBytes: number;
  totalUploadBytes: number;
  percentage: number;
}

export function snapshotDevice(device: Device): BatchUploadDeviceSnapshot {
  return {
    id: device.id,
    name: device.name,
    platform: device.platform,
    online: device.online,
  };
}

export function validateTargetDirectory(value: string): string | undefined {
  if (value.includes('\0')) return '目标目录不能包含空字节。';
  const trimmed = value.trim();
  if (!trimmed) return '请输入目标目录。';
  const parts = trimmed.split(/[\\/]+/);
  if (parts.includes('..')) return '目标目录不能包含父目录跳转（..）。';
  return undefined;
}

export function validateTargetFileName(value: string): string | undefined {
  if (!value) return '请输入目标文件名。';
  if (value.includes('\0')) return '目标文件名不能包含空字节。';
  if (value === '.' || value === '..' || value.includes('/') || value.includes('\\')) {
    return '目标文件名必须是单个安全文件名，不能包含路径分隔符。';
  }
  return undefined;
}

export function summarizeBatchUpload(tasks: BatchUploadTask[]): BatchUploadSummary {
  const summary: BatchUploadSummary = {
    total: tasks.length,
    queued: 0,
    active: 0,
    success: 0,
    skipped: 0,
    failed: 0,
    cancelled: 0,
    acknowledgedBytes: 0,
    totalUploadBytes: 0,
    percentage: 0,
  };

  for (const task of tasks) {
    if (task.status === 'queued') summary.queued += 1;
    if (['connecting', 'checking', 'uploading', 'cancelling'].includes(task.status)) {
      summary.active += 1;
    }
    if (task.status === 'success') summary.success += 1;
    if (task.status === 'skipped') summary.skipped += 1;
    if (task.status === 'failed') summary.failed += 1;
    if (task.status === 'cancelled') summary.cancelled += 1;
    if (!['skipped', 'cancelled'].includes(task.status)) {
      summary.acknowledgedBytes += task.acknowledgedBytes;
      summary.totalUploadBytes += task.totalBytes;
    }
  }

  summary.percentage = summary.totalUploadBytes
    ? Math.min(100, (summary.acknowledgedBytes / summary.totalUploadBytes) * 100)
    : summary.total > 0 && summary.queued === 0 && summary.active === 0
      ? 100
      : 0;
  return summary;
}
