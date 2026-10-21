import { describe, expect, it } from 'vitest';
import type { Device, DeviceGroup, MeshCentralEvent } from './types';
import {
  REDACTED_ID,
  formatEventMessage,
  getEventTargetName,
  isIdString,
  redactEventMessage,
} from './utils';

function event(overrides: Partial<MeshCentralEvent> = {}): MeshCentralEvent {
  return {
    id: 'event-1',
    type: 'unknown',
    occurredAt: '2026-10-09T00:00:00.000Z',
    ...overrides,
  };
}

describe('utils: event formatting and ID masking', () => {
  it('identifies node, mesh, and user ID strings correctly', () => {
    expect(isIdString('node//xyz123')).toBe(true);
    expect(isIdString('mesh//group456')).toBe(true);
    expect(isIdString('user//admin')).toBe(true);
    expect(isIdString('NODE//ABC')).toBe(true);
    expect(isIdString('机房服务器53')).toBe(false);
    expect(isIdString(undefined)).toBe(false);
  });

  it('returns valid device name and masks raw IDs', () => {
    const devices: Device[] = [
      { id: 'node//111', name: '机房53号节点', online: true },
      { id: 'node//222', name: 'node//222', online: false },
    ];

    const eventWithName = event({
      type: 'deviceOnline',
      deviceId: 'node//111',
      deviceName: '机房53号节点',
    });
    const eventWithRawIdName = event({
      type: 'deviceOffline',
      deviceId: 'node//111',
      deviceName: 'node//111',
    });
    const eventUnknownDev = event({ type: 'deviceOffline', deviceId: 'node//999' });

    expect(getEventTargetName(eventWithName, devices)).toBe('机房53号节点');
    expect(getEventTargetName(eventWithRawIdName, devices)).toBe('机房53号节点');
    expect(getEventTargetName(eventUnknownDev, devices)).toBeUndefined();
  });

  it('classifies known device events without embedding presentation text', () => {
    expect(redactEventMessage(event({ type: 'deviceOnline' })).kind).toBe('deviceOnline');
    expect(redactEventMessage(event({ type: 'deviceOffline' })).kind).toBe('deviceOffline');
    expect(redactEventMessage(event({ type: 'deviceChanged' })).kind).toBe('deviceChanged');
    expect(redactEventMessage(event({ type: 'deviceRemoved' })).kind).toBe('deviceRemoved');
    expect(redactEventMessage(event({ type: 'agentLog', message: 'hello' })).kind).toBe('raw');
    expect(redactEventMessage(event({ type: 'unknown' })).kind).toBe('unknown');
  });

  it('classifies message-only events the same way for backwards compatibility', () => {
    expect(redactEventMessage(event({ message: 'nodeconnect' })).kind).toBe('deviceOnline');
    expect(redactEventMessage(event({ message: 'nodedisconnect' })).kind).toBe('deviceOffline');
    expect(redactEventMessage(event({ message: 'changenode' })).kind).toBe('deviceChanged');
    expect(redactEventMessage(event({ message: 'deletenode' })).kind).toBe('deviceRemoved');
  });

  it('replaces identifiers with names and a neutral placeholder', () => {
    const devices: Device[] = [{ id: 'node//111', name: 'Web Server A', online: true }];
    const groups: DeviceGroup[] = [{ id: 'mesh//100', name: '华东服务器组' }];

    const known = redactEventMessage(
      event({
        type: 'unknown',
        deviceId: 'node//111',
        message: 'Node node//111 connected to mesh//100',
      }),
      devices,
      groups,
    );
    expect(known.text).toBe('Node Web Server A connected to 华东服务器组');

    const unresolved = redactEventMessage(
      event({
        type: 'unknown',
        deviceId: 'node//999',
        message: 'Node node//999 connected to mesh//999 by user//domain/admin',
      }),
      devices,
      groups,
    );
    expect(unresolved.text).toBe(
      `Node ${REDACTED_ID} connected to ${REDACTED_ID} by domain/admin`,
    );
  });

  it('keeps the deprecated formatter free of localized wording', () => {
    const devices: Device[] = [{ id: 'node//111', name: 'Web Server A', online: true }];
    expect(
      formatEventMessage(event({ type: 'deviceOnline', deviceId: 'node//111' }), devices),
    ).toBe('—');
    expect(formatEventMessage(event({ message: 'Download: C:\\test.txt' }))).toBe(
      'Download: C:\\test.txt',
    );
    expect(formatEventMessage(event())).toBe('—');
  });
});
