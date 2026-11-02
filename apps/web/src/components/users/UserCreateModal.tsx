import { ConsoleModal } from '../ui';
import {
  IdcardOutlined,
  KeyOutlined,
  LockOutlined,
  MailOutlined,
  PhoneOutlined,
  PlusOutlined,
  ThunderboltOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { UserCreateOptions } from '@meshcentral/control-client';
import { Alert, Button, Col, Form, Input, Row, Segmented, Typography } from 'antd';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

interface UserCreateModalProps {
  open: boolean;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (values: UserCreateOptions) => Promise<void>;
}

interface UserCreateForm {
  username: string;
  passwordMode: 'manual' | 'random';
  password?: string;
  confirmPassword?: string;
  email?: string;
  realName?: string;
  phone?: string;
}

function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="console-form-section-heading">
      <span className="console-form-section-icon">{icon}</span>
      <Text strong>{title}</Text>
      {subtitle && <Text type="secondary">({subtitle})</Text>}
    </div>
  );
}

export function UserCreateModal({ open, submitting, onCancel, onSubmit }: UserCreateModalProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm<UserCreateForm>();
  const passwordMode = Form.useWatch('passwordMode', form) ?? 'manual';

  useEffect(() => {
    if (open) {
      form.resetFields();
    }
  }, [form, open]);

  const submit = async () => {
    const values = await form.validateFields();
    const isRandom = values.passwordMode === 'random';

    await onSubmit({
      username: values.username.trim(),
      password: isRandom ? '' : values.password,
      randomPassword: isRandom,
      email: values.email?.trim() || undefined,
      realName: values.realName?.trim() || undefined,
      phone: values.phone?.trim() || undefined,
      resetNextLogin: false,
    });
  };

  return (
    <ConsoleModal
      title={t('users.modal.createTitle')}
      description={t('users.modal.createSubtitle')}
      open={open}
      onCancel={onCancel}
      destroyOnHidden
      footer={
        <div className="console-drawer-actions">
          <Button onClick={onCancel} disabled={submitting}>
            {t('common.actions.cancel')}
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            loading={submitting}
            onClick={() => void submit().catch(() => undefined)}
          >
            {t('common.actions.create')}
          </Button>
        </div>
      }
    >
      <Form
        form={form}
        layout="vertical"
        preserve={false}
        autoComplete="off"
        initialValues={{
          passwordMode: 'manual',
        }}
        className="console-form"
      >
        {/* 账号与登录凭据 */}
        <SectionHeader icon={<LockOutlined />} title={t('users.modal.accountAndCredentials')} />

        <Form.Item
          name="username"
          label={t('users.modal.username')}
          rules={[{ required: true, whitespace: true, message: t('users.modal.usernameRequired') }]}
          style={{ marginBottom: 14 }}
        >
          <Input
            prefix={<UserOutlined className="console-form-field-icon" />}
            placeholder={t('users.modal.usernamePlaceholder')}
            maxLength={128}
            autoComplete="off"
          />
        </Form.Item>

        <Form.Item
          name="passwordMode"
          label={t('users.modal.passwordMode')}
          style={{ marginBottom: 12 }}
        >
          <Segmented
            block
            options={[
              {
                label: t('users.modal.manualPassword'),
                value: 'manual',
                icon: <KeyOutlined />,
              },
              {
                label: t('users.modal.randomPassword'),
                value: 'random',
                icon: <ThunderboltOutlined />,
              },
            ]}
          />
        </Form.Item>

        {passwordMode === 'manual' ? (
          <Row gutter={12}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="password"
                label={t('users.modal.password')}
                rules={[
                  { required: true, whitespace: true, message: t('users.modal.passwordRequired') },
                ]}
                style={{ marginBottom: 16 }}
              >
                <Input.Password
                  prefix={<LockOutlined className="console-form-field-icon" />}
                  placeholder={t('users.modal.passwordPlaceholder')}
                  autoComplete="new-password"
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="confirmPassword"
                label={t('users.modal.confirmPassword')}
                dependencies={['password']}
                rules={[
                  { required: true, message: t('users.modal.confirmPasswordRequired') },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      return !value || getFieldValue('password') === value
                        ? Promise.resolve()
                        : Promise.reject(new Error(t('users.modal.passwordMismatch')));
                    },
                  }),
                ]}
                style={{ marginBottom: 16 }}
              >
                <Input.Password
                  prefix={<LockOutlined className="console-form-field-icon" />}
                  placeholder={t('users.modal.confirmPasswordPlaceholder')}
                  autoComplete="new-password"
                />
              </Form.Item>
            </Col>
          </Row>
        ) : (
          <Alert
            showIcon
            type="info"
            title={t('users.modal.randomPasswordNoticeTitle')}
            description={t('users.modal.randomPasswordNoticeDesc')}
            className="console-form-notice"
          />
        )}

        {/* 个人与联系信息 */}
        <SectionHeader
          icon={<IdcardOutlined />}
          title={t('users.modal.personalInfo')}
          subtitle={t('users.modal.optional')}
        />

        <Row gutter={12}>
          <Col xs={24} sm={12}>
            <Form.Item
              name="realName"
              label={t('users.modal.realName')}
              style={{ marginBottom: 14 }}
            >
              <Input
                prefix={<IdcardOutlined className="console-form-field-icon" />}
                placeholder={t('users.modal.realNamePlaceholder')}
                maxLength={256}
                autoComplete="off"
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="phone" label={t('users.modal.phone')} style={{ marginBottom: 14 }}>
              <Input
                prefix={<PhoneOutlined className="console-form-field-icon" />}
                placeholder={t('users.modal.phonePlaceholder')}
                maxLength={64}
                autoComplete="off"
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="email"
          label={t('users.modal.email')}
          rules={[{ type: 'email', message: t('users.modal.emailInvalid') }]}
          style={{ marginBottom: 16 }}
        >
          <Input
            type="email"
            prefix={<MailOutlined className="console-form-field-icon" />}
            placeholder={t('users.modal.emailPlaceholder')}
            maxLength={256}
            autoComplete="off"
          />
        </Form.Item>
      </Form>
    </ConsoleModal>
  );
}
