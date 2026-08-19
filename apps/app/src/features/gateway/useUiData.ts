import type { UserInfo } from '@meshcentral/shared-state';
import { gatewaySelectors, getGreetingTime, getUserDisplayName, useGatewayStore } from '@meshcentral/shared-state';
import { useGatewayData } from './useGatewayData';

export function useUiData() {
  const gateway = useGatewayData();
  const liveGroups = useGatewayStore(gateway.store, gatewaySelectors.groups);

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
      email: gateway.userInfo?.email,
      siteadmin: gateway.userInfo?.siteadmin,
    },
    isDemo: false,
  };
}
