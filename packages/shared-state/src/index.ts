export { GatewayAuthenticationError, GatewayClient, type GatewayClientOptions } from './client';
export { meshCentralGatewayAdapter } from './protocol';
export { useGatewayStore } from './react';
export { createGatewayStore, gatewaySelectors, type GatewayStore } from './store';
export { getGreetingTime, getUserDisplayName } from './userHelpers';
export * from './utils';
export type {
  CloseEventLike,
  ConnectionStatus,
  Device,
  DeviceGroup,
  GatewayConnectionResult,
  GatewayEvent,
  GatewayEventType,
  GatewayMutation,
  GatewayProtocolAdapter,
  GatewaySnapshot,
  GatewayState,
  MessageEventLike,
  WebSocketFactory,
  WebSocketLike,
  UserInfo,
} from './types';
export * from './types/events.type';
