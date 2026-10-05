import {
  CheckOutlined,
  DeleteOutlined,
  InfoCircleOutlined,
  MessageOutlined,
  SafetyCertificateOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import type { MeshCentralClient } from '@meshcentral/control-client';
import {
  meshCentralControlSelectors,
  useMeshCentralControlStore,
  type Device,
  type MeshCentralControlStore,
  type NotificationEntry,
} from '@meshcentral/shared-state';
import { Button, Drawer, Empty, Segmented, Tooltip } from 'antd';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { resolveLanguage } from '../../i18n';
import { notificationGroup, presentNotification } from './notificationPresentation';
import { executeNotificationRoute, resolveNotificationRoute } from './notificationRouting';
import '../../assets/styles/notifications.css';

type NotificationFilter = 'all' | 'unread';

interface NotificationCenterProps {
  open: boolean;
  onClose: () => void;
  store: MeshCentralControlStore;
  client?: MeshCentralClient;
  devices: Device[];
}

const GROUPS = ['today', 'yesterday', 'earlier'] as const;

function NotificationIcon({ notification }: { notification: NotificationEntry }) {
  if (notification.source === 'security') return <SafetyCertificateOutlined />;
  if (notification.source === 'help-request' || notification.source === 'chat-request') {
    return <MessageOutlined />;
  }
  if (notification.severity === 'error' || notification.severity === 'critical') {
    return <WarningOutlined />;
  }
  return <InfoCircleOutlined />;
}

export function NotificationCenter({
  open,
  onClose,
  store,
  client,
  devices,
}: NotificationCenterProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const notifications = useMeshCentralControlStore(
    store,
    meshCentralControlSelectors.notifications,
  );
  const unreadCount = useMeshCentralControlStore(store, meshCentralControlSelectors.unreadCount);
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const visibleNotifications = useMemo(
    () => notifications.filter((notification) => filter === 'all' || !notification.read),
    [filter, notifications],
  );
  const grouped = useMemo(
    () =>
      visibleNotifications.reduce<Partial<Record<(typeof GROUPS)[number], NotificationEntry[]>>>(
        (groups, notification) => {
          const group = notificationGroup(notification.occurredAt);
          (groups[group] ??= []).push(notification);
          return groups;
        },
        {},
      ),
    [visibleNotifications],
  );

  const removeNotification = (id: string) => {
    store.getState().removeNotification(id);
    if (client?.connectionStatus === 'connected') {
      try {
        client.notifications.removeAcrossSessions(id);
      } catch {
        return;
      }
    }
  };

  const clearAll = () => {
    for (const notification of notifications) {
      if (client?.connectionStatus === 'connected') {
        try {
          client.notifications.removeAcrossSessions(notification.id);
        } catch {
          continue;
        }
      }
    }
    store.getState().clearNotifications();
  };

  const selectNotification = (notification: NotificationEntry) => {
    store.getState().markNotificationRead(notification.id);
    const route = resolveNotificationRoute(notification, devices, window.location.origin);
    executeNotificationRoute(route, navigate);
    if (route.type !== 'none') onClose();
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width="min(420px, 100vw)"
      className="notification-drawer"
      title={
        <div className="notification-drawer-title">
          <span>{t('notifications.title')}</span>
          {unreadCount > 0 && (
            <small>{t('notifications.unreadDescription', { count: unreadCount })}</small>
          )}
        </div>
      }
      extra={
        <div className="notification-drawer-actions">
          <Button
            type="text"
            size="small"
            icon={<CheckOutlined />}
            disabled={unreadCount === 0}
            onClick={() => store.getState().markAllNotificationsRead()}
          >
            {t('notifications.markAllRead')}
          </Button>
          <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined />}
            disabled={notifications.length === 0}
            onClick={clearAll}
          >
            {t('notifications.clearAll')}
          </Button>
        </div>
      }
    >
      <Segmented
        block
        value={filter}
        onChange={(value) => setFilter(value as NotificationFilter)}
        options={[
          { value: 'all', label: `${t('notifications.filters.all')} (${notifications.length})` },
          { value: 'unread', label: `${t('notifications.filters.unread')} (${unreadCount})` },
        ]}
      />
      <div className="notification-list" aria-live="polite">
        {visibleNotifications.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={t(
              filter === 'unread' ? 'notifications.emptyUnread' : 'notifications.empty',
            )}
          />
        ) : (
          GROUPS.map((group) => {
            const items = grouped[group];
            if (!items?.length) return null;
            return (
              <section className="notification-group" key={group}>
                <h3>{t(`notifications.groups.${group}`)}</h3>
                {items.map((notification) => {
                  const presentation = presentNotification(notification, t);
                  return (
                    <article
                      className={`notification-item severity-${notification.severity}${notification.read ? ' is-read' : ''}`}
                      key={notification.id}
                    >
                      <button
                        type="button"
                        className="notification-item-main"
                        onClick={() => selectNotification(notification)}
                      >
                        <span className="notification-item-icon">
                          <NotificationIcon notification={notification} />
                        </span>
                        <span className="notification-item-copy">
                          <strong>{presentation.title}</strong>
                          <span>{presentation.message}</span>
                          <time dateTime={notification.occurredAt}>
                            {new Intl.DateTimeFormat(resolveLanguage(i18n.resolvedLanguage), {
                              hour: '2-digit',
                              minute: '2-digit',
                            }).format(new Date(notification.occurredAt))}
                          </time>
                        </span>
                        {!notification.read && <i className="notification-unread-dot" />}
                      </button>
                      <div className="notification-item-actions">
                        {!notification.read && (
                          <Tooltip title={t('notifications.markRead')}>
                            <Button
                              type="text"
                              size="small"
                              icon={<CheckOutlined />}
                              aria-label={t('notifications.markRead')}
                              onClick={() => store.getState().markNotificationRead(notification.id)}
                            />
                          </Tooltip>
                        )}
                        <Tooltip title={t('notifications.remove')}>
                          <Button
                            type="text"
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            aria-label={t('notifications.remove')}
                            onClick={() => removeNotification(notification.id)}
                          />
                        </Tooltip>
                      </div>
                    </article>
                  );
                })}
              </section>
            );
          })
        )}
      </div>
    </Drawer>
  );
}
