import { describe, expect, it } from 'vitest';
import type { NotificationEntry } from '@meshcentral/shared-state';
import { resolveNotificationRoute } from './notificationRouting';

const notification = (overrides: Partial<NotificationEntry>): NotificationEntry => ({
  id: 'one',
  source: 'msg-notify',
  occurredAt: '2026-10-05T00:00:00.000Z',
  severity: 'info',
  read: false,
  raw: {},
  ...overrides,
});

describe('notification routing', () => {
  it('routes known device tags only when the device remains accessible', () => {
    const devices = [{ id: 'node//one', name: 'One', online: true }];
    for (const tag of ['desktop', 'terminal', 'files'] as const) {
      expect(
        resolveNotificationRoute(notification({ deviceId: 'node//one', tag }), devices),
      ).toEqual({
        type: 'internal',
        path: `/devices/node%2F%2Fone/workspace?tab=${tag}`,
      });
    }
    expect(
      resolveNotificationRoute(
        notification({ deviceId: 'node//one', source: 'help-request' }),
        devices,
      ),
    ).toEqual({
      type: 'internal',
      path: '/devices/node%2F%2Fone/workspace?tab=overview',
    });
    expect(
      resolveNotificationRoute(
        notification({ deviceId: 'node//missing', tag: 'terminal' }),
        devices,
      ),
    ).toEqual({ type: 'none' });
    expect(resolveNotificationRoute(notification({}), devices)).toEqual({ type: 'none' });
  });

  it('routes backup codes, messenger and same-origin URLs safely', () => {
    expect(resolveNotificationRoute(notification({ tag: 'backupcodes' }), [])).toEqual({
      type: 'internal',
      path: '/profile?tab=security&action=backup-codes',
    });
    expect(
      resolveNotificationRoute(
        notification({ tag: 'meshmessenger/user//alice', username: 'Alice & Bob' }),
        [],
      ),
    ).toMatchObject({
      type: 'window',
      url: '/messenger?id=meshmessenger%2Fuser%2F%2Falice&title=Alice%20%26%20Bob',
    });
    expect(
      resolveNotificationRoute(
        notification({ targetUrl: '/profile?tab=security' }),
        [],
        'https://console.example.com',
      ),
    ).toEqual({ type: 'internal', path: '/profile?tab=security' });
    expect(
      resolveNotificationRoute(
        notification({ targetUrl: 'https://attacker.example/steal' }),
        [],
        'https://console.example.com',
      ),
    ).toEqual({ type: 'none' });
  });
});
