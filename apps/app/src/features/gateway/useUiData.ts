import {
  meshCentralControlSelectors,
  getGreetingTime,
  getUserDisplayName,
  useMeshCentralControlStore,
} from '@meshcentral/shared-state';
import { useMeshCentralControlData } from './useMeshCentralControlData';

export function useUiData() {
  const gateway = useMeshCentralControlData();
  const liveGroups = useMeshCentralControlStore(gateway.store, meshCentralControlSelectors.groups);

  const displayName = getUserDisplayName(gateway.userInfo, gateway.username);
  const avatarText = displayName ? displayName.charAt(0).toUpperCase() : '用';
  const greetingTime = getGreetingTime();
  const greeting = `${greetingTime}，${displayName}`;

  return {
    ...gateway,
    devices: gateway.devices,
    groups: liveGroups,
    events: gateway.events,
    userInfo: gateway.userInfo,
    currentUser: {
      displayName,
      avatarText,
      greeting,
      greetingTime,
      id: gateway.userInfo?.id,
      username: gateway.username,
      email: gateway.userInfo?.email,
      siteadmin: gateway.userInfo?.siteadmin,
      creationAt: gateway.userInfo?.creationAt,
      lastLoginAt: gateway.userInfo?.lastLoginAt,
      lastAccessAt: gateway.userInfo?.lastAccessAt,
      previousLoginAt: gateway.userInfo?.previousLoginAt,
      language: gateway.userInfo?.language,
    },
    isDemo: false,
  };
}
