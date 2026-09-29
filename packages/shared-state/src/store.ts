import { createStore, type StoreApi } from 'zustand/vanilla';
import type {
  Device,
  DeviceGroup,
  MeshCentralEvent,
  MeshCentralControlState,
  ServerInfo,
  UserInfo,
} from './types';
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
  serverInfo: undefined,
  reconnectAttempt: 0,
};

export type MeshCentralControlStore = StoreApi<MeshCentralControlState>;

export function createMeshCentralControlStore(): MeshCentralControlStore {
  return createStore<MeshCentralControlState>()((set) => ({
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
    setServerInfo: (serverInfo) => set({ serverInfo }),
    clearAuthorizationSnapshot: () =>
      set({ devices: {}, groups: {}, userInfo: undefined, serverInfo: undefined }),
    upsertDevice: (device) =>
      set((state) => {
        const existing = state.devices[device.id];
        const isOnlineProvided = typeof device.online === 'boolean';
        const online = isOnlineProvided ? device.online : (existing?.online ?? false);

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
    reset: () => set(initialData),
  }));
}

export const meshCentralControlSelectors = {
  status: (state: MeshCentralControlState) => state.status,
  error: (state: MeshCentralControlState) => state.error,
  reconnectAttempt: (state: MeshCentralControlState) => state.reconnectAttempt,
  devices: (state: MeshCentralControlState): Device[] => selectDevices(state.devices),
  groups: (state: MeshCentralControlState): DeviceGroup[] => selectGroups(state.groups),
  events: (state: MeshCentralControlState): MeshCentralEvent[] => state.events,
  userInfo: (state: MeshCentralControlState): UserInfo | undefined => state.userInfo,
  serverInfo: (state: MeshCentralControlState): ServerInfo | undefined => state.serverInfo,
  deviceCount: (state: MeshCentralControlState) => Object.keys(state.devices).length,
  onlineDeviceCount: (state: MeshCentralControlState) =>
    Object.values(state.devices).filter((device) => device.online).length,
};
