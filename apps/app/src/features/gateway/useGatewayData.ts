import { gatewaySelectors, useGatewayStore } from '@meshcentral/shared-state';
import { useGateway } from './GatewayProvider';

export function useGatewayData() {
  const gateway = useGateway();
  const devices = useGatewayStore(gateway.store, gatewaySelectors.devices);
  const events = useGatewayStore(gateway.store, gatewaySelectors.events);
  const status = useGatewayStore(gateway.store, gatewaySelectors.status);
  const error = useGatewayStore(gateway.store, gatewaySelectors.error);
  return { ...gateway, devices, events, status, error };
}
