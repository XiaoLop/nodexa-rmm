import {
  ApartmentOutlined,
  CopyOutlined,
  DeleteOutlined,
  DesktopOutlined,
  EditOutlined,
  GlobalOutlined,
  IdcardOutlined,
  InfoCircleOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import type { UserGroup } from '@meshcentral/control-client';
import { Button, Tag, Tooltip } from 'antd';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

interface UserGroupHeaderProps {
  group: UserGroup;
  memberCount: number;
  groupCount: number;
  deviceCount: number;
  canWrite: boolean;
  onEdit: () => void;
  onAddMember: () => void;
  onDelete: () => void;
  onCopyId: () => void;
  children?: ReactNode;
}

export function UserGroupHeader({
  group,
  memberCount,
  groupCount,
  deviceCount,
  canWrite,
  onEdit,
  onAddMember,
  onDelete,
  onCopyId,
  children,
}: UserGroupHeaderProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <>
      {/* 面包屑导航 */}
      <nav className="user-detail-breadcrumb" aria-label={t('userGroups.details.breadcrumb')}>
        <button onClick={() => navigate('/admin/roles')}>{t('navigation.userGroups')}</button>
        <span>›</span>
        <strong>{group.name}</strong>
      </nav>

      {children}

      {/* Hero 区域：标准三列高保真科技感设计 */}
      <section className="user-detail-hero">
        {/* 第一列：头像与基本标识 */}
        <div className="user-detail-profile">
          <div className="user-detail-avatar-wrapper">
            <span className="user-detail-avatar is-usergroup">
              <TeamOutlined />
            </span>
          </div>
          <div className="user-detail-name">
            <div className="user-detail-title-row">
              <h1>{group.name}</h1>
              <Tag color="purple">{t('userGroups.details.role')}</Tag>
              {group.domain ? (
                <Tag color="geekblue">{group.domain}</Tag>
              ) : (
                <Tag>{t('userGroups.details.defaultDomain')}</Tag>
              )}
            </div>
            <div className="user-detail-subinfo">
              <span>{group.description || t('userGroups.details.noDescription')}</span>
            </div>
            <div>
              <span className="user-group-id-badge" title={t('userGroups.details.systemId')}>
                <IdcardOutlined />
                <span className="user-group-id-value">{group.id}</span>
                <Tooltip title={t('common.actions.copy')}>
                  <CopyOutlined className="user-group-id-copy" onClick={onCopyId} />
                </Tooltip>
              </span>
            </div>
            <div className="user-detail-actions">
              <Button size="small" icon={<EditOutlined />} disabled={!canWrite} onClick={onEdit}>
                {t('userGroups.details.actions.editProfile')}
              </Button>
              <Button
                size="small"
                icon={<UserAddOutlined />}
                disabled={!canWrite}
                onClick={onAddMember}
              >
                {t('userGroups.details.actions.addMember')}
              </Button>
              <Button size="small" danger icon={<DeleteOutlined />} disabled={!canWrite} onClick={onDelete}>
                {t('common.actions.delete')}
              </Button>
            </div>
          </div>
        </div>

        {/* 第二列：元数据指标网格 */}
        <div className="user-detail-meta-container">
          <div className="user-detail-meta-grid">
            <div className="user-detail-meta-item">
              <dt>
                <GlobalOutlined /> {t('userGroups.details.fields.domain')}
              </dt>
              <dd>
                <span className="user-detail-meta-value">
                  {group.domain || t('userGroups.details.defaultDomainValue')}
                </span>
              </dd>
            </div>

            <div className="user-detail-meta-item">
              <dt>
                <TeamOutlined /> {t('userGroups.details.fields.members')}
              </dt>
              <dd>
                <span className="user-detail-meta-value">
                  {t('userGroups.details.counts.members', { count: memberCount })}
                </span>
              </dd>
            </div>

            <div className="user-detail-meta-item">
              <dt>
                <ApartmentOutlined /> {t('userGroups.details.fields.deviceGroups')}
              </dt>
              <dd>
                <span className="user-detail-meta-value">
                  {t('userGroups.details.counts.deviceGroups', { count: groupCount })}
                </span>
              </dd>
            </div>

            <div className="user-detail-meta-item">
              <dt>
                <DesktopOutlined /> {t('userGroups.details.fields.devices')}
              </dt>
              <dd>
                <span className="user-detail-meta-value">
                  {t('userGroups.details.counts.devices', { count: deviceCount })}
                </span>
              </dd>
            </div>

            <div className="user-detail-meta-item">
              <dt>
                <InfoCircleOutlined /> {t('userGroups.details.fields.flags')}
              </dt>
              <dd>
                <span className="user-detail-meta-value">
                  {group.flags === 0
                    ? t('userGroups.details.defaultFlags')
                    : `Flags: ${group.flags}`}
                </span>
              </dd>
            </div>

            <div className="user-detail-meta-item">
              <dt>
                <SafetyCertificateOutlined /> {t('userGroups.details.fields.consent')}
              </dt>
              <dd>
                <span className="user-detail-meta-value">
                  {group.consent === 0
                    ? t('userGroups.details.unrestrictedConsent')
                    : `Consent: ${group.consent}`}
                </span>
              </dd>
            </div>
          </div>
        </div>

        {/* 第三列：继承策略生效状态卡 */}
        <div className="user-detail-sessions">
          <div className="user-detail-sessions-card is-online">
            <div className="user-detail-sessions-icon">
              <ApartmentOutlined />
            </div>
            <div className="user-detail-sessions-body">
              <span style={{ fontSize: 11, color: '#94a3b8' }}>
                {t('userGroups.details.inheritedTotal')}
              </span>
              <div className="user-detail-sessions-count">
                <strong>{groupCount + deviceCount}</strong>
                <span className="user-detail-sessions-unit">
                  {t('userGroups.details.resourceGrants')}
                </span>
              </div>
              <div className="user-detail-sessions-status">
                <span className="user-detail-pulse-dot online" />
                <span style={{ fontSize: 12, color: '#34d399' }}>
                  {t('userGroups.details.inheritedForMembers', { count: memberCount })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
