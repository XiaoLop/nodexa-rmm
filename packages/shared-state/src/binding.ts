import {
  normalizeDevice,
  type ConnectionStatus as ClientConnectionStatus,
  type MeshCentralClient,
  type MeshCentralEvent,
} from '@meshcentral/control-client';
import type { MeshCentralControlStore } from './store';
import type { ConnectionStatus } from './types';

export interface MeshCentralClientBinding {
  sync(): Promise<void>;
  dispose(): void;
}

function stateStatus(status: ClientConnectionStatus): ConnectionStatus {
  if (status === 'authenticating') return 'connecting';
  if (status === 'destroyed') return 'disconnected';
  return status;
}

function applyEvent(store: MeshCentralControlStore, event: MeshCentralEvent): void {
  const state = store.getState();
  if (event.type === 'deviceRemoved' && event.deviceId) {
    state.removeDevice(event.deviceId);
    state.appendEvent(event);
    return;
  }

  if (event.type === 'deviceOnline' || event.type === 'deviceOffline') {
    if (!event.deviceId) return;
    const raw = event.raw as Record<string, unknown> | undefined;
    const device = normalizeDevice(raw?.node ?? raw?.device, event.deviceId);
    const current = state.devices[event.deviceId];
    state.upsertDevice({
      ...(current ?? { id: event.deviceId, name: event.deviceId, online: false }),
      ...(device ?? {}),
      id: event.deviceId,
      name: device?.name ?? current?.name ?? event.deviceName ?? event.deviceId,
      online: event.type === 'deviceOnline',
      lastSeenAt:
        event.type === 'deviceOffline'
          ? event.occurredAt
          : (device?.lastSeenAt ?? current?.lastSeenAt),
    });
    state.appendEvent(event);
    return;
  }

  if (event.type === 'deviceChanged' && event.deviceId) {
    const raw = event.raw as Record<string, unknown> | undefined;
    const rawDevice = raw?.node ?? raw?.device;
    const device = normalizeDevice(rawDevice, event.deviceId);
    if (device) {
      const hasConnectionState =
        typeof rawDevice === 'object' &&
        rawDevice !== null &&
        (typeof (rawDevice as Record<string, unknown>).online === 'boolean' ||
          typeof (rawDevice as Record<string, unknown>).conn === 'number');
      state.upsertDevice(
        hasConnectionState
          ? device
          : { ...device, online: state.devices[event.deviceId]?.online ?? false },
      );
    }
    return;
  }

  state.appendEvent(event);
}

export function bindMeshCentralClient(
  store: MeshCentralControlStore,
  client: MeshCentralClient,
): MeshCentralClientBinding {
  let active = true;
  let syncGeneration = 0;
  const notificationTimers = new Map<string, ReturnType<typeof setTimeout>>();

  const clearNotificationTimers = () => {
    for (const timer of notificationTimers.values()) clearTimeout(timer);
    notificationTimers.clear();
  };

  const scheduleNotificationExpiry = (id: string, expiresAt?: string) => {
    if (!expiresAt) return;
    const delay = Date.parse(expiresAt) - Date.now();
    if (!Number.isFinite(delay)) return;
    if (delay <= 0) {
      store.getState().removeNotification(id);
      return;
    }
    const existing = notificationTimers.get(id);
    if (existing) clearTimeout(existing);
    notificationTimers.set(
      id,
      setTimeout(() => {
        notificationTimers.delete(id);
        if (active) store.getState().removeExpiredNotifications();
      }, delay),
    );
  };

  const sync = async () => {
    const generation = ++syncGeneration;
    try {
      const [devices, groups, lastSeenByDeviceId] = await Promise.all([
        client.devices.list(),
        client.groups.list(),
        client.devices.lastConnects(),
      ]);
      if (!active || generation !== syncGeneration) return;
      store.getState().replaceDevices(
        devices.map((device) => ({
          ...device,
          lastSeenAt: lastSeenByDeviceId[device.id] ?? device.lastSeenAt,
        })),
      );
      store.getState().replaceGroups(groups);
      store.getState().setCacheStale(false);
      store.getState().setError(undefined);
    } catch (error) {
      if (!active || generation !== syncGeneration) return;
      store
        .getState()
        .setError(
          error instanceof Error ? error.message : 'Gateway snapshot synchronization failed.',
        );
    }
  };

  const unsubscribers = [
    client.on('connection', ({ current, error }) => {
      if (!active) return;
      if (current === 'connecting' || current === 'reconnecting') {
        syncGeneration += 1;
        store.getState().setCacheStale(true);
      }
      store.getState().setConnectionStatus(stateStatus(current), error?.message);
      store.getState().setReconnectAttempt(client.currentReconnectAttempt);
      if (current === 'connected') void sync();
    }),
    client.on('message', () => {
      if (active) store.getState().touchMessage();
    }),
    client.on('message', (message) => {
      if (
        !active ||
        typeof message !== 'object' ||
        message === null ||
        (message as Record<string, unknown>).action !== 'intersession' ||
        (message as Record<string, unknown>).subaction !== 'removeNotify'
      ) {
        return;
      }
      const id = (message as Record<string, unknown>).id;
      if (typeof id === 'string' || typeof id === 'number') {
        const notificationId = String(id);
        const timer = notificationTimers.get(notificationId);
        if (timer) clearTimeout(timer);
        notificationTimers.delete(notificationId);
        store.getState().removeNotification(notificationId);
      }
    }),
    client.on('event', (event) => {
      if (active) applyEvent(store, event);
    }),
    client.on('notification', (notification) => {
      if (!active) return;
      const state = store.getState();
      if (state.notifications.some((item) => item.id === notification.id)) return;
      state.addNotification(notification);
      scheduleNotificationExpiry(
        notification.id,
        store.getState().notifications.find((item) => item.id === notification.id)?.expiresAt,
      );
    }),
    client.on('serverWarnings', (warnings) => {
      if (active) store.getState().replaceServerWarnings(warnings);
    }),
    client.on('deviceSessions', (sessions) => {
      if (active) store.getState().applyDeviceSessions(sessions);
    }),
    client.on('termination', (termination) => {
      if (!active) return;
      clearNotificationTimers();
      store.getState().setTermination(termination);
      store.getState().clearSensitiveState();
    }),
    client.on('accountChanged', (userInfo) => {
      if (!active || store.getState().userInfo?.id !== userInfo.id) return;
      store.getState().applyAccountChanged(userInfo);
    }),
    client.on('userInfo', (userInfo) => {
      if (active) store.getState().setUserInfo(userInfo);
    }),
    client.on('serverInfo', (serverInfo) => {
      if (active) store.getState().setServerInfo(serverInfo);
    }),
    client.on('error', (error) => {
      if (active) store.getState().setError(error.message);
    }),
  ];

  return {
    sync,
    dispose() {
      if (!active) return;
      active = false;
      syncGeneration += 1;
      clearNotificationTimers();
      for (const unsubscribe of unsubscribers) unsubscribe();
    },
  };
}
