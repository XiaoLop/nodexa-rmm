export { bindGatewayClient, type GatewayClientBinding } from './binding';
export { useGatewayStore } from './react';
export { createGatewayStore, gatewaySelectors, type GatewayStore } from './store';
export { getGreetingTime, getUserDisplayName } from './userHelpers';
export * from './utils';
export type {
  ConnectionStatus,
  Device,
  DeviceGroup,
  GatewayEvent,
  GatewayEventType,
  GatewaySnapshot,
  GatewayState,
  UserInfo,
} from './types';
export * from './types/events.type';
