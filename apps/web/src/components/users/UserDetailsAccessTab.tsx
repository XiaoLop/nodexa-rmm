import { ConsoleTable, Panel } from '../ui';
import {
  ApartmentOutlined,
  DeleteOutlined,
  DesktopOutlined,
  EditOutlined,
  PlusOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { Button, Empty, Space, Tooltip, type TableColumnsType } from 'antd';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { AccessRow } from '../../features/users/accessRows';

interface AccessCardProps {
  icon: ReactNode;
  title: string;
  rows: AccessRow[];
  tone: string;
  constrained?: boolean;
  editable?: boolean;
  onAdd?: () => void;
  onEdit?: (row: AccessRow) => void;
  onRemove?: (row: AccessRow) => void;
  addDisabled?: boolean;
  editDisabled?: boolean;
  disabledReason?: string;
}

/** Access table card shared by the overview grid and the access tabs. */
export function AccessCard({
  icon,
  title,
  rows,
  tone,
  constrained = false,
  editable = false,
  onAdd,
  onEdit,
  onRemove,
  addDisabled = false,
  editDisabled = false,
  disabledReason,
}: AccessCardProps) {
  const { t } = useTranslation();
  const resolvedDisabledReason = disabledReason ?? t('userDetails.actions.unavailable');
  const columns: TableColumnsType<AccessRow> = [
    {
      title: t('userDetails.columns.name'),
      dataIndex: 'name',
      key: 'name',
      width: '35%',
      ellipsis: true,
    },
    {
      title: t('userDetails.columns.permission'),
      dataIndex: 'permission',
      key: 'permission',
      ellipsis: true,
    },
  ];
  if (editable)
    columns.push({
      title: t('userDetails.columns.actions'),
      key: 'actions',
      width: 172,
      align: 'right',
      render: (_, row) => (
        <Space size={0}>
          <Tooltip title={editDisabled ? resolvedDisabledReason : undefined}>
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              disabled={editDisabled}
              onClick={() => onEdit?.(row)}
            >
              {t('common.actions.edit')}
            </Button>
          </Tooltip>
          <Tooltip title={editDisabled ? resolvedDisabledReason : undefined}>
            <Button
              type="link"
              danger
              size="small"
              icon={<DeleteOutlined />}
              disabled={editDisabled}
              onClick={() => onRemove?.(row)}
            >
              {t('userDetails.actions.remove')}
            </Button>
          </Tooltip>
        </Space>
      ),
    });
  return (
    <Panel
      className="user-detail-data-panel"
      title={
        <>
          <span className={tone}>{icon}</span>
          {title}
        </>
      }
      tools={
        editable ? (
          <Button size="small" icon={<PlusOutlined />} disabled={addDisabled} onClick={onAdd}>
            {t('userDetails.actions.add')}
          </Button>
        ) : (
          <span className="panel-item-count">
            {t('userDetails.itemsCount', { count: rows.length })}
          </span>
        )
      }
    >
      <ConsoleTable<AccessRow>
        rowKey="id"
        columns={columns}
        dataSource={rows}
        size={constrained ? 'small' : 'middle'}
        pagination={constrained ? false : undefined}
        scroll={constrained ? { y: 180 } : { x: 600 }}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t('userDetails.empty.access', { title })}
            />
          ),
        }}
      />
    </Panel>
  );
}

export type AccessTabKind = 'device-groups' | 'user-groups' | 'shared-devices';

const fallbackTitleKeys: Record<AccessTabKind, string> = {
  'device-groups': 'userDetails.tabs.deviceGroups',
  'user-groups': 'userDetails.tabs.userGroups',
  'shared-devices': 'userDetails.tabs.sharedDevices',
};

interface UserDetailsAccessTabProps {
  tab: AccessTabKind;
  titleKey?: string;
  rows: AccessRow[];
  managementDisabled: boolean;
  onAdd: () => void;
  onEdit: (row: AccessRow) => void;
  onRemove: (row: AccessRow) => void;
}

/** Reusable device-groups / user-groups / shared-devices tab body. */
export function UserDetailsAccessTab({
  tab,
  titleKey,
  rows,
  managementDisabled,
  onAdd,
  onEdit,
  onRemove,
}: UserDetailsAccessTabProps) {
  const { t } = useTranslation();
  const icons: Record<AccessTabKind, ReactNode> = {
    'device-groups': <ApartmentOutlined />,
    'user-groups': <TeamOutlined />,
    'shared-devices': <DesktopOutlined />,
  };
  const editable = tab !== 'user-groups';
  const tone = tab === 'user-groups' ? 'purple-text' : 'blue-text';

  return (
    <AccessCard
      editable={editable}
      icon={icons[tab]}
      title={t(titleKey ?? fallbackTitleKeys[tab])}
      rows={rows}
      tone={tone}
      addDisabled={managementDisabled}
      editDisabled={managementDisabled}
      disabledReason={
        tab === 'shared-devices' ? t('userDetails.errors.cannotEditCurrentDevices') : undefined
      }
      onAdd={onAdd}
      onEdit={onEdit}
      onRemove={onRemove}
    />
  );
}
