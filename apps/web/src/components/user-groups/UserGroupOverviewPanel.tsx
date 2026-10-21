import {
  ApartmentOutlined,
  DesktopOutlined,
  RightOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type {
  Device,
  DeviceGroup,
  ManagedUser,
  UserGroupLink,
} from '@meshcentral/control-client';
import { Button, Empty, Space, Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { FilterBar, Panel } from '../ui';

interface UserGroupOverviewPanelProps {
  memberLinks: UserGroupLink[];
  groupLinks: UserGroupLink[];
  deviceLinks: UserGroupLink[];
  users: ManagedUser[];
  groups: DeviceGroup[];
  devices: Device[];
  onSelectTab: (key: string) => void;
}

export function UserGroupOverviewPanel({
  memberLinks,
  groupLinks,
  deviceLinks,
  users,
  groups,
  devices,
  onSelectTab,
}: UserGroupOverviewPanelProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="user-group-inheritance-panel">
      {/* 快捷指标卡片 */}
      <section className="user-detail-summary-grid">
        <article
          className="user-detail-summary-card"
          style={{ cursor: 'pointer' }}
          onClick={() => onSelectTab('members')}
        >
          <span className="user-detail-summary-icon purple">
            <TeamOutlined />
          </span>
          <span>
            <small>{t('userGroups.details.tabs.memberScale')}</small>
            <strong>{t('userGroups.details.counts.people', { count: memberLinks.length })}</strong>
          </span>
          <RightOutlined className="user-detail-chevron" />
        </article>

        <article
          className="user-detail-summary-card"
          style={{ cursor: 'pointer' }}
          onClick={() => onSelectTab('groups')}
        >
          <span className="user-detail-summary-icon green">
            <ApartmentOutlined />
          </span>
          <span>
            <small>{t('userGroups.details.tabs.inheritedGroups')}</small>
            <strong>{t('userGroups.details.counts.groups', { count: groupLinks.length })}</strong>
          </span>
          <RightOutlined className="user-detail-chevron" />
        </article>

        <article
          className="user-detail-summary-card"
          style={{ cursor: 'pointer' }}
          onClick={() => onSelectTab('devices')}
        >
          <span className="user-detail-summary-icon blue">
            <DesktopOutlined />
          </span>
          <span>
            <small>{t('userGroups.details.tabs.inheritedDevices')}</small>
            <strong>{t('userGroups.details.counts.devices', { count: deviceLinks.length })}</strong>
          </span>
          <RightOutlined className="user-detail-chevron" />
        </article>
      </section>

      {/* 快速成员与资源预览 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: 14,
        }}
      >
        <Panel>
          <FilterBar>
            <strong>{t('userGroups.details.preview.members')}</strong>
            <div className="toolbar-spacer" />
            <Button type="link" size="small" onClick={() => onSelectTab('members')}>
              {t('userGroups.details.viewAllCount', { count: memberLinks.length })}
            </Button>
          </FilterBar>
          {memberLinks.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {memberLinks.slice(0, 5).map((link) => {
                const user = users.find((item) => item.id === link.id);
                return (
                  <div
                    key={link.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: 'rgba(15, 23, 42, 0.4)',
                      borderRadius: 6,
                      border: '1px solid rgba(51, 65, 85, 0.3)',
                    }}
                  >
                    <Space size={8}>
                      <UserOutlined style={{ color: '#818cf8' }} />
                      <span
                        className="user-group-member-link"
                        onClick={() => navigate(`/admin/users/${encodeURIComponent(link.id)}`)}
                      >
                        {user?.name ?? link.name ?? link.id}
                      </span>
                    </Space>
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>
                      {user?.email ||
                        (user?.locked ? t('users.status.locked') : t('users.status.active'))}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t('userGroups.details.empty.members')}
            />
          )}
        </Panel>

        <Panel>
          <FilterBar>
            <strong>{t('userGroups.details.preview.resources')}</strong>
            <div className="toolbar-spacer" />
            <Button type="link" size="small" onClick={() => onSelectTab('groups')}>
              {t('userGroups.details.viewAllCount', {
                count: groupLinks.length + deviceLinks.length,
              })}
            </Button>
          </FilterBar>
          {groupLinks.length + deviceLinks.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {groupLinks.slice(0, 3).map((link) => {
                const grp = groups.find((item) => item.id === link.id);
                return (
                  <div
                    key={link.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: 'rgba(15, 23, 42, 0.4)',
                      borderRadius: 6,
                      border: '1px solid rgba(51, 65, 85, 0.3)',
                    }}
                  >
                    <Space size={8}>
                      <ApartmentOutlined style={{ color: '#34d399' }} />
                      <span>{grp?.name ?? link.name ?? link.id}</span>
                    </Space>
                    <Tag color="green">{t('userGroups.details.deviceGroup')}</Tag>
                  </div>
                );
              })}
              {deviceLinks.slice(0, 2).map((link) => {
                const dev = devices.find((item) => item.id === link.id);
                return (
                  <div
                    key={link.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: 'rgba(15, 23, 42, 0.4)',
                      borderRadius: 6,
                      border: '1px solid rgba(51, 65, 85, 0.3)',
                    }}
                  >
                    <Space size={8}>
                      <DesktopOutlined style={{ color: '#38bdf8' }} />
                      <span>{dev?.name ?? link.name ?? link.id}</span>
                    </Space>
                    <Tag color="blue">{t('userGroups.details.device')}</Tag>
                  </div>
                );
              })}
            </div>
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t('userGroups.details.empty.resources')}
            />
          )}
        </Panel>
      </div>
    </div>
  );
}
