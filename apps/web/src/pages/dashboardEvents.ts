import type { MeshCentralEvent } from '@meshcentral/control-client';

export function isDashboardEventVisible(event: MeshCentralEvent) {
  return event.type !== 'deviceOffline';
}