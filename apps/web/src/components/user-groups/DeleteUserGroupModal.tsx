import { ExclamationCircleOutlined } from '@ant-design/icons';
import type { UserGroup } from '@meshcentral/control-client';
import { Alert, Input, Modal, Space } from 'antd';
import { useTranslation } from 'react-i18next';

interface DeleteUserGroupModalProps {
  open: boolean;
  group: UserGroup;
  memberCount: number;
  groupCount: number;
  deviceCount: number;
  confirmation: string;
  submitting: boolean;
  onConfirmationChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
}

export function DeleteUserGroupModal({
  open,
  group,
  memberCount,
  groupCount,
  deviceCount,
  confirmation,
  submitting,
  onConfirmationChange,
  onClose,
  onSubmit,
}: DeleteUserGroupModalProps) {
  const { t } = useTranslation();

  return (
    <Modal
      title={
        <Space>
          <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
          <span>{t('userGroups.details.modals.deleteTitle')}</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      onOk={() => void onSubmit()}
      confirmLoading={submitting}
      okText={t('userGroups.confirm.deleteOk')}
      okButtonProps={{ danger: true, disabled: confirmation !== group.name }}
      destroyOnHidden
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Alert
          type="warning"
          showIcon
          title={t('userGroups.details.modals.irreversible')}
          description={
            <div>
              {t('userGroups.details.modals.deleteImpactIntro')}
              <ul style={{ margin: '4px 0 0 0', paddingLeft: 20 }}>
                <li>
                  {t('userGroups.details.modals.deleteMembersImpact', { count: memberCount })}
                </li>
                <li>
                  {t('userGroups.details.modals.deleteGrantsImpact', {
                    groups: groupCount,
                    devices: deviceCount,
                  })}
                </li>
              </ul>
            </div>
          }
        />
        <p>{t('userGroups.details.modals.deleteConfirmation', { name: group.name })}</p>
        <Input
          value={confirmation}
          onChange={(event) => onConfirmationChange(event.target.value)}
          placeholder={group.name}
          autoComplete="off"
        />
      </Space>
    </Modal>
  );
}
