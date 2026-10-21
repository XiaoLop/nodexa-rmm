import {
  DesktopOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import type { Device, UserGroupLink } from '@meshcentral/control-client';
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
import { summarizeMeshRights } from '../../features/users/meshPermissions';
import { FilterBar, Panel } from '../ui';

interface UserGroupDeviceTabProps {
  links: UserGroupLink[];
  filteredLinks: UserGroupLink[];
  devices: Device[];
  canWrite: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  onAddGrant: () => void;
  onEditGrant: (link: UserGroupLink) => void;
  onRemoveGrant: (link: UserGroupLink) => void | Promise<boolean>;
}

export function UserGroupDeviceTab({
  links,
  filteredLinks,
  devices,
  canWrite,
  search,
  onSearchChange,
  onAddGrant,
  onEditGrant,
  onRemoveGrant,
}: UserGroupDeviceTabProps) {
  const { t } = useTranslation();

  const confirmRemoveGrant = (link: UserGroupLink) => {
    Modal.confirm({
      title: t('userGroups.details.confirm.removeDeviceTitle'),
      icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />,
      content: t('userGroups.details.confirm.removeContent'),
      okText: t('userGroups.details.actions.confirmRemove'),
      cancelText: t('common.actions.cancel'),
      okButtonProps: { danger: true },
      onOk: () => onRemoveGrant(link),
    });
  };

  // 权限列
  const permissionColumns: TableColumnsType<UserGroupLink> = [
    {
      title: t('userGroups.details.device'),
      key: 'target',
      render: (_, link) => {
        const target = devices.find((item) => item.id === link.id);
        const name = target?.name ?? link.name ?? link.id;

        return (
          <Space size={8}>
            <span
              className="user-identity-icon"
              style={{ width: 28, height: 28, flexBasis: 28, fontSize: 13 }}
            >
              <DesktopOutlined />
            </span>
            <div>
              <strong>{name}</strong>
              {target?.groupName ? (
                <div style={{ fontSize: 11, color: '#64748b' }}>
                  {t('userGroups.details.groupLabel', { name: target.groupName })}
                </div>
              ) : null}
            </div>
          </Space>
        );
      },
    },
    {
      title: t('userGroups.details.inheritedPermissions'),
      key: 'rights',
      width: 320,
      render: (_, link) => (
        <Tag color="blue" style={{ fontSize: 12, padding: '2px 8px' }}>
          <SafetyCertificateOutlined style={{ marginRight: 4 }} />
          {summarizeMeshRights(link.rights, t)}
        </Tag>
      ),
    },
    {
      title: t('userGroups.details.memberColumns.actions'),
      key: 'actions',
      width: 160,
      fixed: 'right',
      render: (_, link) => (
        <Space size="small">
          <Tooltip title={!canWrite ? t('userGroups.details.noManagePermission') : undefined}>
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              disabled={!canWrite}
              onClick={() => onEditGrant(link)}
            >
              {t('userGroups.details.actions.editPermissions')}
            </Button>
          </Tooltip>
          <Tooltip title={!canWrite ? t('userGroups.details.noManagePermission') : undefined}>
            <Button
              type="link"
              danger
              size="small"
              disabled={!canWrite}
              onClick={() => confirmRemoveGrant(link)}
            >
              {t('userGroups.details.actions.remove')}
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <Panel>
      <FilterBar>
        <Input
          className="user-group-tab-search"
          placeholder={t('userGroups.details.search.devices')}
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          allowClear
        />
        <div className="toolbar-spacer" />
        <Tag color="blue">
          {t('userGroups.details.counts.filteredDevices', {
            filtered: filteredLinks.length,
            total: links.length,
          })}
        </Tag>
        <Button type="primary" icon={<PlusOutlined />} disabled={!canWrite} onClick={onAddGrant}>
          {t('userGroups.details.actions.addDeviceGrant')}
        </Button>
      </FilterBar>
      <Table
        rowKey="id"
        columns={permissionColumns}
        dataSource={filteredLinks}
        pagination={filteredLinks.length > 10 ? { defaultPageSize: 10, showSizeChanger: true } : false}
        locale={{
          emptyText: (
            <Empty
              description={
                links.length === 0
                  ? t('userGroups.details.empty.noDeviceGrants')
                  : t('userGroups.details.empty.noMatchingDevices')
              }
            >
              {links.length === 0 && canWrite ? (
                <Button type="primary" icon={<PlusOutlined />} onClick={onAddGrant}>
                  {t('userGroups.details.actions.addFirstDevice')}
                </Button>
              ) : null}
            </Empty>
          ),
        }}
      />
    </Panel>
  );
}
