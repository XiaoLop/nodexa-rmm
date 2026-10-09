import type { HistoricalEventFilter, MeshCentralEvent } from '@meshcentral/control-client';

export function realtimeEventMatches(
  event: MeshCentralEvent,
  filter?: HistoricalEventFilter,
) {
  if (event.type === 'deviceOffline') return false;
  if (!filter) return true;
  if (filter === 'removenode') {
    return event.action === 'removenode' || event.action === 'deletenode';
  }
  return event.action === filter;
}