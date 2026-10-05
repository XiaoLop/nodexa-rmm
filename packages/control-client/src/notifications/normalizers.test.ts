import { describe, expect, it, vi } from 'vitest';
import {
  normalizeDeviceSessions,
  normalizeNotification,
  normalizeRecordingReady,
  normalizeServerWarnings,
} from './normalizers';

describe('notification normalizers', () => {
  it('normalizes event and direct notifications with stable identifiers', () => {
    const eventNotification = {
      action: 'event',
      event: {
        action: 'notify',
        title: 'Email verified',
        value: 'user@example.com',
        id: 0.4918237194,
      },
    };
    expect(normalizeNotification(eventNotification)).toMatchObject({
      id: '0.4918237194',
      source: 'event-notify',
      title: 'Email verified',
      message: 'user@example.com',
      severity: 'info',
    });

    const withoutId = {
      action: 'msg',
      type: 'notify',
      titleid: 3,
      msgid: 12,
      args: [3],
      value: 'Three failed login attempts.',
    };
    expect(normalizeNotification(withoutId)?.id).toBe(normalizeNotification(withoutId)?.id);
    expect(normalizeNotification(withoutId)).toMatchObject({
      source: 'security',
      titleId: 3,
      messageId: 12,
      args: [3],
      severity: 'warning',
    });
  });

  it('recognizes help and chat requests', () => {
    expect(normalizeNotification({
      action: 'event',
      event: {
        action: 'agentlog',
        nodeid: 'node//one',
        msgid: 98,
        msgArgs: ['Alice', 'Need help'],
        msg: 'Help Requested',
      },
    })).toMatchObject({
      source: 'help-request',
      deviceId: 'node//one',
      args: ['Alice', 'Need help'],
    });
    expect(normalizeNotification({
      action: 'msg',
      type: 'notify',
      msgid: 11,
      tag: 'meshmessenger/user//alice/user//bob',
    })).toMatchObject({ source: 'chat-request' });
  });

  it('normalizes dedicated warning, session and recording messages', () => {
    expect(normalizeServerWarnings({
      action: 'serverwarnings',
      warnings: [{ id: 3, msg: 'TLS certificate expires soon', args: [7] }],
    })).toMatchObject([{ id: 3, message: 'TLS certificate expires soon', args: [7] }]);
    expect(normalizeDeviceSessions({
      action: 'event',
      event: {
        action: 'devicesessions',
        nodeid: 'node//one',
        sessions: { help: { Alice: 'Need help', Invalid: 5 } },
      },
    })).toMatchObject({ deviceId: 'node//one', help: { Alice: 'Need help' } });
    expect(normalizeRecordingReady({
      action: 'event',
      event: {
        action: 'recording',
        nodeid: 'node//one',
        filename: 'session.mcrec',
        size: 42,
        lengthTime: 15,
      },
    })).toMatchObject({
      deviceId: 'node//one',
      filename: 'session.mcrec',
      sizeBytes: 42,
      durationSeconds: 15,
    });
  });

  it('preserves maxtime as seconds', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-10-05T00:00:00.000Z'));
      expect(normalizeNotification({
        action: 'msg',
        type: 'notify',
        value: 'Temporary',
        maxtime: 30,
      })).toMatchObject({ maxTimeSeconds: 30, occurredAt: '2026-10-05T00:00:00.000Z' });
    } finally {
      vi.useRealTimers();
    }
  });
});