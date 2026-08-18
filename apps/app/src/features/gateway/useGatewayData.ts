import { useCallback } from 'react';
import { gatewaySelectors, useGatewayStore } from '@meshcentral/shared-state';
import { useGateway } from './GatewayProvider';

export function useGatewayData() {
  const gateway = useGateway();
  const devices = useGatewayStore(gateway.store, gatewaySelectors.devices);
  const events = useGatewayStore(gateway.store, gatewaySelectors.events);
  const status = useGatewayStore(gateway.store, gatewaySelectors.status);
  const error = useGatewayStore(gateway.store, gatewaySelectors.error);

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
    refreshDevices,
    updateDevice,
    sendPowerAction,
  };
}
