import { isFullAdministrator, type ManagedUser } from '@meshcentral/control-client';
import { Descriptions, Drawer, Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import { useFormatters } from '../../i18n/formatters';

interface UserDetailsDrawerProps {
  user?: ManagedUser;
  sessionCount?: number;
  sessionsKnown: boolean;
  onClose: () => void;
}

export function UserDetailsDrawer({
  user,
  sessionCount,
  sessionsKnown,
  onClose,
}: UserDetailsDrawerProps) {
  const { t } = useTranslation();
  const { dateTime } = useFormatters();
  const formatDateTime = (value?: string, missing = t('userDetails.missing')) => {
    if (!value || Number.isNaN(new Date(value).getTime())) return missing;
    return dateTime(value);
  };
  return (
    <Drawer
      title={user ? t('userDetails.drawerTitle', { name: user.name }) : t('userDetails.title')}
      open={Boolean(user)}
      width="min(620px, 100vw)"
      onClose={onClose}
      destroyOnHidden
    >
      {user ? (
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label={t('userDetails.fields.id')}>{user.id}</Descriptions.Item>
          <Descriptions.Item label={t('userDetails.fields.username')}>{user.name}</Descriptions.Item>
          <Descriptions.Item label={t('userDetails.fields.realName')}>{user.realName || t('userDetails.missing')}</Descriptions.Item>
          <Descriptions.Item label={t('userDetails.fields.email')}>{user.email || t('userDetails.missing')}</Descriptions.Item>
          <Descriptions.Item label={t('userDetails.fields.phone')}>{user.phone || t('userDetails.missing')}</Descriptions.Item>
          <Descriptions.Item label={t('userDetails.fields.accountStatus')}>
            <Tag color={user.locked ? 'error' : 'success'}>{user.locked ? t('userDetails.locked') : t('userDetails.normal')}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label={t('userDetails.fields.accountType')}>
            {isFullAdministrator(user.siteRights) ? t('userDetails.administrator') : t('userDetails.standardUser')}
          </Descriptions.Item>
          <Descriptions.Item label={t('userDetails.fields.online')}>
            {sessionsKnown ? (
              <Tag color={sessionCount ? 'success' : 'default'}>
                {sessionCount ? t('userDetails.onlineSessions', { count: sessionCount }) : t('common.status.offline')}
              </Tag>
            ) : (
              <Tag>{t('common.status.unknown')}</Tag>
            )}
          </Descriptions.Item>
          <Descriptions.Item label={t('userDetails.fields.createdAt')}>{formatDateTime(user.createdAt)}</Descriptions.Item>
          <Descriptions.Item label={t('userDetails.fields.lastLogin')}>
            {formatDateTime(user.lastLoginAt, t('userDetails.neverLoggedIn'))}
          </Descriptions.Item>
          <Descriptions.Item label={t('userDetails.fields.previousLogin')}>
            {formatDateTime(user.previousLoginAt, t('userDetails.neverLoggedIn'))}
          </Descriptions.Item>
          <Descriptions.Item label={t('userDetails.fields.lastAccess')}>
            {formatDateTime(user.lastAccessAt)}
          </Descriptions.Item>
          <Descriptions.Item label={t('userDetails.fields.passwordChanged')}>
            {formatDateTime(user.passwordChangedAt)}
          </Descriptions.Item>
        </Descriptions>
      ) : null}
    </Drawer>
  );
}
