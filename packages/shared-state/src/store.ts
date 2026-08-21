import { createStore, type StoreApi } from 'zustand/vanilla';
import type { Device, DeviceGroup, GatewayEvent, GatewayMutation, GatewayState, UserInfo } from './types';
import { isIdString } from './utils';

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
  userInfo: undefined,
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
    replaceDevices: (devices) =>
      set((state) => ({
        devices: toRecord(
          devices.map((device) => ({
            ...device,
            lastSeenAt: device.lastSeenAt ?? state.devices[device.id]?.lastSeenAt,
          })),
        ),
      })),
    replaceGroups: (groups) => set({ groups: toRecord(groups) }),
    setUserInfo: (userInfo) => set({ userInfo }),
    upsertDevice: (device) =>
      set((state) => {
        const existing = state.devices[device.id];
        const isOnlineProvided = typeof device.online === 'boolean';
        const online = isOnlineProvided
          ? device.online
          : (existing?.online ?? false);

        const name =
          device.name && !isIdString(device.name)
            ? device.name
            : (existing?.name ?? device.name ?? device.id);

        const merged: Device = {
          ...(existing ?? {}),
          ...device,
          name,
          online,
          groupId: device.groupId ?? existing?.groupId,
          groupName: device.groupName ?? existing?.groupName,
          agentVersion: device.agentVersion ?? existing?.agentVersion,
          platform: device.platform ?? existing?.platform,
          lastSeenAt: device.lastSeenAt ?? existing?.lastSeenAt,
          raw:
            typeof existing?.raw === 'object' &&
            existing.raw !== null &&
            typeof device.raw === 'object' &&
            device.raw !== null
              ? { ...existing.raw, ...device.raw }
              : (device.raw ?? existing?.raw),
        };
        return { devices: { ...state.devices, [device.id]: merged } };
      }),
    removeDevice: (deviceId) =>
      set((state) => {
        const devices = { ...state.devices };
        delete devices[deviceId];
        return { devices };
      }),
    appendEvent: (event) =>
      set((state) => {
        if (!event || event.type === 'unknown' || event.type === 'deviceChanged') return state;
        let enhancedEvent = event;
        if (event.deviceId && (!event.deviceName || isIdString(event.deviceName))) {
          const dev = state.devices[event.deviceId];
          if (dev?.name && !isIdString(dev.name)) {
            enhancedEvent = { ...event, deviceName: dev.name };
          }
        }
        return { events: [enhancedEvent, ...state.events].slice(0, MAX_EVENTS) };
      }),
    touchMessage: () => set({ lastMessageAt: new Date().toISOString() }),
    applyMutation: (mutation) => applyMutation(get(), mutation),
    reset: () => set(initialData),
  }));
}

function applyMutation(state: GatewayState, mutation: GatewayMutation): void {
  switch (mutation.type) {
    case 'snapshot':
      state.replaceDevices(mutation.snapshot.devices);
      state.replaceGroups(mutation.snapshot.groups);
      return;
    case 'devicesReplaced': {
      state.replaceDevices(mutation.devices);
      return;
    }
    case 'deviceLastSeenUpdated': {
      for (const [deviceId, lastSeenAt] of Object.entries(mutation.lastSeenByDeviceId)) {
        const current = state.devices[deviceId];
        if (current) state.upsertDevice({ ...current, lastSeenAt });
      }
      return;
    }
    case 'groupsReplaced':
      state.replaceGroups(mutation.groups);
      return;
    case 'deviceUpserted':
      state.upsertDevice(mutation.device);
      if (mutation.event) state.appendEvent(mutation.event);
      return;
    case 'deviceStatusChanged': {
      const current = state.devices[mutation.deviceId];
      state.upsertDevice({
        id: mutation.deviceId,
        name: current?.name && !isIdString(current.name) ? current.name : mutation.deviceId,
        online: mutation.online,
        lastSeenAt: mutation.online ? current?.lastSeenAt : mutation.event.occurredAt,
      });
      state.appendEvent(mutation.event);
      return;
    }
    case 'deviceRemoved':
      state.removeDevice(mutation.deviceId);
      if (mutation.event) state.appendEvent(mutation.event);
      return;
    case 'eventReceived':
      state.appendEvent(mutation.event);
      return;
    case 'userInfoUpdated':
      state.setUserInfo(mutation.userInfo);
      return;
  }
}

export const gatewaySelectors = {
  status: (state: GatewayState) => state.status,
  error: (state: GatewayState) => state.error,
  reconnectAttempt: (state: GatewayState) => state.reconnectAttempt,
  devices: (state: GatewayState): Device[] => selectDevices(state.devices),
  groups: (state: GatewayState): DeviceGroup[] => selectGroups(state.groups),
  events: (state: GatewayState): GatewayEvent[] => state.events,
  userInfo: (state: GatewayState): UserInfo | undefined => state.userInfo,
  deviceCount: (state: GatewayState) => Object.keys(state.devices).length,
  onlineDeviceCount: (state: GatewayState) =>
    Object.values(state.devices).filter((device) => device.online).length,
};
