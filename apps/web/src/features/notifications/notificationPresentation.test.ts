import { describe, expect, it } from 'vitest';
import { createTestI18n } from '../../i18n/testI18n';
import { notificationGroup, presentNotification } from './notificationPresentation';

describe('notification presentation', () => {
  it('prefers local templates and safely replaces positional arguments', () => {
    const i18n = createTestI18n('en-US');
    expect(
      presentNotification(
        {
          id: 'one',
          source: 'security',
          title: '<b>Server title</b>',
          message: '<img src=x onerror=alert(1)>',
          titleId: 3,
          messageId: 12,
          args: [3],
          occurredAt: '2026-10-05T00:00:00.000Z',
          severity: 'warning',
          read: false,
          raw: {},
        },
        i18n.t,
      ),
    ).toEqual({
      title: 'Security Warning',
      message: 'There have been 3 failed login attempts on this account since the last login.',
    });
  });

  it('falls back to server plain text and groups calendar days', () => {
    const i18n = createTestI18n('en-US');
    expect(
      presentNotification(
        {
          id: 'one',
          source: 'msg-notify',
          title: 'Server title',
          message: 'Server message',
          occurredAt: '2026-10-05T00:00:00.000Z',
          severity: 'info',
          read: false,
          raw: {},
        },
        i18n.t,
      ),
    ).toEqual({ title: 'Server title', message: 'Server message' });
    const now = new Date('2026-10-05T12:00:00.000Z');
    expect(notificationGroup('2026-10-05T01:00:00.000Z', now)).toBe('today');
    expect(notificationGroup('2026-10-04T01:00:00.000Z', now)).toBe('yesterday');
    expect(notificationGroup('2026-09-30T01:00:00.000Z', now)).toBe('earlier');
  });
});
