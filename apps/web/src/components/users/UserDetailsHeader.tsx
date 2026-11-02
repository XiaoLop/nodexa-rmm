import {
  DeleteOutlined,
  EditOutlined,
  LockOutlined,
  MailOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  UnlockOutlined,
} from '@ant-design/icons';
import { isFullAdministrator, type ManagedUser } from '@meshcentral/control-client';
import { Button, Tag, Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import { UserAvatar } from './UserAvatar';

interface UserDetailsHeaderProps {
  user: ManagedUser;
  online: boolean;
  avatarRefreshKey: number;
  isViewingCurrentUser: boolean;
  connected: boolean;
  onEditProfile: () => void;
  onOpenSitePermissions: () => void;
  onOpenFeatureRestrictions: () => void;
  onLockChange: () => void;
  onDelete: () => void;
}

/** Avatar, identity tags and account action buttons of the details hero. */
export function UserDetailsHeader({
  user,
  online,
  avatarRefreshKey,
  isViewingCurrentUser,
  connected,
  onEditProfile,
  onOpenSitePermissions,
  onOpenFeatureRestrictions,
  onLockChange,
  onDelete,
}: UserDetailsHeaderProps) {
  const { t } = useTranslation();
  const statusLabel = user.locked
    ? t('userDetails.status.locked')
    : online
      ? t('common.status.online')
      : t('common.status.offline');

  return (
    <div className="user-detail-profile">
      <div className="user-detail-avatar-wrapper">
        <UserAvatar
          className={`user-detail-avatar ${user.locked ? 'is-locked' : online ? 'is-online' : 'is-offline'}`}
          username={user.name}
          refreshKey={avatarRefreshKey}
          src={user.image}
          hasImage={Boolean(user.image || user.hasImage)}
        />
        <span
          className={`user-detail-status-indicator ${user.locked ? 'status-locked' : online ? 'status-online' : 'status-offline'}`}
          title={statusLabel}
        />
      </div>
      <div className="user-detail-name">
        <div className="user-detail-title-row">
          <h1>{user.name}</h1>
          <Tag
            className={`user-status-tag ${user.locked ? 'tag-locked' : online ? 'tag-online' : 'tag-offline'}`}
            color={user.locked ? 'error' : online ? 'success' : 'default'}
          >
            <span className="user-status-dot" />
            {statusLabel}
          </Tag>
          {isFullAdministrator(user.siteRights) ? (
            <Tag color="blue" className="user-role-tag">{t('permissions.summary.siteAdmin')}</Tag>
          ) : null}
        </div>
        <div className="user-detail-subinfo">
          <span className="user-detail-realname">{user.realName || t('userDetails.missingRealName')}</span>
          <span className="user-detail-divider">•</span>
          <span className="user-detail-email">
            <MailOutlined /> {user.email || t('userDetails.missingEmail')}
          </span>
        </div>
        <div className="user-detail-actions">
          <Button type="primary" icon={<EditOutlined />} onClick={onEditProfile}>
            {t('userDetails.actions.editProfile')}
          </Button>
          <Tooltip title={isViewingCurrentUser ? t('userDetails.errors.cannotEditCurrentPermissions') : undefined}>
            <Button
              icon={<SafetyCertificateOutlined />}
              disabled={!connected || isViewingCurrentUser}
              onClick={onOpenSitePermissions}
            >
              {t('userDetails.actions.setPermissions')}
            </Button>
          </Tooltip>
          <Tooltip title={isViewingCurrentUser ? t('userDetails.errors.cannotEditCurrentPermissions') : undefined}>
            <Button
              icon={<SettingOutlined />}
              disabled={!connected || isViewingCurrentUser}
              onClick={onOpenFeatureRestrictions}
            >
              {t('userDetails.actions.setFeatures')}
            </Button>
          </Tooltip>
          <Button
            danger={!user.locked}
            icon={user.locked ? <UnlockOutlined /> : <LockOutlined />}
            disabled={!connected || isViewingCurrentUser}
            onClick={onLockChange}
          >
            {user.locked ? t('common.actions.enable') : t('common.actions.disable')}
          </Button>
          <Button
            danger
            icon={<DeleteOutlined />}
            disabled={!connected || isViewingCurrentUser}
            onClick={onDelete}
          >
            {t('common.actions.delete')}
          </Button>
        </div>
      </div>
    </div>
  );
}
