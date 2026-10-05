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
        store.getState().clearAuthorizationSnapshot();
      }
      store.getState().setConnectionStatus(stateStatus(current), error?.message);
      store.getState().setReconnectAttempt(client.currentReconnectAttempt);
      if (current === 'connected') void sync();
    }),
    client.on('message', () => {
      if (active) store.getState().touchMessage();
    }),
    client.on('event', (event) => {
      if (active) applyEvent(store, event);
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
      for (const unsubscribe of unsubscribers) unsubscribe();
    },
  };
}
