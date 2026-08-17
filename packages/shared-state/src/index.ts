export { GatewayClient, type GatewayClientOptions } from './client';
export { meshCentralGatewayAdapter } from './protocol';
export { useGatewayStore } from './react';
export { createGatewayStore, gatewaySelectors, type GatewayStore } from './store';
export type {
  CloseEventLike,
  ConnectionStatus,
  Device,
  DeviceGroup,
  GatewayEvent,
  GatewayEventType,
  GatewayMutation,
  GatewayProtocolAdapter,
  GatewaySnapshot,
  GatewayState,
  MessageEventLike,
  WebSocketFactory,
  WebSocketLike,
} from './types';
