import { describe, expect, it } from 'vitest';
import type { Device, DeviceGroup, GatewayEvent } from './types';
import { formatEventMessage, getEventTargetName, isIdString } from './utils';

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

    const eventWithName: GatewayEvent = {
      id: 'e1',
      type: 'deviceOnline',
      deviceId: 'node//111',
      deviceName: '机房53号节点',
      occurredAt: new Date().toISOString(),
    };

    const eventWithRawIdName: GatewayEvent = {
      id: 'e2',
      type: 'deviceOffline',
      deviceId: 'node//111',
      deviceName: 'node//111',
      occurredAt: new Date().toISOString(),
    };

    const eventUnknownDev: GatewayEvent = {
      id: 'e3',
      type: 'deviceOffline',
      deviceId: 'node//999',
      occurredAt: new Date().toISOString(),
    };

    expect(getEventTargetName(eventWithName, devices)).toBe('机房53号节点');
    expect(getEventTargetName(eventWithRawIdName, devices)).toBe('机房53号节点');
    expect(getEventTargetName(eventUnknownDev, devices)).toBeUndefined();
  });

  it('formats event messages replacing node// and mesh// IDs with names or fallback terms', () => {
    const devices: Device[] = [{ id: 'node//111', name: 'Web Server A', online: true }];
    const groups: DeviceGroup[] = [{ id: 'mesh//100', name: '华东服务器组' }];

    const event1: GatewayEvent = {
      id: 'e1',
      type: 'deviceOnline',
      deviceId: 'node//111',
      message: 'Node node//111 connected to mesh//100',
      occurredAt: new Date().toISOString(),
    };

    const event2: GatewayEvent = {
      id: 'e2',
      type: 'unknown',
      deviceId: 'node//999',
      message: 'Upload: "C:/app.exe", Size: 1000 to mesh//999',
      occurredAt: new Date().toISOString(),
    };

    const eventEmpty: GatewayEvent = {
      id: 'e3',
      type: 'deviceOnline',
      occurredAt: new Date().toISOString(),
    };

    const eventStarted: GatewayEvent = {
      id: 'e4',
      type: 'relayLog',
      deviceId: 'node//111',
      message: 'Started desktop session "r1fj8y9yd58" from 172.18.0.1 to 172.18.0.1',
      occurredAt: new Date().toISOString(),
    };

    const eventStartedWithoutPrompt: GatewayEvent = {
      id: 'e5',
      type: 'relayLog',
      deviceId: 'node//111',
      message: 'Started remote desktop without prompt "r1fj8y9yd58" from 172.18.0.1 to 172.18.0.1',
      occurredAt: new Date().toISOString(),
    };

    expect(formatEventMessage(event1, devices, groups)).toBe('设备已上线');
    expect(formatEventMessage(event2, devices, groups)).toBe(
      '上传文件: "C:/app.exe", 大小: 1000 至 设备组',
    );
    expect(formatEventMessage(eventEmpty, devices, groups)).toBe('设备已上线');
    expect(formatEventMessage(eventStarted, devices, groups)).toBe(
      '开始远程桌面会话 "r1fj8y9yd58" 来自 172.18.0.1 至 172.18.0.1',
    );
    expect(formatEventMessage(eventStartedWithoutPrompt, devices, groups)).toBe(
      '开始远程桌面 无提示 "r1fj8y9yd58" 来自 172.18.0.1 至 172.18.0.1',
    );
  });
});
