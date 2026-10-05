import type {
  BatchDeviceResult,
  CommandBatchSnapshot,
  CommandShell,
  PowerAction,
} from '@meshcentral/control-client';
import type { BatchUploadSnapshot } from '../batch-upload/types';

export type BatchTaskKind = 'file-upload' | 'command' | 'move-group' | 'power';

export type BatchTaskStatus =
  | 'queued'
  | 'running'
  | 'cancelling'
  | 'completed'
  | 'partially-completed'
  | 'failed'
  | 'cancelled'
  | 'interrupted';

export type BatchTaskAction = 'cancel' | 'retry';

interface BatchTaskBase {
  id: string;
  kind: BatchTaskKind;
  title: string;
  status: BatchTaskStatus;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  progress: number;
  totalCount: number;
  completedCount: number;
  succeededCount: number;
  failedCount: number;
  skippedCount: number;
  viewed: boolean;
  availableActions: BatchTaskAction[];
}

export interface FileUploadBatchTask extends BatchTaskBase {
  kind: 'file-upload';
  upload: BatchUploadSnapshot;
}

export interface CommandBatchTask extends BatchTaskBase {
  kind: 'command';
  command: string;
  shell: CommandShell;
  deviceNames: Record<string, string>;
  commandSnapshot?: CommandBatchSnapshot;
}

export interface MoveGroupBatchTask extends BatchTaskBase {
  kind: 'move-group';
  targetGroupId: string;
  targetGroupName: string;
  results: BatchDeviceResult[];
}

export interface PowerBatchTask extends BatchTaskBase {
  kind: 'power';
  action: PowerAction;
  results: BatchDeviceResult[];
}

export type BatchTask =
  FileUploadBatchTask | CommandBatchTask | MoveGroupBatchTask | PowerBatchTask;

export interface BatchTaskSnapshot {
  tasks: BatchTask[];
  activeCount: number;
  unviewedCompletedCount: number;
}

type NewBatchTaskFields<T extends BatchTask> = T extends BatchTask
  ? Omit<T, 'id' | 'viewed'> & { id?: string; viewed?: boolean }
  : never;

export type NewBatchTask = NewBatchTaskFields<BatchTask>;

export function isActiveBatchTaskStatus(status: BatchTaskStatus): boolean {
  return status === 'queued' || status === 'running' || status === 'cancelling';
}
