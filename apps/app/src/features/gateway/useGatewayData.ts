import { useCallback } from 'react';
import { meshCentralControlSelectors, useMeshCentralControlStore } from '@meshcentral/shared-state';
import { useMeshCentralControl } from './MeshCentralControlProvider';

export function useMeshCentralControlData() {
  const gateway = useMeshCentralControl();
  const devices = useMeshCentralControlStore(gateway.store, meshCentralControlSelectors.devices);
  const events = useMeshCentralControlStore(gateway.store, meshCentralControlSelectors.events);
  const status = useMeshCentralControlStore(gateway.store, meshCentralControlSelectors.status);
  const error = useMeshCentralControlStore(gateway.store, meshCentralControlSelectors.error);
  const userInfo = useMeshCentralControlStore(gateway.store, meshCentralControlSelectors.userInfo);

  const refreshDevices = useCallback(() => {
    if (gateway.client) {
      gateway.client.refreshDevices();
    }
  }, [gateway.client]);

  const updateDevice = useCallback(
    (deviceId: string, updates: { name?: string; desc?: string; groupId?: string }) => {
      if (gateway.client) {
        gateway.client.updateDevice(deviceId, updates);
      }
      const existing = gateway.store.getState().devices[deviceId];
      if (existing) {
        gateway.store.getState().upsertDevice({
          ...existing,
          ...(updates.name ? { name: updates.name } : {}),
          ...(updates.groupId ? { groupId: updates.groupId } : {}),
        });
      }
    },
    [gateway.client, gateway.store],
  );

  const sendPowerAction = useCallback(
    (deviceId: string, action: 'wake' | 'reset' | 'poweroff' | 'sleep') => {
      if (gateway.client) {
        gateway.client.sendPowerAction(deviceId, action);
      }
      const existing = gateway.store.getState().devices[deviceId];
      const actionLabels: Record<string, string> = {
        wake: '唤醒设备',
        reset: '重启设备',
        poweroff: '关机',
        sleep: '休眠设备',
      };
      gateway.store.getState().appendEvent({
        id: `power-${Date.now()}`,
        type: 'deviceChanged',
        deviceId,
        message: `向设备 ${existing?.name ?? deviceId} 发送了 [${actionLabels[action] ?? action}] 指令`,
        occurredAt: new Date().toISOString(),
      });
    },
    [gateway.client, gateway.store],
  );

  return {
    ...gateway,
    devices,
    events,
    status,
    error,
    userInfo,
    refreshDevices,
    updateDevice,
    sendPowerAction,
  };
}
