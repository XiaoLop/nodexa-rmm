import type { MeshCentralEvent } from '@meshcentral/control-client';
import { describe, expect, it } from 'vitest';
import { realtimeEventMatches } from './realtimeEvents';

function event(overrides: Partial<MeshCentralEvent> = {}): MeshCentralEvent {
  return {
    id: 'event-1',
    type: 'deviceOnline',
    occurredAt: '2026-10-09T00:00:00.000Z',
    ...overrides,
  };
}

describe('realtimeEventMatches', () => {
  it('excludes device offline events from all realtime event views', () => {
    const offlineEvent = event({ type: 'deviceOffline', action: 'agentlog' });

    expect(realtimeEventMatches(offlineEvent)).toBe(false);
    expect(realtimeEventMatches(offlineEvent, 'agentlog')).toBe(false);
  });

  it('preserves action filtering for other events', () => {
    expect(realtimeEventMatches(event())).toBe(true);
    expect(realtimeEventMatches(event({ type: 'agentLog', action: 'agentlog' }), 'agentlog')).toBe(true);
    expect(realtimeEventMatches(event({ type: 'agentLog', action: 'agentlog' }), 'relaylog')).toBe(false);
  });
});