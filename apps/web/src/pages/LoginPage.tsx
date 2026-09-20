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
import { Alert, Button, Dropdown, Form, Input, Typography } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { BrandLogo } from '../components/BrandLogo';
import { useGateway } from '../features/gateway/GatewayProvider';
import { resolveLanguage, type AppLanguage } from '../i18n';
import '../assets/styles/login.css';

interface LoginFormValue {
  username: string;
  password: string;
}

export function LoginPage() {
  const { t, i18n } = useTranslation();
  const gateway = useGateway();
  const navigate = useNavigate();
  const location = useLocation();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const language = resolveLanguage(i18n.resolvedLanguage);

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
      setError(nextError instanceof Error ? nextError.message : t('login.failed'));
    } finally {
      setLoading(false);
    }
  };

  const changeLanguage = (nextLanguage: AppLanguage) => {
    void i18n.changeLanguage(nextLanguage);
  };

  return (
    <main className="login-page">
      <div className="login-hexagons" aria-hidden="true" />
      <Dropdown
        menu={{
          selectedKeys: [language],
          selectable: true,
          items: [
            {
              key: 'zh-CN',
              label: t('common.simplifiedChinese'),
              onClick: () => changeLanguage('zh-CN'),
            },
            {
              key: 'en-US',
              label: t('common.english'),
              onClick: () => changeLanguage('en-US'),
            },
          ],
        }}
        trigger={['click']}
      >
        <Button
          className="login-language"
          type="text"
          icon={<GlobalOutlined />}
          aria-label={t('common.language')}
        >
          {language === 'zh-CN' ? t('common.simplifiedChinese') : t('common.english')}
        </Button>
      </Dropdown>
      <section className="login-intro">
        <div>
          <BrandLogo />
          <div className="login-product-line">{t('login.productLine')}</div>
        </div>
        <Typography.Title level={3}>{t('login.slogan')}</Typography.Title>
        <Typography.Paragraph>{t('login.introduction')}</Typography.Paragraph>
        <div className="login-features">
          <Feature
            icon={<DesktopOutlined />}
            title={t('login.realtimeMonitoring')}
            text={t('login.realtimeMonitoringDescription')}
          />
          <Feature
            icon={<SafetyCertificateOutlined />}
            title={t('login.secureAndReliable')}
            text={t('login.secureAndReliableDescription')}
          />
          <Feature
            icon={<SettingOutlined />}
            title={t('login.efficientManagement')}
            text={t('login.efficientManagementDescription')}
          />
        </div>
        <footer>© 2026 MeshCentral. All rights reserved.</footer>
      </section>

      <section className="login-panel-wrap">
        <div className="login-panel">
          <div className="login-panel-brand">
            <BrandLogo compact />
          </div>
          <Typography.Title level={2}>{t('login.title')}</Typography.Title>
          <Typography.Text type="secondary">{t('login.subtitle')}</Typography.Text>
          {error && <Alert type="error" showIcon title={error} className="login-alert" />}
          <Form<LoginFormValue>
            layout="vertical"
            onFinish={(values) => void handleSubmit(values)}
            className="login-form"
          >
            <Form.Item
              label={t('login.username')}
              name="username"
              rules={[{ required: true, message: t('login.usernameRequired') }]}
            >
              <Input
                size="large"
                prefix={<UserOutlined />}
                placeholder={t('login.usernamePlaceholder')}
                autoComplete="username"
              />
            </Form.Item>
            <Form.Item
              label={t('login.password')}
              name="password"
              rules={[{ required: true, message: t('login.passwordRequired') }]}
            >
              <Input
                size="large"
                prefix={<LockOutlined />}
                type={passwordVisible ? 'text' : 'password'}
                placeholder={t('login.passwordPlaceholder')}
                autoComplete="current-password"
                suffix={
                  <Button
                    type="text"
                    className="password-toggle"
                    aria-label={
                      passwordVisible ? t('login.hidePassword') : t('login.showPassword')
                    }
                    icon={passwordVisible ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                    onClick={() => setPasswordVisible((value) => !value)}
                  />
                }
              />
            </Form.Item>
            <div className="login-meta">
              <span />
              <Button type="link" disabled>
                {t('login.forgotPassword')}
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
              {t('login.submit')}
            </Button>
          </Form>
          <div className="login-divider">
            <span>{t('login.divider')}</span>
          </div>
          <Button size="large" block icon={<GlobalOutlined />} disabled>
            {t('login.sso')}
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
  const { t } = useTranslation();

  return (
    <main className="boot-screen">
      <BrandLogo />
      <span className="boot-spinner" />
      <p>{t('common.loadingSession')}</p>
    </main>
  );
}
