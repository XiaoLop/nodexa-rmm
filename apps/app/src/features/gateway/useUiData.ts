import { gatewaySelectors, useGatewayStore } from '@meshcentral/shared-state';
import { demoDevices, demoEvents, demoGroups } from '../../demoData';
import { useGatewayData } from './useGatewayData';

export function useUiData() {
  const gateway = useGatewayData();
  const liveGroups = useGatewayStore(gateway.store, gatewaySelectors.groups);
  const hasLiveData = gateway.devices.length > 0 || liveGroups.length > 0;

  return {
    ...gateway,
    devices: hasLiveData ? gateway.devices : demoDevices,
    groups: hasLiveData ? liveGroups : demoGroups,
    events: hasLiveData ? gateway.events : demoEvents,
    isDemo: !hasLiveData,
  };
}
