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
  'events.messages.deviceOnline': '设备已上线',
  'events.messages.unknown': '{{type}}事件',
  'events.types.agentLog': 'Agent 日志',
};
const t = ((key: string, options?: Record<string, unknown>) =>
  (labels[key] ?? key).replace(/\{\{(\w+)\}\}/g, (_match, name: string) =>
    String(options?.[name] ?? ''),
  )) as TFunction;

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

  it('falls back to the server message when no translator is provided', () => {
    expect(eventMessage(event({ message: 'Download: C:\\test.txt' }))).toBe('Download: C:\\test.txt');
    expect(eventMessage(event())).toBe('—');
  });

  it('localizes known event kinds and falls back to the raw message', () => {
    expect(eventMessage(event({ type: 'deviceOnline', message: 'node//1 connected' }), t)).toBe(
      '设备已上线',
    );
    expect(eventMessage(event({ message: 'Download: C:\\test.txt' }), t)).toBe(
      'Download: C:\\test.txt',
    );
    expect(eventMessage(event(), t)).toBe('Agent 日志事件');
  });

  it('redacts identifiers when device context is available', () => {
    expect(
      eventMessage(
        event({ type: 'agentLog', message: 'Node node//1 connected' }),
        undefined,
        { devices: [{ id: 'node//1', name: 'Web Server A', online: true }] },
      ),
    ).toBe('Node Web Server A connected');
  });

  it('hides offline history and preserves server action filters', () => {
    expect(isHistoricalEventVisible(event({ type: 'deviceOffline' }))).toBe(false);
    expect(historicalEventMatches(event({ action: 'agentlog' }), 'agentlog')).toBe(true);
    expect(historicalEventMatches(event({ action: 'agentlog' }), 'relaylog')).toBe(false);
    expect(historicalEventMatches(event({ type: 'deviceOffline', action: 'agentlog' }))).toBe(false);
    expect(historicalEventMatches(event({ action: 'deletenode' }), 'removenode')).toBe(true);
  });
});
