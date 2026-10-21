import { UserAddOutlined } from '@ant-design/icons';
import type { ManagedUser } from '@meshcentral/control-client';
import { Button, Modal, Select, Space } from 'antd';
import { useTranslation } from 'react-i18next';

interface AddMembersModalProps {
  open: boolean;
  groupName: string;
  availableUsers: ManagedUser[];
  selectedUsernames: string[];
  submitting: boolean;
  onSelectionChange: (usernames: string[]) => void;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
}

export function AddMembersModal({
  open,
  groupName,
  availableUsers,
  selectedUsernames,
  submitting,
  onSelectionChange,
  onClose,
  onSubmit,
}: AddMembersModalProps) {
  const { t } = useTranslation();

  return (
    <Modal
      title={
        <Space>
          <UserAddOutlined style={{ color: '#818cf8' }} />
          <span>{t('userGroups.details.modals.addMemberTitle', { name: groupName })}</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      onOk={() => void onSubmit()}
      confirmLoading={submitting}
      okText={t('userGroups.details.modals.addMemberOk', { count: selectedUsernames.length })}
      okButtonProps={{ disabled: selectedUsernames.length === 0 }}
      destroyOnHidden
      width={560}
    >
      <p style={{ color: '#94a3b8', fontSize: 13 }}>
        {t('userGroups.details.modals.addMemberDescription')}
      </p>

      <div
        style={{
          marginBottom: 12,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: 12, color: '#728cad' }}>
          {t('userGroups.details.modals.availableSelected', {
            available: availableUsers.length,
            selected: selectedUsernames.length,
          })}
        </span>
        <Space size="small">
          <Button
            size="small"
            onClick={() => onSelectionChange(availableUsers.map((u) => u.name))}
            disabled={availableUsers.length === 0}
          >
            {t('userGroups.details.actions.selectAll')}
          </Button>
          <Button
            size="small"
            onClick={() => onSelectionChange([])}
            disabled={selectedUsernames.length === 0}
          >
            {t('userGroups.details.actions.clear')}
          </Button>
        </Space>
      </div>

      <Select
        mode="multiple"
        style={{ width: '100%' }}
        showSearch
        optionFilterProp="label"
        value={selectedUsernames}
        onChange={onSelectionChange}
        placeholder={t('userGroups.details.search.users')}
        options={availableUsers.map((user) => {
          const extra = [user.realName, user.email].filter(Boolean).join(' · ');
          return {
            value: user.name,
            label: extra ? `${user.name} (${extra})` : user.name,
          };
        })}
      />
    </Modal>
  );
}
