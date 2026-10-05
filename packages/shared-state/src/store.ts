import { createStore, type StoreApi } from 'zustand/vanilla';
import {
  resolveEffectiveDeviceGroupRightsResult,
  resolveEffectiveDeviceRightsResult,
} from '@meshcentral/control-client';
import type {
  Device,
  DeviceGroup,
  DeviceSessions,
  MeshCentralNotification,
  MeshCentralEvent,
  MeshCentralControlState,
  ServerInfo,
  UserInfo,
} from './types';
import { isIdString } from './utils';

const MAX_EVENTS = 100;
const MAX_NOTIFICATIONS = 200;

function notificationExpiry(notification: MeshCentralNotification): string | undefined {
  if (
    notification.maxTimeSeconds === undefined ||
    !Number.isFinite(notification.maxTimeSeconds) ||
    notification.maxTimeSeconds <= 0
  ) {
    return undefined;
  }
  const occurredAt = Date.parse(notification.occurredAt);
  if (Number.isNaN(occurredAt)) return undefined;
  return new Date(occurredAt + notification.maxTimeSeconds * 1000).toISOString();
}

function unreadCount(notifications: MeshCentralControlState['notifications']): number {
  return notifications.reduce((count, notification) => count + (notification.read ? 0 : 1), 0);
}

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
  notifications: [],
  unreadCount: 0,
  serverWarnings: [],
  helpRequests: {},
  termination: undefined,
  cacheStale: false,
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
          icon: device.icon ?? existing?.icon,
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
    applyAccountChanged: (userInfo) =>
      set((state) => {
        if (state.userInfo?.id !== userInfo.id) return state;
        const raw =
          typeof userInfo.raw === 'object' && userInfo.raw !== null
            ? (userInfo.raw as Record<string, unknown>)
            : undefined;
        const hasLinks = raw !== undefined && Object.hasOwn(raw, 'links');
        const mergedUserInfo: UserInfo = {
          ...state.userInfo,
          ...userInfo,
          links: hasLinks ? userInfo.links : state.userInfo.links,
          notify: Object.hasOwn(raw ?? {}, 'notify') ? userInfo.notify : state.userInfo.notify,
          removeRights: Object.hasOwn(raw ?? {}, 'removeRights')
            ? userInfo.removeRights
            : state.userInfo.removeRights,
        };
        if (!hasLinks) return { userInfo: mergedUserInfo };

        const groups = Object.fromEntries(
          Object.entries(state.groups).filter(([, group]) => {
            const result = resolveEffectiveDeviceGroupRightsResult(
              group,
              mergedUserInfo,
              state.serverInfo,
            );
            return result.status !== 'resolved' || result.rights !== 0;
          }),
        );
        const devices = Object.fromEntries(
          Object.entries(state.devices).filter(([, device]) => {
            const result = resolveEffectiveDeviceRightsResult(
              device,
              device.groupId ? groups[device.groupId] : undefined,
              mergedUserInfo,
            );
            return result.status !== 'resolved' || result.rights !== 0;
          }),
        );
        const helpRequests = Object.fromEntries(
          Object.entries(state.helpRequests).filter(([deviceId]) => devices[deviceId] !== undefined),
        );
        const notifications = state.notifications.filter(
          (notification) =>
            notification.deviceId === undefined || devices[notification.deviceId] !== undefined,
        );
        return {
          userInfo: mergedUserInfo,
          groups,
          devices,
          helpRequests,
          notifications,
          unreadCount: unreadCount(notifications),
        };
      }),
    addNotification: (notification) =>
      set((state) => {
        if (state.notifications.some((item) => item.id === notification.id)) return state;
        const notifications = [
          {
            ...notification,
            read: false,
            expiresAt: notificationExpiry(notification),
          },
          ...state.notifications,
        ]
          .sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt))
          .slice(0, MAX_NOTIFICATIONS);
        return { notifications, unreadCount: unreadCount(notifications) };
      }),
    markNotificationRead: (id) =>
      set((state) => {
        const readAt = new Date().toISOString();
        const notifications = state.notifications.map((notification) =>
          notification.id === id && !notification.read
            ? { ...notification, read: true, readAt }
            : notification,
        );
        return { notifications, unreadCount: unreadCount(notifications) };
      }),
    markAllNotificationsRead: () =>
      set((state) => {
        const readAt = new Date().toISOString();
        const notifications = state.notifications.map((notification) =>
          notification.read ? notification : { ...notification, read: true, readAt },
        );
        return { notifications, unreadCount: 0 };
      }),
    removeNotification: (id) =>
      set((state) => {
        const notifications = state.notifications.filter((notification) => notification.id !== id);
        return { notifications, unreadCount: unreadCount(notifications) };
      }),
    clearNotifications: () => set({ notifications: [], unreadCount: 0 }),
    removeExpiredNotifications: (now = new Date().toISOString()) =>
      set((state) => {
        const nowTime = Date.parse(now);
        if (Number.isNaN(nowTime)) return state;
        const notifications = state.notifications.filter(
          (notification) =>
            notification.expiresAt === undefined || Date.parse(notification.expiresAt) > nowTime,
        );
        return { notifications, unreadCount: unreadCount(notifications) };
      }),
    replaceServerWarnings: (serverWarnings) => set({ serverWarnings }),
    applyDeviceSessions: (sessions: DeviceSessions) =>
      set((state) => {
        const helpRequests = { ...state.helpRequests };
        if (Object.keys(sessions.help).length === 0) {
          delete helpRequests[sessions.deviceId];
        } else {
          helpRequests[sessions.deviceId] = {
            deviceId: sessions.deviceId,
            requests: sessions.help,
            updatedAt: sessions.occurredAt,
          };
        }
        return { helpRequests };
      }),
    setTermination: (termination) => set({ termination }),
    setCacheStale: (cacheStale) => set({ cacheStale }),
    clearSensitiveState: () =>
      set({
        devices: {},
        groups: {},
        events: [],
        notifications: [],
        unreadCount: 0,
        serverWarnings: [],
        helpRequests: {},
        userInfo: undefined,
        serverInfo: undefined,
        cacheStale: false,
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
  notifications: (state: MeshCentralControlState) => state.notifications,
  unreadCount: (state: MeshCentralControlState) => state.unreadCount,
  serverWarnings: (state: MeshCentralControlState) => state.serverWarnings,
  helpRequests: (state: MeshCentralControlState) => state.helpRequests,
  termination: (state: MeshCentralControlState) => state.termination,
  cacheStale: (state: MeshCentralControlState) => state.cacheStale,
  userInfo: (state: MeshCentralControlState): UserInfo | undefined => state.userInfo,
  serverInfo: (state: MeshCentralControlState): ServerInfo | undefined => state.serverInfo,
  deviceCount: (state: MeshCentralControlState) => Object.keys(state.devices).length,
  onlineDeviceCount: (state: MeshCentralControlState) =>
    Object.values(state.devices).filter((device) => device.online).length,
};
