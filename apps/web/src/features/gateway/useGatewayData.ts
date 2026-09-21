import { gatewaySelectors, useGatewayStore } from '@meshcentral/shared-state';
import { useGateway } from './GatewayProvider';

const statusMap = {
  idle: { color: 'default' },
  connecting: { color: 'processing' },
  connected: { color: 'success' },
  reconnecting: { color: 'warning' },
  disconnected: { color: 'default' },
  error: { color: 'error' },
} as const;

export function useConnectionSummary() {
  const { store, configured } = useGateway();
  const status = useGatewayStore(store, gatewaySelectors.status);
  return configured
    ? { status, color: statusMap[status].color }
    : { status: 'notConfigured' as const, color: 'warning' as const };
}

export function useGatewayData() {
  const gateway = useGateway();
  const devices = useGatewayStore(gateway.store, gatewaySelectors.devices);
  const groups = useGatewayStore(gateway.store, gatewaySelectors.groups);
  const events = useGatewayStore(gateway.store, gatewaySelectors.events);
  const status = useGatewayStore(gateway.store, gatewaySelectors.status);
  const error = useGatewayStore(gateway.store, gatewaySelectors.error);
  const userInfo = useGatewayStore(gateway.store, gatewaySelectors.userInfo);
  const serverInfo = useGatewayStore(gateway.store, gatewaySelectors.serverInfo);
  const reconnectAttempt = useGatewayStore(gateway.store, gatewaySelectors.reconnectAttempt);
  const lastConnectedAt = useGatewayStore(gateway.store, (state) => state.lastConnectedAt);
  const lastMessageAt = useGatewayStore(gateway.store, (state) => state.lastMessageAt);
  return {
    ...gateway,
    devices,
    groups,
    events,
    userInfo,
    serverInfo,
    status,
    error,
    reconnectAttempt,
    lastConnectedAt,
    lastMessageAt,
  };
}
