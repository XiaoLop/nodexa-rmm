import type { BatchDeviceResult, CommandShell, PowerAction } from '@meshcentral/control-client';
import type { Device } from '@meshcentral/shared-state';
import { createContext, useContext } from 'react';
import type { BatchUploadConfig, BatchUploadDeviceSnapshot } from '../batch-upload/types';
import type { BatchTaskManager } from './BatchTaskManager';
import type { BatchTaskSnapshot } from './types';

export interface CommandTaskOptions {
  title: string;
  devices: Device[];
  command: string;
  shell: CommandShell;
  runAsUser: 0 | 1 | 2;
  timeoutMs: number;
}

export interface DeviceOperationOptions {
  title: string;
  devices: Array<{ id: string; name: string }>;
  skippedResults?: BatchDeviceResult[];
  onSubmitted?: (deviceIds: string[]) => void;
}

export interface MoveTaskOptions extends DeviceOperationOptions {
  targetGroupId: string;
  targetGroupName: string;
}

export interface PowerTaskOptions extends DeviceOperationOptions {
  action: PowerAction;
}

export interface BatchTaskContextValue extends BatchTaskSnapshot {
  manager: BatchTaskManager;
  createUploadTask: (
    title: string,
    devices: BatchUploadDeviceSnapshot[],
    config: BatchUploadConfig,
  ) => string | undefined;
  createCommandTask: (options: CommandTaskOptions) => string | undefined;
  createMoveTask: (options: MoveTaskOptions) => string | undefined;
  createPowerTask: (options: PowerTaskOptions) => string | undefined;
}

export const BatchTaskContext = createContext<BatchTaskContextValue | null>(null);

export function useBatchTasks(): BatchTaskContextValue {
  const value = useContext(BatchTaskContext);
  if (!value) throw new Error('useBatchTasks must be used inside BatchTaskProvider.');
  return value;
}
