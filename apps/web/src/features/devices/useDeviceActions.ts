import type {
  BatchDeviceResult,
  CommandShell,
  MeshCentralClient,
} from '@meshcentral/control-client';
import type { Device } from '@meshcentral/shared-state';
import { Modal, message } from 'antd';
import { useCallback, useState, type Key } from 'react';
import { useTranslation } from 'react-i18next';
import type { BatchUploadManager } from '../batch-upload/BatchUploadManager';
import {
  snapshotDevice,
  type BatchUploadConfig,
  type BatchUploadDeviceSnapshot,
} from '../batch-upload/types';
import { useBatchTasks } from '../tasks/BatchTaskContext';
import {
  batchPowerConfirmationContent,
  batchUninstallConfirmationContent,
  deleteDeviceConfirmationContent,
} from './deviceConfirmationContent';
import type { PowerAction } from './devicePresentation';
import { useBatchUploadManager } from './useBatchUploadManager';
import type { SelectedDeviceCapability } from './useDeviceList';

export interface MoveSubmitOptions {
  targetGroupId: string;
  targetGroupName: string;
  devices: Device[];
  skippedResults: BatchDeviceResult[];
}

export interface CommandSubmitOptions {
  command: string;
  shell: CommandShell;
  runAsUser: 0 | 1 | 2;
  timeoutMs: number;
  devices: Device[];
}

export interface DeviceModalsState {
  editingDevice: Device | null;
  inviteOpen: boolean;
  batchUploadOpen: boolean;
  batchMoveOpen: boolean;
  commandDevices: Device[];
  batchDevices: BatchUploadDeviceSnapshot[];
  batchUploadManager: BatchUploadManager;
}

export interface DeviceModalHandlers {
  closeEditor: () => void;
  closeInvite: () => void;
  closeBatchUpload: () => void;
  closeBatchMove: () => void;
  closeCommand: () => void;
  handleUploadStartTask: (config: BatchUploadConfig) => void;
  handleMoveSubmitTask: (options: MoveSubmitOptions) => void;
  handleCommandSubmitTask: (options: CommandSubmitOptions) => void;
  handleBatchOperationCompleted: (successfulDeviceIds: string[]) => void;
}

interface UseDeviceActionsOptions {
  client?: MeshCentralClient;
  connected: boolean;
  devices: Device[];
  selectedDeviceIds: Key[];
  selectedDevices: Device[];
  selectedCapabilities: SelectedDeviceCapability[];
  deviceCapabilities: (device: Device) => SelectedDeviceCapability['capabilities'];
  refreshSnapshot: () => Promise<void>;
  clearSelection: () => void;
  removeSelectedDeviceIds: (deviceIds: Iterable<string>) => void;
}

export function useDeviceActions({
  client,
  connected,
  devices,
  selectedDeviceIds,
  selectedDevices,
  selectedCapabilities,
  deviceCapabilities,
  refreshSnapshot,
  clearSelection,
  removeSelectedDeviceIds,
}: UseDeviceActionsOptions) {
  const { t } = useTranslation();
  const batchTasks = useBatchTasks();
  const [messageApi, messageContextHolder] = message.useMessage();
  const [modal, modalContextHolder] = Modal.useModal();
  const batchUploadManager = useBatchUploadManager(connected);

  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [batchUploadOpen, setBatchUploadOpen] = useState(false);
  const [batchMoveOpen, setBatchMoveOpen] = useState(false);
  const [commandDevices, setCommandDevices] = useState<Device[]>([]);
  const [batchDevices, setBatchDevices] = useState<BatchUploadDeviceSnapshot[]>([]);

  const runPowerAction = useCallback(
    (device: Device, action: PowerAction) => {
      const capabilities = deviceCapabilities(device);
      const permission = action === 'wake' ? capabilities.wake : capabilities.power;
      if (!client || !permission.enabled) {
        void messageApi.error(
          (permission.reason ? t(`deviceWorkspace.tabs.reasons.${permission.reason}`) : undefined) ??
            (action === 'wake'
              ? t('devices.messages.permissionWakeDenied')
              : t('devices.messages.permissionPowerDenied')),
        );
        return;
      }

      const label = t(`devices.powerActions.${action}`);
      modal.confirm({
        title: t('devices.confirm.powerTitle', { action: label }),
        content: t('devices.confirm.powerContent', { name: device.name, action: label }),
        okText: t('devices.confirm.powerOk', { action: label }),
        cancelText: t('common.actions.cancel'),
        okButtonProps: action === 'poweroff' ? { danger: true } : undefined,
        onOk: () => {
          try {
            client.sendPowerAction(device.id, action);
            void messageApi.success(
              t('devices.messages.powerSuccess', { name: device.name, action: label }),
            );
          } catch (error) {
            const detail = error instanceof Error ? error.message : t('common.status.unknown');
            void messageApi.error(t('devices.messages.powerFailed', { action: label, detail }));
          }
        },
      });
    },
    [client, deviceCapabilities, messageApi, modal, t],
  );

  const openDeviceEditor = useCallback(
    (device: Device) => {
      const permission = deviceCapabilities(device).edit;
      if (!permission.enabled) {
        void messageApi.warning(
          (permission.reason
            ? t(`deviceWorkspace.tabs.reasons.${permission.reason}`)
            : undefined) ?? t('devices.messages.permissionEditDenied'),
        );
        return;
      }
      setEditingDevice(device);
    },
    [deviceCapabilities, messageApi, t],
  );

  const confirmDeviceDeletion = useCallback(
    (device: Device) => {
      const permission = deviceCapabilities(device).remove;
      if (!client || !permission.enabled) {
        void messageApi.warning(
          (permission.reason
            ? t(`deviceWorkspace.tabs.reasons.${permission.reason}`)
            : undefined) ?? t('devices.messages.permissionDeleteDenied'),
        );
        return;
      }
      modal.confirm({
        title: t('devices.confirm.deleteTitle'),
        content: deleteDeviceConfirmationContent(t, device.name),
        okText: t('devices.confirm.deleteOk'),
        cancelText: t('common.actions.cancel'),
        okButtonProps: { danger: true },
        onOk: async () => {
          try {
            await client.devices.remove(device.id);
            removeSelectedDeviceIds([device.id]);
            await refreshSnapshot();
            void messageApi.success(t('devices.messages.deleteSuccess', { name: device.name }));
          } catch (error) {
            const detail = error instanceof Error ? error.message : t('common.status.unknown');
            void messageApi.error(t('devices.messages.deleteFailed', { detail }));
            throw error;
          }
        },
      });
    },
    [client, deviceCapabilities, messageApi, modal, refreshSnapshot, removeSelectedDeviceIds, t],
  );

  const confirmAgentUninstall = useCallback(
    (device: Device) => {
      const permission = deviceCapabilities(device).uninstall;
      if (!client || !permission.enabled) {
        void messageApi.warning(
          (permission.reason
            ? t(`deviceWorkspace.tabs.reasons.${permission.reason}`)
            : undefined) ?? t('devices.messages.permissionUninstallDenied'),
        );
        return;
      }
      modal.confirm({
        title: t('devices.confirm.uninstallAgentTitle'),
        content: t('devices.confirm.uninstallAgentContent', { name: device.name }),
        okText: t('devices.confirm.uninstallAgentOk'),
        cancelText: t('common.actions.cancel'),
        okButtonProps: { danger: true },
        onOk: () => {
          try {
            client.devices.uninstallAgent(device.id);
            void messageApi.success(
              t('devices.messages.uninstallAgentSuccess', { name: device.name }),
            );
          } catch (error) {
            const detail = error instanceof Error ? error.message : t('common.status.unknown');
            void messageApi.error(t('devices.messages.uninstallAgentFailed', { detail }));
          }
        },
      });
    },
    [client, deviceCapabilities, messageApi, modal, t],
  );

  const openInviteModal = useCallback(() => setInviteOpen(true), []);
  const openBatchMove = useCallback(() => setBatchMoveOpen(true), []);

  const openBatchUpload = useCallback(() => {
    const selected = new Set(selectedDeviceIds.map(String));
    const snapshots = devices
      .filter((device) => selected.has(device.id) && deviceCapabilities(device).files.enabled)
      .map(snapshotDevice);
    if (!snapshots.length) return;
    batchUploadManager.reset();
    batchUploadManager.configure(snapshots);
    setBatchDevices(snapshots);
    setBatchUploadOpen(true);
  }, [batchUploadManager, deviceCapabilities, devices, selectedDeviceIds]);

  const handleBatchOperationCompleted = useCallback(
    (successfulDeviceIds: string[]) => {
      removeSelectedDeviceIds(successfulDeviceIds);
      void refreshSnapshot().catch((error: unknown) => {
        const detail = error instanceof Error ? error.message : t('common.status.unknown');
        void messageApi.warning(t('devices.messages.batchSnapshotWarning', { detail }));
      });
    },
    [messageApi, refreshSnapshot, removeSelectedDeviceIds, t],
  );

  const confirmBatchPowerAction = useCallback(
    (action: PowerAction) => {
      if (!client || !connected || !selectedDevices.length) return;
      const targets = selectedCapabilities
        .filter(({ capabilities }) =>
          action === 'wake' ? capabilities.wake.enabled : capabilities.power.enabled,
        )
        .map(({ device }) => device);
      const skippedCount = selectedDevices.length - targets.length;
      const label = t(`devices.powerActions.${action}`);
      modal.confirm({
        title: t('devices.confirm.batchPowerTitle', { action: label }),
        content: batchPowerConfirmationContent(t, targets.length, skippedCount, label),
        okText: t('devices.confirm.powerOk', { action: label }),
        cancelText: t('common.actions.cancel'),
        okButtonProps: action === 'poweroff' ? { danger: true } : undefined,
        onOk: async () => {
          if (!targets.length) {
            void messageApi.warning(t('devices.messages.batchPowerNoTargets'));
            return;
          }
          const skippedResults: BatchDeviceResult[] = selectedCapabilities
            .filter(({ capabilities }) =>
              action === 'wake' ? !capabilities.wake.enabled : !capabilities.power.enabled,
            )
            .map(({ device, capabilities }) => ({
              deviceId: device.id,
              deviceName: device.name,
              status: 'skipped',
              message: action === 'wake' ? capabilities.wake.message : capabilities.power.message,
            }));
          batchTasks.createPowerTask({
            title: t('devices.confirm.batchPowerTitle', { action: label }),
            devices: targets.map((device) => ({ id: device.id, name: device.name })),
            skippedResults,
            action,
            onSubmitted: handleBatchOperationCompleted,
          });
          void messageApi.success(t('taskCenter.taskCreated'));
        },
      });
    },
    [
      batchTasks,
      client,
      connected,
      handleBatchOperationCompleted,
      messageApi,
      modal,
      selectedCapabilities,
      selectedDevices,
      t,
    ],
  );

  const confirmBatchAgentUninstall = useCallback(() => {
    if (!client || !connected || !selectedDevices.length) return;
    const targets = selectedCapabilities
      .filter(({ capabilities }) => capabilities.uninstall.enabled)
      .map(({ device }) => device);
    const skippedCount = selectedDevices.length - targets.length;
    modal.confirm({
      title: t('devices.confirm.batchUninstallAgentTitle'),
      content: batchUninstallConfirmationContent(t, targets.length, skippedCount),
      okText: t('devices.confirm.uninstallAgentOk'),
      cancelText: t('common.actions.cancel'),
      okButtonProps: { danger: true },
      onOk: () => {
        if (!targets.length) {
          void messageApi.warning(t('devices.messages.batchUninstallAgentNoTargets'));
          return;
        }
        try {
          client.devices.uninstallAgents(
            targets.map((device) => ({ id: device.id, name: device.name })),
          );
          removeSelectedDeviceIds(targets.map((device) => device.id));
          void messageApi.success(
            t('devices.messages.batchUninstallAgentSuccess', { count: targets.length }),
          );
        } catch (error) {
          const detail = error instanceof Error ? error.message : t('common.status.unknown');
          void messageApi.error(t('devices.messages.batchUninstallAgentFailed', { detail }));
        }
      },
    });
  }, [
    client,
    connected,
    messageApi,
    modal,
    removeSelectedDeviceIds,
    selectedCapabilities,
    selectedDevices,
    t,
  ]);

  const openDeviceCommand = useCallback(
    (device: Device) => {
      const capabilities = deviceCapabilities(device);
      if (!capabilities.command.enabled) {
        void messageApi.warning(
          capabilities.command.message ?? t('devices.messages.permissionCommandDenied'),
        );
        return;
      }
      setCommandDevices([device]);
    },
    [deviceCapabilities, messageApi, t],
  );

  const openCommand = useCallback((targets: Device[]) => setCommandDevices(targets), []);

  const closeEditor = useCallback(() => setEditingDevice(null), []);
  const closeInvite = useCallback(() => setInviteOpen(false), []);
  const closeBatchUpload = useCallback(() => setBatchUploadOpen(false), []);
  const closeBatchMove = useCallback(() => setBatchMoveOpen(false), []);
  const closeCommand = useCallback(() => setCommandDevices([]), []);

  const handleUploadStartTask = useCallback(
    (config: BatchUploadConfig) => {
      batchTasks.createUploadTask(
        t('devices.actions.batchUploadCount', { count: batchDevices.length }),
        batchDevices,
        config,
      );
      clearSelection();
      void messageApi.success(t('taskCenter.taskCreated'));
    },
    [batchDevices, batchTasks, clearSelection, messageApi, t],
  );

  const handleMoveSubmitTask = useCallback(
    (options: MoveSubmitOptions) => {
      batchTasks.createMoveTask({
        title: t('batchOperations.moveTitle'),
        devices: options.devices.map((device) => ({ id: device.id, name: device.name })),
        skippedResults: options.skippedResults,
        targetGroupId: options.targetGroupId,
        targetGroupName: options.targetGroupName,
        onSubmitted: handleBatchOperationCompleted,
      });
      void messageApi.success(t('taskCenter.taskCreated'));
    },
    [batchTasks, handleBatchOperationCompleted, messageApi, t],
  );

  const handleCommandSubmitTask = useCallback(
    (options: CommandSubmitOptions) => {
      batchTasks.createCommandTask({
        title:
          options.devices.length === 1
            ? t('commands.titleSingle', { name: options.devices[0]?.name })
            : t('commands.titleBatch', { count: options.devices.length }),
        ...options,
      });
      clearSelection();
      void messageApi.success(t('taskCenter.taskCreated'));
    },
    [batchTasks, clearSelection, messageApi, t],
  );

  return {
    context: {
      messageContextHolder,
      modalContextHolder,
    },
    modals: {
      editingDevice,
      inviteOpen,
      batchUploadOpen,
      batchMoveOpen,
      commandDevices,
      batchDevices,
      batchUploadManager,
    } satisfies DeviceModalsState,
    handlers: {
      runPowerAction,
      openDeviceEditor,
      confirmDeviceDeletion,
      confirmAgentUninstall,
      openInviteModal,
      openBatchUpload,
      confirmBatchPowerAction,
      confirmBatchAgentUninstall,
      handleBatchOperationCompleted,
      openDeviceCommand,
      openCommand,
      openBatchMove,
      closeEditor,
      closeInvite,
      closeBatchUpload,
      closeBatchMove,
      closeCommand,
      handleUploadStartTask,
      handleMoveSubmitTask,
      handleCommandSubmitTask,
    } satisfies DeviceModalHandlers & {
      runPowerAction: (device: Device, action: PowerAction) => void;
      openDeviceEditor: (device: Device) => void;
      confirmDeviceDeletion: (device: Device) => void;
      confirmAgentUninstall: (device: Device) => void;
      openInviteModal: () => void;
      openBatchUpload: () => void;
      confirmBatchPowerAction: (action: PowerAction) => void;
      confirmBatchAgentUninstall: () => void;
      openDeviceCommand: (device: Device) => void;
      openCommand: (targets: Device[]) => void;
      openBatchMove: () => void;
    },
  };
}
