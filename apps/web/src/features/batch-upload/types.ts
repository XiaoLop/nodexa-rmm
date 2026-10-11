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

export interface BatchUploadFileItem {
  file: File;
  relativePath: string;
}

export interface BatchUploadConfig {
  files: (File | BatchUploadFileItem)[];
  targetDirectory: string;
  overwritePolicy: BatchUploadOverwritePolicy;
  concurrency: number;
}

export interface BatchUploadDetail {
  code: string;
  params?: Record<string, string | number>;
  raw?: string;
}

export interface BatchUploadTask {
  id: string;
  batchId: string;
  device: BatchUploadDeviceSnapshot;
  file?: File;
  targetFileName?: string;
  targetRelativePath?: string;
  resolvedTargetDirectory?: string;
  status: BatchUploadTaskStatus;
  totalBytes: number;
  sentBytes: number;
  acknowledgedBytes: number;
  percentage: number;
  retryCount: number;
  startedAt?: number;
  completedAt?: number;
  errorCode?: string;
  detail?: BatchUploadDetail;
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

export type BatchUploadValidationError =
  | 'directoryNullByte'
  | 'directoryRequired'
  | 'directoryTraversal'
  | 'fileNameRequired'
  | 'fileNameNullByte'
  | 'fileNameInvalid';

export function validateTargetDirectory(value: string): BatchUploadValidationError | undefined {
  if (value.includes('\0')) return 'directoryNullByte';
  const trimmed = value.trim();
  if (!trimmed) return 'directoryRequired';
  const parts = trimmed.split(/[\\/]+/);
  if (parts.includes('..')) return 'directoryTraversal';
  return undefined;
}

export function validateTargetFileName(value: string): BatchUploadValidationError | undefined {
  if (!value) return 'fileNameRequired';
  if (value.includes('\0')) return 'fileNameNullByte';
  if (value === '.' || value === '..' || value.includes('/') || value.includes('\\')) {
    return 'fileNameInvalid';
  }
  return undefined;
}

export function normalizeBatchUploadItem(item: File | BatchUploadFileItem): BatchUploadFileItem {
  if ('file' in item && typeof item.relativePath === 'string') {
    return item;
  }
  const file = item as File;
  return {
    file,
    relativePath: file.webkitRelativePath || file.name,
  };
}

export function validateRelativeFilePath(relativePath: string): BatchUploadValidationError | undefined {
  if (!relativePath) return 'fileNameRequired';
  if (relativePath.includes('\0')) return 'fileNameNullByte';
  const parts = relativePath.split(/[\\/]+/).filter(Boolean);
  if (parts.length === 0) return 'fileNameRequired';
  if (parts.includes('..') || parts.includes('.')) return 'directoryTraversal';
  const fileName = parts[parts.length - 1];
  return validateTargetFileName(fileName ?? '');
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
