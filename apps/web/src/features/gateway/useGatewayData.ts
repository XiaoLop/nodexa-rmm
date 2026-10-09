import { meshCentralControlSelectors, useMeshCentralControlStore } from '@meshcentral/shared-state';
import { useMeshCentralControl } from './MeshCentralControlProvider';

const statusMap = {
  idle: { color: 'default' },
  connecting: { color: 'processing' },
  connected: { color: 'success' },
  reconnecting: { color: 'warning' },
  disconnected: { color: 'default' },
  error: { color: 'error' },
} as const;

export function useConnectionSummary() {
  const { store, configured } = useMeshCentralControl();
  const status = useMeshCentralControlStore(store, meshCentralControlSelectors.status);
  return configured
    ? { status, color: statusMap[status].color }
    : { status: 'notConfigured' as const, color: 'warning' as const };
}

export function useMeshCentralControlData() {
  const gateway = useMeshCentralControl();
  const devices = useMeshCentralControlStore(gateway.store, meshCentralControlSelectors.devices);
  const groups = useMeshCentralControlStore(gateway.store, meshCentralControlSelectors.groups);
  const status = useMeshCentralControlStore(gateway.store, meshCentralControlSelectors.status);
  const error = useMeshCentralControlStore(gateway.store, meshCentralControlSelectors.error);
  const userInfo = useMeshCentralControlStore(gateway.store, meshCentralControlSelectors.userInfo);
  const serverInfo = useMeshCentralControlStore(gateway.store, meshCentralControlSelectors.serverInfo);
  const reconnectAttempt = useMeshCentralControlStore(gateway.store, meshCentralControlSelectors.reconnectAttempt);
  const lastConnectedAt = useMeshCentralControlStore(gateway.store, (state) => state.lastConnectedAt);
  const lastMessageAt = useMeshCentralControlStore(gateway.store, (state) => state.lastMessageAt);
  return {
    ...gateway,
    devices,
    groups,
    userInfo,
    serverInfo,
    status,
    error,
    reconnectAttempt,
    lastConnectedAt,
    lastMessageAt,
  };
}
