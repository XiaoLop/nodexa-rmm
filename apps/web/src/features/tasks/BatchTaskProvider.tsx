import type { BatchDeviceResult, CommandExecutionHandle } from '@meshcentral/control-client';
import type { Device } from '@meshcentral/shared-state';
import { useEffect, useMemo, useSyncExternalStore, type PropsWithChildren } from 'react';
import { useMeshCentralControl } from '../gateway/MeshCentralControlProvider';
import { prepareCommandForDevice, resolveCommandShell } from '../commands/commandShell';
import { BatchUploadManager } from '../batch-upload/BatchUploadManager';
import { summarizeBatchUpload } from '../batch-upload/types';
import { MESH_CENTRAL_RELAY_URL } from '../../config/gateway';
import { BatchTaskManager } from './BatchTaskManager';
import { BatchTaskContext, type BatchTaskContextValue, useBatchTasks } from './BatchTaskContext';
import type { BatchTask, BatchTaskStatus } from './types';

export { useBatchTasks };

function commandStatus(handles: CommandExecutionHandle[]): BatchTaskStatus {
  const statuses = handles.map((handle) => handle.getSnapshot().status);
  if (statuses.some((status) => status === 'submitting' || status === 'running')) return 'running';
  if (statuses.every((status) => status === 'succeeded')) return 'completed';
  if (statuses.every((status) => status === 'failed' || status === 'timedOut')) return 'failed';
  if (statuses.some((status) => status === 'unknown')) return 'interrupted';
  return 'partially-completed';
}

function deviceOperationStatus(results: BatchDeviceResult[]): BatchTaskStatus {
  const failed = results.filter((result) => result.status === 'failed').length;
  const submitted = results.filter(
    (result) => result.status === 'submitted' || result.status === 'succeeded',
  ).length;
  if (failed && submitted) return 'partially-completed';
  if (failed) return 'failed';
  return 'completed';
}

export function BatchTaskProvider({ children }: PropsWithChildren) {
  const gateway = useMeshCentralControl();
  const manager = useMemo(() => new BatchTaskManager(), []);
  const snapshot = useSyncExternalStore(
    manager.subscribe,
    manager.getSnapshot,
    manager.getSnapshot,
  );

  useEffect(() => {
    if (gateway.store.getState().status !== 'connected') manager.handleGatewayDisconnected();
    return gateway.store.subscribe((state, previous) => {
      if (previous.status === 'connected' && state.status !== 'connected') {
        manager.handleGatewayDisconnected();
      }
    });
  }, [gateway.store, manager]);

  useEffect(() => {
    if (!gateway.authenticated) manager.reset();
  }, [gateway.authenticated, manager]);

  useEffect(() => () => manager.dispose(), [manager]);

  const value = useMemo<BatchTaskContextValue>(() => {
    const updateUploadTask = (taskId: string, uploadManager: BatchUploadManager) => {
      const upload = uploadManager.getSnapshot();
      const summary = summarizeBatchUpload(upload.tasks);
      const status: BatchTaskStatus =
        upload.status === 'running'
          ? 'running'
          : upload.status === 'cancelling'
            ? 'cancelling'
            : upload.status === 'cancelled'
              ? 'cancelled'
              : upload.status === 'completed'
                ? summary.failed
                  ? summary.success || summary.skipped
                    ? 'partially-completed'
                    : 'failed'
                  : 'completed'
                : 'queued';
      manager.updateTask(
        taskId,
        (task) =>
          ({
            ...task,
            status,
            startedAt: upload.createdAt,
            completedAt: upload.completedAt,
            progress: summary.percentage,
            totalCount: summary.total,
            completedCount: summary.success + summary.failed + summary.skipped + summary.cancelled,
            succeededCount: summary.success,
            failedCount: summary.failed,
            skippedCount: summary.skipped,
            availableActions: [
              ...(upload.status === 'running' || upload.status === 'cancelling'
                ? (['cancel'] as const)
                : []),
              ...(summary.failed > 0 && upload.status === 'completed' ? (['retry'] as const) : []),
            ],
            upload,
          }) as BatchTask,
      );
    };

    return {
      ...snapshot,
      manager,
      createUploadTask: (title, devices, config) => {
        if (!gateway.client || gateway.store.getState().status !== 'connected') return undefined;
        const uploadManager = new BatchUploadManager();
        uploadManager.activate();
        uploadManager.configure(devices);
        const upload = uploadManager.getSnapshot();
        const taskId = manager.addTask({
          kind: 'file-upload',
          title,
          status: 'queued',
          createdAt: Date.now(),
          progress: 0,
          totalCount: devices.length,
          completedCount: 0,
          succeededCount: 0,
          failedCount: 0,
          skippedCount: 0,
          availableActions: [],
          upload,
        });
        const unsubscribe = uploadManager.subscribe(() => updateUploadTask(taskId, uploadManager));
        manager.registerCleanup(taskId, unsubscribe);
        manager.registerCleanup(taskId, () => uploadManager.dispose());
        manager.registerDisconnectHandler(taskId, () => uploadManager.handleGatewayDisconnected());
        manager.registerAction(taskId, 'cancel', () => uploadManager.cancelAll());
        manager.registerAction(taskId, 'retry', () => uploadManager.retryFailed());
        uploadManager.start(config, gateway.client, MESH_CENTRAL_RELAY_URL);
        return taskId;
      },
      createCommandTask: (options) => {
        if (!gateway.client || gateway.store.getState().status !== 'connected') return undefined;
        const deviceNames = Object.fromEntries(
          options.devices.map((device) => [device.id, device.name]),
        );
        const taskId = manager.addTask({
          kind: 'command',
          title: options.title,
          status: 'running',
          createdAt: Date.now(),
          startedAt: Date.now(),
          progress: 0,
          totalCount: options.devices.length,
          completedCount: 0,
          succeededCount: 0,
          failedCount: 0,
          skippedCount: 0,
          availableActions: [],
          command: options.command,
          shell: options.shell,
          deviceNames,
        });
        const groups = new Map<
          string,
          { shell: 'shell' | 'powershell'; command: string; devices: Device[] }
        >();
        try {
          for (const device of options.devices) {
            const shell = resolveCommandShell(device, options.shell);
            const command = prepareCommandForDevice(device, shell, options.command);
            const key = `${shell}\0${command}`;
            const group = groups.get(key) ?? { shell, command, devices: [] };
            group.devices.push(device);
            groups.set(key, group);
          }
          const handles = [...groups.values()].map((group) =>
            gateway.client!.commands.execute(
              group.devices.map((device) => device.id),
              group.command,
              { shell: group.shell, runAsUser: options.runAsUser, timeoutMs: options.timeoutMs },
            ),
          );
          const update = () => {
            const snapshots = handles.map((handle) => handle.getSnapshot());
            const results = snapshots.flatMap((item) => item.results);
            const completed = results.filter(
              (result) => !['submitting', 'running'].includes(result.status),
            ).length;
            const succeeded = results.filter((result) => result.status === 'succeeded').length;
            const failed = results.filter((result) =>
              ['failed', 'timedOut', 'unknown'].includes(result.status),
            ).length;
            manager.updateTask(
              taskId,
              (task) =>
                ({
                  ...task,
                  status: commandStatus(handles),
                  progress: results.length ? (completed / results.length) * 100 : 0,
                  completedCount: completed,
                  succeededCount: succeeded,
                  failedCount: failed,
                  completedAt: completed === results.length ? Date.now() : undefined,
                  commandSnapshot: {
                    requestId: snapshots.map((item) => item.requestId).join(', '),
                    status: snapshots.some(
                      (item) => item.status === 'running' || item.status === 'submitting',
                    )
                      ? 'running'
                      : snapshots.every((item) => item.status === 'succeeded')
                        ? 'succeeded'
                        : snapshots.some((item) => item.status === 'failed')
                          ? 'failed'
                          : snapshots.some((item) => item.status === 'timedOut')
                            ? 'timedOut'
                            : 'unknown',
                    results,
                    trackingStopped: snapshots.some((item) => item.trackingStopped),
                  },
                }) as BatchTask,
            );
          };
          for (const handle of handles) {
            manager.registerCleanup(taskId, handle.subscribe(update));
            manager.registerCleanup(taskId, () => handle.stopTracking());
          }
          update();
          return taskId;
        } catch {
          manager.updateTask(taskId, (task) => ({
            ...task,
            status: 'failed',
            failedCount: task.totalCount,
            completedCount: task.totalCount,
            completedAt: Date.now(),
          }));
          return taskId;
        }
      },
      createMoveTask: (options) => {
        if (!gateway.client || gateway.store.getState().status !== 'connected') return undefined;
        const skippedResults = options.skippedResults ?? [];
        const taskId = manager.addTask({
          kind: 'move-group',
          title: options.title,
          status: 'running',
          createdAt: Date.now(),
          startedAt: Date.now(),
          progress:
            (skippedResults.length / (options.devices.length + skippedResults.length)) * 100,
          totalCount: options.devices.length + skippedResults.length,
          completedCount: skippedResults.length,
          succeededCount: 0,
          failedCount: 0,
          skippedCount: skippedResults.length,
          availableActions: [],
          targetGroupId: options.targetGroupId,
          targetGroupName: options.targetGroupName,
          results: skippedResults,
        });
        void gateway.client.devices
          .updateManyGroup(options.devices, options.targetGroupId)
          .then((response) => {
            const results = [...response.results, ...skippedResults];
            const submittedIds = response.results
              .filter((result) => result.status === 'submitted' || result.status === 'succeeded')
              .map((result) => result.deviceId);
            options.onSubmitted?.(submittedIds);
            manager.updateTask(
              taskId,
              (task) =>
                ({
                  ...task,
                  status: deviceOperationStatus(results),
                  progress: 100,
                  completedCount: results.length,
                  succeededCount: submittedIds.length,
                  failedCount: results.filter((result) => result.status === 'failed').length,
                  skippedCount: skippedResults.length,
                  completedAt: Date.now(),
                  results,
                }) as BatchTask,
            );
          })
          .catch((error: unknown) => {
            const failedResults: BatchDeviceResult[] = options.devices.map((device) => ({
              deviceId: device.id,
              deviceName: device.name,
              status: 'failed',
              message: error instanceof Error ? error.message : String(error),
            }));
            const results = [...failedResults, ...skippedResults];
            manager.updateTask(
              taskId,
              (task) =>
                ({
                  ...task,
                  status: 'failed',
                  progress: 100,
                  completedCount: results.length,
                  failedCount: failedResults.length,
                  skippedCount: skippedResults.length,
                  completedAt: Date.now(),
                  results,
                }) as BatchTask,
            );
          });
        return taskId;
      },
      createPowerTask: (options) => {
        if (!gateway.client || gateway.store.getState().status !== 'connected') return undefined;
        const skippedResults = options.skippedResults ?? [];
        const taskId = manager.addTask({
          kind: 'power',
          title: options.title,
          status: 'running',
          createdAt: Date.now(),
          startedAt: Date.now(),
          progress:
            (skippedResults.length / (options.devices.length + skippedResults.length)) * 100,
          totalCount: options.devices.length + skippedResults.length,
          completedCount: skippedResults.length,
          succeededCount: 0,
          failedCount: 0,
          skippedCount: skippedResults.length,
          availableActions: [],
          action: options.action,
          results: skippedResults,
        });
        void gateway.client.devices
          .powerMany(options.devices, options.action)
          .then((response) => {
            const results = [...response.results, ...skippedResults];
            const submittedIds = response.results
              .filter((result) => result.status === 'submitted' || result.status === 'succeeded')
              .map((result) => result.deviceId);
            options.onSubmitted?.(submittedIds);
            manager.updateTask(
              taskId,
              (task) =>
                ({
                  ...task,
                  status: deviceOperationStatus(results),
                  progress: 100,
                  completedCount: results.length,
                  succeededCount: submittedIds.length,
                  failedCount: results.filter((result) => result.status === 'failed').length,
                  skippedCount: skippedResults.length,
                  completedAt: Date.now(),
                  results,
                }) as BatchTask,
            );
          })
          .catch((error: unknown) => {
            const failedResults: BatchDeviceResult[] = options.devices.map((device) => ({
              deviceId: device.id,
              deviceName: device.name,
              status: 'failed',
              message: error instanceof Error ? error.message : String(error),
            }));
            const results = [...failedResults, ...skippedResults];
            manager.updateTask(
              taskId,
              (task) =>
                ({
                  ...task,
                  status: 'failed',
                  progress: 100,
                  completedCount: results.length,
                  failedCount: failedResults.length,
                  skippedCount: skippedResults.length,
                  completedAt: Date.now(),
                  results,
                }) as BatchTask,
            );
          });
        return taskId;
      },
    };
  }, [gateway.client, gateway.store, manager, snapshot]);

  return <BatchTaskContext.Provider value={value}>{children}</BatchTaskContext.Provider>;
}
