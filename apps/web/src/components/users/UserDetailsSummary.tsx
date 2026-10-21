import {
  ApartmentOutlined,
  ApiOutlined,
  ClockCircleFilled,
  DesktopOutlined,
  IdcardOutlined,
  KeyOutlined,
  SafetyCertificateFilled,
  TeamOutlined,
} from '@ant-design/icons';
import type { ManagedUser } from '@meshcentral/control-client';
import { Tooltip } from 'antd';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useFormatters } from '../../i18n/formatters';
import { summarizeSiteRights } from '../../features/users/sitePermissions';

function SummaryCard({ icon, title, value, tone }: { icon: ReactNode; title: string; value: number; tone: string }) {
  return (
    <article className="user-detail-summary-card">
      <span className={`user-detail-summary-icon ${tone}`}>{icon}</span>
      <span><small>{title}</small><strong>{value}</strong></span>
    </article>
  );
}

interface UserDetailsSummaryCardsProps {
  deviceGroupCount: number;
  userGroupCount: number;
  sharedDeviceCount: number;
}

/** Overview summary cards counting the user's access links. */
export function UserDetailsSummaryCards({
  deviceGroupCount,
  userGroupCount,
  sharedDeviceCount,
}: UserDetailsSummaryCardsProps) {
  const { t } = useTranslation();
  return (
    <section className="user-detail-summary-grid">
      <SummaryCard icon={<ApartmentOutlined />} title={t('userDetails.tabs.deviceGroups')} value={deviceGroupCount} tone="blue" />
      <SummaryCard icon={<TeamOutlined />} title={t('userDetails.tabs.userGroups')} value={userGroupCount} tone="purple" />
      <SummaryCard icon={<DesktopOutlined />} title={t('userDetails.tabs.sharedDevices')} value={sharedDeviceCount} tone="green" />
    </section>
  );
}

interface UserDetailsMetaProps {
  user: ManagedUser;
  sessionCount: number;
  online: boolean;
}

/** Account metadata grid plus the active-session status card in the hero. */
export function UserDetailsMeta({ user, sessionCount, online }: UserDetailsMetaProps) {
  const { t } = useTranslation();
  const { dateTime } = useFormatters();

  return (
    <>
      <div className="user-detail-meta-container">
        <div className="user-detail-meta-grid">
          <div className="user-detail-meta-item">
            <dt><IdcardOutlined /> {t('userDetails.fields.userId')}</dt>
            <dd>
              <Tooltip title={user.id}>
                <span className="user-detail-meta-value mono">{user.id}</span>
              </Tooltip>
            </dd>
          </div>
          <div className="user-detail-meta-item">
            <dt><ClockCircleFilled /> {t('userDetails.fields.createdAt')}</dt>
            <dd>
              <span className="user-detail-meta-value">{user.createdAt ? dateTime(user.createdAt, { second: undefined }) : t('userDetails.missing')}</span>
            </dd>
          </div>
          <div className="user-detail-meta-item">
            <dt><ClockCircleFilled /> {t('userDetails.fields.lastLoginAt')}</dt>
            <dd>
              <span className="user-detail-meta-value">{user.lastLoginAt ? dateTime(user.lastLoginAt, { second: undefined }) : t('userDetails.neverLoggedIn')}</span>
            </dd>
          </div>
          <div className="user-detail-meta-item">
            <dt><ClockCircleFilled /> {t('userDetails.fields.lastAccessAt')}</dt>
            <dd>
              <span className="user-detail-meta-value">{user.lastAccessAt ? dateTime(user.lastAccessAt, { second: undefined }) : t('userDetails.missing')}</span>
            </dd>
          </div>
          <div className="user-detail-meta-item">
            <dt><KeyOutlined /> {t('userDetails.fields.passwordChangedAt')}</dt>
            <dd>
              <span className="user-detail-meta-value">{user.passwordChangedAt ? dateTime(user.passwordChangedAt, { second: undefined }) : t('userDetails.missing')}</span>
            </dd>
          </div>
          <div className="user-detail-meta-item">
            <dt><SafetyCertificateFilled /> {t('userDetails.fields.sitePermissions')}</dt>
            <dd>
              <Tooltip title={summarizeSiteRights(user.siteRights, t)}>
                <span className="user-detail-meta-value">{summarizeSiteRights(user.siteRights, t)}</span>
              </Tooltip>
            </dd>
          </div>
        </div>
      </div>

      <div className="user-detail-sessions">
        <div className={`user-detail-sessions-card ${online ? 'is-online' : ''}`}>
          <span className="user-detail-sessions-icon">
            <ApiOutlined />
          </span>
          <div className="user-detail-sessions-body">
            <div className="user-detail-sessions-count">
              <strong>{sessionCount}</strong>
              <span className="user-detail-sessions-unit">{t('userDetails.activeSessions')}</span>
            </div>
            <div className="user-detail-sessions-status">
              <span className={`user-detail-pulse-dot ${online ? 'online' : 'offline'}`} />
              <small>{online ? t('userDetails.status.userOnline') : t('userDetails.status.userOffline')}</small>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
