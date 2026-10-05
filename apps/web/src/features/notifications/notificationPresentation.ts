import type { TFunction } from 'i18next';
import type { NotificationEntry } from '@meshcentral/shared-state';

export interface NotificationPresentation {
  title: string;
  message: string;
}

function templateKey(kind: 'titles' | 'messages', id: number): string {
  return `notifications.templates.${kind}.${id}`;
}

function interpolate(template: string, args: unknown[] = []): string {
  return template.replace(/\{(\d+)\}/g, (match, index: string) => {
    const value = args[Number(index)];
    return value === undefined || value === null ? match : String(value);
  });
}

export function presentNotification(
  notification: NotificationEntry,
  t: TFunction,
): NotificationPresentation {
  const translatedTitle = notification.titleId
    ? t(templateKey('titles', notification.titleId), { defaultValue: '' })
    : '';
  const translatedMessage = notification.messageId
    ? t(templateKey('messages', notification.messageId), { defaultValue: '' })
    : '';
  const sourceTitle = t(`notifications.sources.${notification.source}`, {
    defaultValue: t('notifications.fallbackTitle'),
  });
  return {
    title: translatedTitle || notification.title || sourceTitle,
    message:
      interpolate(translatedMessage, notification.args) ||
      notification.message ||
      t('notifications.fallbackMessage'),
  };
}

export type NotificationGroup = 'today' | 'yesterday' | 'earlier';

export function notificationGroup(occurredAt: string, now = new Date()): NotificationGroup {
  const occurred = new Date(occurredAt);
  if (Number.isNaN(occurred.getTime())) return 'earlier';
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOccurred = new Date(
    occurred.getFullYear(),
    occurred.getMonth(),
    occurred.getDate(),
  ).getTime();
  if (startOccurred === startToday) return 'today';
  if (startOccurred === startToday - 86_400_000) return 'yesterday';
  return 'earlier';
}
