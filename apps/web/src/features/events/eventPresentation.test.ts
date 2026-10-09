import type { MeshCentralEvent } from '@meshcentral/control-client';
import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';
import {
  eventActionLabel,
  eventEntityTypeLabel,
  eventMessage,
  historicalEventMatches,
  isHistoricalEventVisible,
} from './eventPresentation';

const labels: Record<string, string> = {
  'events.entityTypes.node': '设备',
  'events.entityTypes.unclassified': '通用/未分类',
  'events.actions.agentlog': 'Agent 日志',
  'events.actions.undefined': '未定义',
};
const t = ((key: string) => labels[key] ?? key) as TFunction;

function event(overrides: Partial<MeshCentralEvent> = {}): MeshCentralEvent {
  return {
    id: 'event-1',
    type: 'agentLog',
    occurredAt: '2026-10-09T00:00:00.000Z',
    ...overrides,
  };
}

describe('event presentation', () => {
  it('labels known, unknown, and missing entity types', () => {
    expect(eventEntityTypeLabel(event({ entityType: 'node' }), t)).toBe('设备');
    expect(eventEntityTypeLabel(event({ entityType: 'plugin-resource' }), t)).toBe('plugin-resource');
    expect(eventEntityTypeLabel(event(), t)).toBe('通用/未分类');
  });

  it('labels known, unknown, and missing actions', () => {
    expect(eventActionLabel(event({ action: 'agentlog' }), t)).toBe('Agent 日志');
    expect(eventActionLabel(event({ action: 'plugin-action' }), t)).toBe('plugin-action');
    expect(eventActionLabel(event(), t)).toBe('未定义');
  });

  it('returns the server event message without localization', () => {
    expect(eventMessage(event({ message: 'Download: C:\\test.txt' }))).toBe('Download: C:\\test.txt');
    expect(eventMessage(event())).toBe('—');
  });

  it('hides offline history and preserves server action filters', () => {
    expect(isHistoricalEventVisible(event({ type: 'deviceOffline' }))).toBe(false);
    expect(historicalEventMatches(event({ action: 'agentlog' }), 'agentlog')).toBe(true);
    expect(historicalEventMatches(event({ action: 'agentlog' }), 'relaylog')).toBe(false);
    expect(historicalEventMatches(event({ type: 'deviceOffline', action: 'agentlog' }))).toBe(false);
    expect(historicalEventMatches(event({ action: 'deletenode' }), 'removenode')).toBe(true);
  });
});