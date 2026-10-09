import type { MeshCentralEvent } from '@meshcentral/control-client';
import { describe, expect, it } from 'vitest';
import { isDashboardEventVisible } from './dashboardEvents';

function event(type: MeshCentralEvent['type']): MeshCentralEvent {
  return {
    id: `event-${type}`,
    type,
    occurredAt: '2026-10-09T00:00:00.000Z',
  };
}

describe('isDashboardEventVisible', () => {
  it('excludes device offline notifications from the dashboard event feed', () => {
    expect(isDashboardEventVisible(event('deviceOffline'))).toBe(false);
  });

  it('keeps other log events visible', () => {
    expect(isDashboardEventVisible(event('deviceOnline'))).toBe(true);
    expect(isDashboardEventVisible(event('agentLog'))).toBe(true);
    expect(isDashboardEventVisible(event('commandExecution'))).toBe(true);
  });
});