import type { MeshCentralEvent } from '@meshcentral/control-client';
import { describe, expect, it } from 'vitest';
import { filterMatches } from './DeviceLogsPanel';

function event(overrides: Partial<MeshCentralEvent> = {}): MeshCentralEvent {
  return {
    id: 'event-1',
    type: 'deviceOnline',
    occurredAt: '2026-10-09T00:00:00.000Z',
    ...overrides,
  };
}

describe('filterMatches', () => {
  it('excludes device offline events from the log list', () => {
    const offlineEvent = event({ type: 'deviceOffline', action: 'offline' });

    expect(filterMatches(offlineEvent)).toBe(false);
    expect(filterMatches(offlineEvent, 'agentlog')).toBe(false);
  });

  it('preserves the existing action filter behavior for other events', () => {
    expect(filterMatches(event())).toBe(true);
    expect(filterMatches(event({ type: 'agentLog', action: 'agentlog' }), 'agentlog')).toBe(true);
    expect(filterMatches(event({ type: 'agentLog', action: 'agentlog' }), 'relaylog')).toBe(false);
  });
});