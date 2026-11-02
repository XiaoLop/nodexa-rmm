import { ConsoleModal } from '../../components/ui';
import { DeleteOutlined, PlusOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { Alert, Button, Empty, Form, Input, List, Spin, Tag } from 'antd';
import type { FormInstance } from 'antd';
import { useTranslation } from 'react-i18next';
import type { SecurityKey } from './twoFactorManagement';

export interface SecurityKeyFormValues {
  name: string;
}

interface SecurityKeysModalProps {
  form: FormInstance<SecurityKeyFormValues>;
  open: boolean;
  keys: SecurityKey[];
  loading: boolean;
  registering: boolean;
  removingIndex: number | null;
  canAdd: boolean;
  maxKeys: number | null;
  onAdd: () => void;
  onCancel: () => void;
  onRemove: (key: SecurityKey) => void;
}

export function SecurityKeysModal({
  form,
  open,
  keys,
  loading,
  registering,
  removingIndex,
  canAdd,
  maxKeys,
  onAdd,
  onCancel,
  onRemove,
}: SecurityKeysModalProps) {
  const { t } = useTranslation();

  return (
    <ConsoleModal
      title={t('profile.securityKeys.title')}
      open={open}
      onCancel={onCancel}
      variant="form"
      footer={null}
    >
      <div className="profile-security-keys-container">
        <Alert
          type="info"
          showIcon
          message={t('profile.securityKeys.notice')}
        />

        <Form
          form={form}
          layout="vertical"
          className="profile-security-keys-form"
          onFinish={onAdd}
        >
          <Form.Item
            name="name"
            label={t('profile.securityKeys.name')}
            rules={[
              {
                required: true,
                whitespace: true,
                message: t('profile.securityKeys.nameRequired'),
              },
            ]}
          >
            <Input
              maxLength={64}
              placeholder={t('profile.securityKeys.namePlaceholder')}
              disabled={!canAdd || registering}
            />
          </Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            icon={<PlusOutlined />}
            loading={registering}
            disabled={!canAdd || loading}
          >
            {t('profile.securityKeys.add')}
          </Button>
        </Form>

        {!canAdd ? (
          <Alert
            type="warning"
            showIcon
            message={
              maxKeys == null
                ? t('profile.securityKeys.changesLocked')
                : t('profile.securityKeys.limitReached', {
                    count: maxKeys,
                  })
            }
          />
        ) : null}

        <div className="profile-security-keys-list-heading">
          <strong>{t('profile.securityKeys.registered')}</strong>
          <Tag>{t('profile.securityKeys.count', { count: keys.length })}</Tag>
        </div>

        {loading ? (
          <div className="profile-security-keys-loading">
            <Spin size="small" />
            <span>{t('profile.securityKeys.loading')}</span>
          </div>
        ) : keys.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={t('profile.securityKeys.empty')}
          />
        ) : (
          <List
            className="profile-security-keys-list"
            dataSource={keys}
            renderItem={(key) => (
              <List.Item
                actions={[
                  <Button
                    key="remove"
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    loading={removingIndex === key.index}
                    disabled={removingIndex != null || registering}
                    onClick={() => onRemove(key)}
                  >
                    {t('profile.securityKeys.remove')}
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  avatar={<SafetyCertificateOutlined className="profile-security-key-list-icon" />}
                  title={key.name}
                  description={t(`profile.securityKeys.types.${key.type}`)}
                />
              </List.Item>
            )}
          />
        )}
      </div>
    </ConsoleModal>
  );
}