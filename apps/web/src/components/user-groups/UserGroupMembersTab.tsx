import {
  ExclamationCircleOutlined,
  MailOutlined,
  PlusOutlined,
  SearchOutlined,
  UserDeleteOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  isFullAdministrator,
  type ManagedUser,
  type UserGroupLink,
} from '@meshcentral/control-client';
import {
  Button,
  Empty,
  Input,
  Modal,
  Space,
  Table,
  Tag,
  Tooltip,
  type TableColumnsType,
} from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { FilterBar, Panel } from '../ui';

interface UserGroupMembersTabProps {
  groupName: string;
  links: UserGroupLink[];
  filteredLinks: UserGroupLink[];
  users: ManagedUser[];
  canWrite: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  onAddMember: () => void;
  onRemoveMember: (link: UserGroupLink) => void | Promise<boolean>;
}

export function UserGroupMembersTab({
  groupName,
  links,
  filteredLinks,
  users,
  canWrite,
  search,
  onSearchChange,
  onAddMember,
  onRemoveMember,
}: UserGroupMembersTabProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const confirmRemoveMember = (link: UserGroupLink) => {
    const user = users.find((item) => item.id === link.id);
    const targetName = user?.name ?? link.name ?? link.id;
    Modal.confirm({
      title: t('userGroups.details.confirm.removeMemberTitle'),
      icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />,
      content: (
        <div>
          <p>
            {t('userGroups.details.confirm.removeMemberContent', {
              group: groupName,
              name: targetName,
            })}
          </p>
          <p style={{ color: '#8c9ba5', fontSize: 12 }}>
            {t('userGroups.details.confirm.removeMemberDescription')}
          </p>
        </div>
      ),
      okText: t('userGroups.details.actions.confirmRemove'),
      cancelText: t('common.actions.cancel'),
      okButtonProps: { danger: true },
      onOk: () => onRemoveMember(link),
    });
  };

  // 成员表格列定义
  const memberColumns: TableColumnsType<UserGroupLink> = [
    {
      title: t('userGroups.details.memberColumns.user'),
      key: 'user',
      render: (_, link) => {
        const user = users.find((item) => item.id === link.id);
        const displayName = user?.name ?? link.name ?? link.id;
        return (
          <Space size={8}>
            <span
              className="user-identity-icon"
              style={{ width: 28, height: 28, flexBasis: 28, fontSize: 14 }}
            >
              <UserOutlined />
            </span>
            <span
              className="user-group-member-link"
              onClick={() => navigate(`/admin/users/${encodeURIComponent(link.id)}`)}
              title={t('userGroups.details.memberColumns.viewUser')}
            >
              {displayName}
            </span>
          </Space>
        );
      },
    },
    {
      title: t('userGroups.details.memberColumns.realName'),
      width: 150,
      render: (_, link) => {
        const user = users.find((item) => item.id === link.id);
        return user?.realName || <span style={{ color: '#64748b' }}>—</span>;
      },
    },
    {
      title: t('userGroups.details.memberColumns.email'),
      width: 220,
      render: (_, link) => {
        const user = users.find((item) => item.id === link.id);
        return user?.email ? (
          <Space size={4}>
            <MailOutlined style={{ color: '#38bdf8' }} />
            <span>{user.email}</span>
          </Space>
        ) : (
          <span style={{ color: '#64748b' }}>{t('userGroups.details.missing')}</span>
        );
      },
    },
    {
      title: t('userGroups.details.memberColumns.status'),
      width: 180,
      render: (_, link) => {
        const user = users.find((item) => item.id === link.id);
        if (!user) return <Tag>{t('common.status.unknown')}</Tag>;
        return (
          <Space size={4} wrap>
            <Tag color={user.locked ? 'error' : 'success'}>
              {user.locked ? t('users.status.locked') : t('users.status.active')}
            </Tag>
            {isFullAdministrator(user.siteRights) ? (
              <Tag color="blue">{t('users.status.siteAdmin')}</Tag>
            ) : null}
          </Space>
        );
      },
    },
    {
      title: t('userGroups.details.memberColumns.actions'),
      width: 100,
      fixed: 'right',
      render: (_, link) => (
        <Tooltip title={!canWrite ? t('userGroups.details.noManagePermission') : undefined}>
          <Button
            type="link"
            danger
            size="small"
            icon={<UserDeleteOutlined />}
            disabled={!canWrite}
            onClick={() => confirmRemoveMember(link)}
          >
            {t('userGroups.details.actions.remove')}
          </Button>
        </Tooltip>
      ),
    },
  ];

  return (
    <Panel>
      <FilterBar>
        <Input
          className="user-group-tab-search"
          placeholder={t('userGroups.details.search.members')}
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          allowClear
        />
        <div className="toolbar-spacer" />
        <Tag color="purple">
          {t('userGroups.details.counts.filteredMembers', {
            filtered: filteredLinks.length,
            total: links.length,
          })}
        </Tag>
        <Button type="primary" icon={<PlusOutlined />} disabled={!canWrite} onClick={onAddMember}>
          {t('userGroups.details.actions.addMember')}
        </Button>
      </FilterBar>
      <Table
        rowKey="id"
        columns={memberColumns}
        dataSource={filteredLinks}
        pagination={filteredLinks.length > 10 ? { defaultPageSize: 10, showSizeChanger: true } : false}
        locale={{
          emptyText: (
            <Empty
              description={
                links.length === 0
                  ? t('userGroups.details.empty.noMembers')
                  : t('userGroups.details.empty.noMatchingMembers')
              }
            >
              {links.length === 0 && canWrite ? (
                <Button type="primary" icon={<PlusOutlined />} onClick={onAddMember}>
                  {t('userGroups.details.actions.addMemberNow')}
                </Button>
              ) : null}
            </Empty>
          ),
        }}
      />
    </Panel>
  );
}
