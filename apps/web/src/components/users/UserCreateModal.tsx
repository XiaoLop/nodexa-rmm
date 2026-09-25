import {
  IdcardOutlined,
  KeyOutlined,
  LockOutlined,
  MailOutlined,
  PhoneOutlined,
  PlusOutlined,
  ThunderboltOutlined,
  UserAddOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { UserCreateOptions } from '@meshcentral/control-client';
import {
  Alert,
  Button,
  Col,
  Form,
  Input,
  Modal,
  Row,
  Segmented,
  Typography,
} from 'antd';
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, marginTop: 4 }}>
      <span style={{ color: '#2f80ff', fontSize: 14, display: 'flex', alignItems: 'center' }}>
        {icon}
      </span>
      <Text style={{ fontSize: 13, fontWeight: 600, color: '#dbe5f0' }}>{title}</Text>
      {subtitle && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          ({subtitle})
        </Text>
      )}
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
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 4 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 8,
              display: 'grid',
              placeItems: 'center',
              background: 'linear-gradient(135deg, #162b48 0%, #0d1928 100%)',
              border: '1px solid #23436b',
              color: '#3c8bff',
              fontSize: 18,
              flexShrink: 0,
            }}
          >
            <UserAddOutlined />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#f1f5fb', lineHeight: 1.3 }}>
              {t('users.modal.createTitle')}
            </div>
            <div style={{ fontSize: 12, color: '#8c9bb0', fontWeight: 400, marginTop: 2 }}>
              {t('users.modal.createSubtitle')}
            </div>
          </div>
        </div>
      }
      open={open}
      onCancel={onCancel}
      width={560}
      destroyOnHidden
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 4 }}>
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
        style={{ marginTop: 16 }}
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
            prefix={<UserOutlined style={{ color: '#6e84a3' }} />}
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
            <Col span={12}>
              <Form.Item
                name="password"
                label={t('users.modal.password')}
                rules={[{ required: true, whitespace: true, message: t('users.modal.passwordRequired') }]}
                style={{ marginBottom: 16 }}
              >
                <Input.Password
                  prefix={<LockOutlined style={{ color: '#6e84a3' }} />}
                  placeholder={t('users.modal.passwordPlaceholder')}
                  autoComplete="new-password"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
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
                  prefix={<LockOutlined style={{ color: '#6e84a3' }} />}
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
            message={t('users.modal.randomPasswordNoticeTitle')}
            description={t('users.modal.randomPasswordNoticeDesc')}
            style={{
              marginBottom: 16,
              backgroundColor: '#0c1a2d',
              border: '1px solid #1c365d',
            }}
          />
        )}

        {/* 个人与联系信息 */}
        <SectionHeader icon={<IdcardOutlined />} title={t('users.modal.personalInfo')} subtitle={t('users.modal.optional')} />

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="realName" label={t('users.modal.realName')} style={{ marginBottom: 14 }}>
              <Input
                prefix={<IdcardOutlined style={{ color: '#6e84a3' }} />}
                placeholder={t('users.modal.realNamePlaceholder')}
                maxLength={256}
                autoComplete="off"
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="phone" label={t('users.modal.phone')} style={{ marginBottom: 14 }}>
              <Input
                prefix={<PhoneOutlined style={{ color: '#6e84a3' }} />}
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
            prefix={<MailOutlined style={{ color: '#6e84a3' }} />}
            placeholder={t('users.modal.emailPlaceholder')}
            maxLength={256}
            autoComplete="off"
          />
        </Form.Item>

      </Form>
    </Modal>
  );
}

