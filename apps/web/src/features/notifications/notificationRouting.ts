import type { Device, NotificationEntry } from '@meshcentral/shared-state';
import type { NavigateFunction } from 'react-router-dom';

export type NotificationRoute =
  | { type: 'internal'; path: string }
  | { type: 'window'; url: string; name: string }
  | { type: 'none' };

function devicePath(deviceId: string, tab: string): string {
  return `/devices/${encodeURIComponent(deviceId)}/workspace?tab=${tab}`;
}

export function resolveNotificationRoute(
  notification: NotificationEntry,
  devices: Device[],
  origin = 'http://localhost',
): NotificationRoute {
  if (notification.deviceId) {
    if (!devices.some((device) => device.id === notification.deviceId)) return { type: 'none' };
    const tab =
      notification.source === 'help-request'
        ? 'overview'
        : notification.tag === 'desktop' ||
            notification.tag === 'terminal' ||
            notification.tag === 'files'
          ? notification.tag
          : 'overview';
    return { type: 'internal', path: devicePath(notification.deviceId, tab) };
  }
  if (notification.tag === 'backupcodes') {
    return { type: 'internal', path: '/profile?tab=security&action=backup-codes' };
  }
  if (notification.tag?.startsWith('meshmessenger/')) {
    const title = notification.username ?? notification.title ?? '';
    return {
      type: 'window',
      url: `/messenger?id=${encodeURIComponent(notification.tag)}&title=${encodeURIComponent(title)}`,
      name: `meshcentral-messenger-${notification.tag.split('/')[1] ?? 'chat'}`,
    };
  }
  if (notification.targetUrl) {
    try {
      const target = new URL(notification.targetUrl, origin);
      if (target.origin === origin) {
        return { type: 'internal', path: `${target.pathname}${target.search}${target.hash}` };
      }
    } catch {
      return { type: 'none' };
    }
  }
  return { type: 'none' };
}

export function executeNotificationRoute(
  route: NotificationRoute,
  navigate: NavigateFunction,
): Window | null | undefined {
  if (route.type === 'internal') {
    navigate(route.path);
    return undefined;
  }
  if (route.type === 'window') {
    return window.open(route.url, route.name, 'noopener,noreferrer');
  }
  return undefined;
}
