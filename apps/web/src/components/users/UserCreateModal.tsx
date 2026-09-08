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
  const [form] = Form.useForm<UserCreateForm>();
  const passwordMode = Form.useWatch('passwordMode', form) ?? 'manual';

  useEffect(() => {
    if (!open) {
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
    form.resetFields();
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
              创建用户
            </div>
            <div style={{ fontSize: 12, color: '#8c9bb0', fontWeight: 400, marginTop: 2 }}>
              配置新用户账号标识、登录凭证及安全策略
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
            取消
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            loading={submitting}
            onClick={() => void submit().catch(() => undefined)}
          >
            创建用户
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
        <SectionHeader icon={<LockOutlined />} title="账号与凭据" />

        <Form.Item
          name="username"
          label="用户名"
          rules={[{ required: true, whitespace: true, message: '请输入用户名' }]}
          style={{ marginBottom: 14 }}
        >
          <Input
            prefix={<UserOutlined style={{ color: '#6e84a3' }} />}
            placeholder="例如：ops_admin 或 alex"
            maxLength={128}
            autoComplete="off"
          />
        </Form.Item>

        <Form.Item
          name="passwordMode"
          label="密码生成方式"
          style={{ marginBottom: 12 }}
        >
          <Segmented
            block
            options={[
              {
                label: '手动设置初始密码',
                value: 'manual',
                icon: <KeyOutlined />,
              },
              {
                label: '服务端生成随机密码',
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
                label="初始密码"
                rules={[{ required: true, whitespace: true, message: '请输入初始密码' }]}
                style={{ marginBottom: 16 }}
              >
                <Input.Password
                  prefix={<LockOutlined style={{ color: '#6e84a3' }} />}
                  placeholder="请输入初始密码"
                  autoComplete="new-password"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="confirmPassword"
                label="确认密码"
                dependencies={['password']}
                rules={[
                  { required: true, message: '请再次输入密码' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      return !value || getFieldValue('password') === value
                        ? Promise.resolve()
                        : Promise.reject(new Error('两次输入的密码不一致'));
                    },
                  }),
                ]}
                style={{ marginBottom: 16 }}
              >
                <Input.Password
                  prefix={<LockOutlined style={{ color: '#6e84a3' }} />}
                  placeholder="再次输入以确认"
                  autoComplete="new-password"
                />
              </Form.Item>
            </Col>
          </Row>
        ) : (
          <Alert
            showIcon
            type="info"
            message="由系统自动生成强随机密码"
            description="用户创建成功后，服务端将返回生成的密码并在通知中显示，请及时记录。"
            style={{
              marginBottom: 16,
              backgroundColor: '#0c1a2d',
              border: '1px solid #1c365d',
            }}
          />
        )}

        {/* 个人与联系信息 */}
        <SectionHeader icon={<IdcardOutlined />} title="个人与联系信息" subtitle="选填" />

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="realName" label="真实姓名" style={{ marginBottom: 14 }}>
              <Input
                prefix={<IdcardOutlined style={{ color: '#6e84a3' }} />}
                placeholder="例如：张三"
                maxLength={256}
                autoComplete="off"
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="phone" label="联系电话" style={{ marginBottom: 14 }}>
              <Input
                prefix={<PhoneOutlined style={{ color: '#6e84a3' }} />}
                placeholder="例如：13800138000"
                maxLength={64}
                autoComplete="off"
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="email"
          label="电子邮箱"
          rules={[{ type: 'email', message: '请输入有效的邮箱地址' }]}
          style={{ marginBottom: 16 }}
        >
          <Input
            type="email"
            prefix={<MailOutlined style={{ color: '#6e84a3' }} />}
            placeholder="例如：user@example.com"
            maxLength={256}
            autoComplete="off"
          />
        </Form.Item>

      </Form>
    </Modal>
  );
}

