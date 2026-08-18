import { gatewaySelectors, useGatewayStore } from '@meshcentral/shared-state';
import { useGatewayData } from './useGatewayData';

export function useUiData() {
  const gateway = useGatewayData();
  const liveGroups = useGatewayStore(gateway.store, gatewaySelectors.groups);

  return {
    ...gateway,
    devices: gateway.devices,
    groups: liveGroups,
    events: gateway.events,
    isDemo: false,
  };
}
