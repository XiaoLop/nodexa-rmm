export { GatewayClient } from './client/GatewayClient';
export * from './errors';
export * from './types';
export {
  normalizeDevice,
  normalizeDevices,
  normalizeEvent,
  normalizeGroup,
  normalizeGroups,
  normalizeLastConnects,
  normalizeUserInfo,
  timestampValue,
} from './protocol/normalizers';
export { DevicesResource } from './resources/devices';
export { GroupsResource } from './resources/groups';
export { EventsResource } from './resources/events';
