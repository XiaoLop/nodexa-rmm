import { gatewaySelectors, useGatewayStore } from '@meshcentral/shared-state';
import { useGateway } from './GatewayProvider';

const statusMap = {
  idle: { label: '待连接', color: 'default' },
  connecting: { label: '连接中', color: 'processing' },
  connected: { label: '已连接', color: 'success' },
  reconnecting: { label: '重连中', color: 'warning' },
  disconnected: { label: '已断开', color: 'default' },
  error: { label: '连接异常', color: 'error' },
} as const;

export function useConnectionSummary() {
  const { store, configured } = useGateway();
  const status = useGatewayStore(store, gatewaySelectors.status);
  return configured
    ? { status: statusMap[status].label, color: statusMap[status].color }
    : { status: '未配置', color: 'warning' as const };
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
