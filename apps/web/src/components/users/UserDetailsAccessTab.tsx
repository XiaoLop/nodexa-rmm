import {
  ApartmentOutlined,
  DeleteOutlined,
  DesktopOutlined,
  EditOutlined,
  PlusOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { Button, Empty, Space, Tooltip } from 'antd';
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
  return (
    <article className={`user-detail-access-card${constrained ? ' constrained' : ''}`}>
      <header>
        <h2><span className={tone}>{icon}</span>{title}</h2>
        {editable ? <Button type="link" size="small" icon={<PlusOutlined />} disabled={addDisabled} onClick={onAdd}>{t('userDetails.actions.add')}</Button> : <span>{t('userDetails.itemsCount', { count: rows.length })}</span>}
      </header>
      <div className={`user-detail-access-head${editable ? ' editable' : ''}`}><span>{t('userDetails.columns.name')}</span><span>{t('userDetails.columns.permission')}</span>{editable ? <span>{t('userDetails.columns.actions')}</span> : null}</div>
      <div className="user-detail-access-body">
        {rows.length ? rows.map((row) => (
          <div className={`user-detail-access-row${editable ? ' editable' : ''}`} key={row.id}>
            <span>{row.name}</span><span>{row.permission}</span>
            {editable ? (
              <Space size={0}>
                <Tooltip title={editDisabled ? resolvedDisabledReason : undefined}>
                  <Button type="link" size="small" icon={<EditOutlined />} disabled={editDisabled} onClick={() => onEdit?.(row)}>{t('common.actions.edit')}</Button>
                </Tooltip>
                <Tooltip title={editDisabled ? resolvedDisabledReason : undefined}>
                  <Button type="link" danger size="small" icon={<DeleteOutlined />} disabled={editDisabled} onClick={() => onRemove?.(row)}>{t('userDetails.actions.remove')}</Button>
                </Tooltip>
              </Space>
            ) : null}
          </div>
        )) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('userDetails.empty.access', { title })} />}
      </div>
    </article>
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
      disabledReason={tab === 'shared-devices' ? t('userDetails.errors.cannotEditCurrentDevices') : undefined}
      onAdd={onAdd}
      onEdit={onEdit}
      onRemove={onRemove}
    />
  );
}
