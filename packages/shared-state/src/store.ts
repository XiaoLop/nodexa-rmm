import { createStore, type StoreApi } from 'zustand/vanilla';
import type { Device, DeviceGroup, GatewayEvent, GatewayMutation, GatewayState } from './types';

const MAX_EVENTS = 100;

function toRecord<T extends { id: string }>(items: T[]): Record<string, T> {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}

function createValuesSelector<T>() {
  const cache = new WeakMap<Record<string, T>, T[]>();

  return (record: Record<string, T>): T[] => {
    const cached = cache.get(record);
    if (cached) return cached;

    const values = Object.values(record);
    cache.set(record, values);
    return values;
  };
}

const selectDevices = createValuesSelector<Device>();
const selectGroups = createValuesSelector<DeviceGroup>();

const initialData = {
  status: 'idle' as const,
  devices: {},
  groups: {},
  events: [],
  reconnectAttempt: 0,
};

export type GatewayStore = StoreApi<GatewayState>;

export function createGatewayStore(): GatewayStore {
  return createStore<GatewayState>()((set, get) => ({
    ...initialData,
    setConnectionStatus: (status, error) =>
      set({
        status,
        error,
        ...(status === 'connected'
          ? { lastConnectedAt: new Date().toISOString(), reconnectAttempt: 0 }
          : {}),
      }),
    setError: (error) => set({ error }),
    setReconnectAttempt: (reconnectAttempt) => set({ reconnectAttempt }),
    replaceDevices: (devices) => set({ devices: toRecord(devices) }),
    replaceGroups: (groups) => set({ groups: toRecord(groups) }),
    upsertDevice: (device) =>
      set((state) => ({ devices: { ...state.devices, [device.id]: device } })),
    removeDevice: (deviceId) =>
      set((state) => {
        const devices = { ...state.devices };
        delete devices[deviceId];
        return { devices };
      }),
    appendEvent: (event) =>
      set((state) => ({ events: [event, ...state.events].slice(0, MAX_EVENTS) })),
    touchMessage: () => set({ lastMessageAt: new Date().toISOString() }),
    applyMutation: (mutation) => applyMutation(get(), mutation),
    reset: () => set(initialData),
  }));
}

function applyMutation(state: GatewayState, mutation: GatewayMutation): void {
  switch (mutation.type) {
    case 'snapshot':
      console.log('[GatewayStore] 收到全量快照:', {
        devicesCount: mutation.snapshot.devices.length,
        groupsCount: mutation.snapshot.groups.length,
      });
      state.replaceDevices(mutation.snapshot.devices);
      state.replaceGroups(mutation.snapshot.groups);
      return;
    case 'devicesReplaced': {
      const onlineCount = mutation.devices.filter((d) => d.online).length;
      console.log('[GatewayStore] 设备列表替换/全量同步:', {
        total: mutation.devices.length,
        online: onlineCount,
        offline: mutation.devices.length - onlineCount,
      });
      state.replaceDevices(mutation.devices);
      return;
    }
    case 'groupsReplaced':
      console.log('[GatewayStore] 设备组列表替换:', { total: mutation.groups.length });
      state.replaceGroups(mutation.groups);
      return;
    case 'deviceUpserted':
      console.log('[GatewayStore] 设备数据更新/插入:', {
        id: mutation.device.id,
        name: mutation.device.name,
        online: mutation.device.online,
      });
      state.upsertDevice(mutation.device);
      if (mutation.event) state.appendEvent(mutation.event);
      return;
    case 'deviceStatusChanged': {
      const current = state.devices[mutation.deviceId];
      console.log('[GatewayStore] 设备在线状态变更:', {
        deviceId: mutation.deviceId,
        name: current?.name ?? mutation.deviceId,
        online: mutation.online,
      });
      state.upsertDevice({
        id: mutation.deviceId,
        name: current?.name ?? mutation.deviceId,
        ...current,
        online: mutation.online,
      });
      state.appendEvent(mutation.event);
      return;
    }
    case 'deviceRemoved':
      console.log('[GatewayStore] 设备已被移除:', { deviceId: mutation.deviceId });
      state.removeDevice(mutation.deviceId);
      if (mutation.event) state.appendEvent(mutation.event);
      return;
    case 'eventReceived':
      console.log('[GatewayStore] 收到网关事件:', {
        type: mutation.event.type,
        message: mutation.event.message,
      });
      state.appendEvent(mutation.event);
  }
}

export const gatewaySelectors = {
  status: (state: GatewayState) => state.status,
  error: (state: GatewayState) => state.error,
  reconnectAttempt: (state: GatewayState) => state.reconnectAttempt,
  devices: (state: GatewayState): Device[] => selectDevices(state.devices),
  groups: (state: GatewayState): DeviceGroup[] => selectGroups(state.groups),
  events: (state: GatewayState): GatewayEvent[] => state.events,
  deviceCount: (state: GatewayState) => Object.keys(state.devices).length,
  onlineDeviceCount: (state: GatewayState) =>
    Object.values(state.devices).filter((device) => device.online).length,
};
