import {
  DesktopOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  GlobalOutlined,
  LockOutlined,
  LoginOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Alert, Button, Form, Input, Typography } from 'antd';
import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { BrandLogo } from '../components/BrandLogo';
import { useGateway } from '../features/gateway/GatewayProvider';
import "../assets/styles/login.css";

interface LoginFormValue {
  username: string;
  password: string;
}

export function LoginPage() {
  const gateway = useGateway();
  const navigate = useNavigate();
  const location = useLocation();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  if (gateway.initializing) return <AppBootScreen />;
  if (gateway.authenticated) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (values: LoginFormValue) => {
    setError(undefined);
    setLoading(true);
    try {
      await gateway.login(values.username.trim(), values.password);
      const state = location.state as { from?: string } | null;
      navigate(state?.from || '/dashboard', { replace: true });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '登录失败，请稍后重试。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <div className="login-hexagons" aria-hidden="true" />
      <section className="login-intro">
        <div>
          <BrandLogo />
          <div className="login-product-line">设备管理系统</div>
        </div>
        <Typography.Title level={3}>安全 · 高效 · 可控</Typography.Title>
        <Typography.Paragraph>
          MeshCentral
          设备管理系统为您提供企业级的远程监控与管理能力，帮助您安全地管理和维护所有终端设备。
        </Typography.Paragraph>
        <div className="login-features">
          <Feature icon={<DesktopOutlined />} title="实时监控" text="全面掌握设备状态与运行情况" />
          <Feature
            icon={<SafetyCertificateOutlined />}
            title="安全可靠"
            text="多重安全机制保障系统与数据安全"
          />
          <Feature
            icon={<SettingOutlined />}
            title="高效管理"
            text="集中化的设备管理，提升运维效率"
          />
        </div>
        <footer>© 2026 MeshCentral. All rights reserved.</footer>
      </section>

      <section className="login-panel-wrap">
        <div className="login-panel">
          <div className="login-panel-brand">
            <BrandLogo compact />
          </div>
          <Typography.Title level={2}>系统登录</Typography.Title>
          <Typography.Text type="secondary">请使用您的业务网关账号和密码登录</Typography.Text>
          {error && <Alert type="error" showIcon title={error} className="login-alert" />}
          <Form<LoginFormValue>
            layout="vertical"
            onFinish={(values) => void handleSubmit(values)}
            className="login-form"
          >
            <Form.Item
              label="用户名或邮箱"
              name="username"
              rules={[{ required: true, message: '请输入用户名或邮箱' }]}
            >
              <Input
                size="large"
                prefix={<UserOutlined />}
                placeholder="请输入用户名或邮箱"
                autoComplete="username"
              />
            </Form.Item>
            <Form.Item
              label="密码"
              name="password"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input
                size="large"
                prefix={<LockOutlined />}
                type={passwordVisible ? 'text' : 'password'}
                placeholder="请输入密码"
                autoComplete="current-password"
                suffix={
                  <Button
                    type="text"
                    className="password-toggle"
                    aria-label={passwordVisible ? '隐藏密码' : '显示密码'}
                    icon={passwordVisible ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                    onClick={() => setPasswordVisible((value) => !value)}
                  />
                }
              />
            </Form.Item>
            <div className="login-meta">
              <span />
              <Button type="link" disabled>
                忘记密码？
              </Button>
            </div>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              icon={<LoginOutlined />}
              loading={loading}
            >
              登录
            </Button>
          </Form>
          <div className="login-divider">
            <span>或</span>
          </div>
          <Button size="large" block icon={<GlobalOutlined />} disabled>
            使用 SSO 登录
          </Button>
        </div>
      </section>
    </main>
  );
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="login-feature">
      <div>{icon}</div>
      <span>
        <strong>{title}</strong>
        <small>{text}</small>
      </span>
    </div>
  );
}

export function AppBootScreen() {
  return (
    <main className="boot-screen">
      <BrandLogo />
      <span className="boot-spinner" />
      <p>正在恢复安全会话…</p>
    </main>
  );
}
