import {
  ApartmentOutlined,
  ArrowRightOutlined,
  DesktopOutlined,
  DownOutlined,
  GlobalOutlined,
  LockOutlined,
  SafetyCertificateFilled,
  SafetyCertificateOutlined,
  SettingOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Alert, Button, Checkbox, Dropdown, Form, Input, Tooltip, Typography } from 'antd';
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

interface FeatureProps {
  icon: React.ReactNode;
  title: string;
  text: string;
  tag?: string;
}

const REMEMBERED_USER_KEY = 'nodexa_rmm_saved_username';

export function LoginPage() {
  const { t, i18n } = useTranslation();
  const gateway = useGateway();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const language = resolveLanguage(i18n.resolvedLanguage);

  const [initialUsername] = useState(() => {
    try {
      return localStorage.getItem(REMEMBERED_USER_KEY) || '';
    } catch {
      return '';
    }
  });
  const [rememberMe, setRememberMe] = useState(() => Boolean(initialUsername));

  if (gateway.initializing) return <AppBootScreen />;
  if (gateway.authenticated) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (values: LoginFormValue) => {
    setError(undefined);
    setLoading(true);
    try {
      if (rememberMe) {
        localStorage.setItem(REMEMBERED_USER_KEY, values.username.trim());
      } else {
        localStorage.removeItem(REMEMBERED_USER_KEY);
      }
      await gateway.login(values.username.trim(), values.password);
      const state = location.state as { from?: string } | null;
      navigate(state?.from || '/dashboard', { replace: true });
    } catch (nextError) {
      setError(
        nextError instanceof Error && nextError.message !== 'authentication-failed'
          ? nextError.message
          : t('login.failed')
      );
    } finally {
      setLoading(false);
    }
  };

  const changeLanguage = (nextLanguage: AppLanguage) => {
    void i18n.changeLanguage(nextLanguage);
  };

  return (
    <main className="login-page">
      {/* Ambient background glows */}
      <div className="login-ambient-orb orb-primary" aria-hidden="true" />
      <div className="login-ambient-orb orb-secondary" aria-hidden="true" />
      <div className="login-ambient-orb orb-accent" aria-hidden="true" />
      <div className="login-grid-pattern" aria-hidden="true" />

      {/* Floating Language Selector */}
      <header className="login-top-actions">
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
          placement="bottomRight"
        >
          <button className="login-language-pill" type="button" aria-label={t('common.language')}>
            <GlobalOutlined className="login-lang-icon" />
            <span>{language === 'zh-CN' ? t('common.simplifiedChinese') : t('common.english')}</span>
            <DownOutlined className="login-lang-arrow" />
          </button>
        </Dropdown>
      </header>

      {/* Left Column: Brand, Value Proposition & Feature Highlights */}
      <section className="login-intro">
        <div className="login-intro-header">
          <div className="login-badge">
            <span className="login-badge-dot" />
            <span className="login-badge-text">{t('login.badge')}</span>
          </div>

          <div className="login-brand-wrapper">
            <BrandLogo />
            <span className="login-product-tag">{t('login.productLine')}</span>
          </div>
        </div>

        <Typography.Title level={1} className="login-hero-title">
          {t('login.slogan')}
        </Typography.Title>
        <Typography.Paragraph className="login-hero-desc">
          {t('login.introduction')}
        </Typography.Paragraph>

        <div className="login-features">
          <Feature
            icon={<DesktopOutlined />}
            title={t('login.realtimeMonitoring')}
            tag={t('login.featureTag1')}
            text={t('login.realtimeMonitoringDescription')}
          />
          <Feature
            icon={<SafetyCertificateOutlined />}
            title={t('login.secureAndReliable')}
            tag={t('login.featureTag2')}
            text={t('login.secureAndReliableDescription')}
          />
          <Feature
            icon={<SettingOutlined />}
            title={t('login.efficientManagement')}
            tag={t('login.featureTag3')}
            text={t('login.efficientManagementDescription')}
          />
        </div>

        <div className="login-status-card">
          <div className="login-status-indicator">
            <span className="login-status-dot" />
            <span className="login-status-label">{t('login.systemOperational')}</span>
          </div>
          <div className="login-security-indicator">
            <SafetyCertificateFilled className="login-shield-icon" />
            <span>{t('login.secureChannel')}</span>
          </div>
        </div>

        <footer className="login-intro-footer">
          <span>© 2026 Nodexa RMM. All rights reserved.</span>
        </footer>
      </section>

      {/* Right Column: Sign-in Glass Card */}
      <section className="login-panel-wrap">
        <div className="login-panel">
          {/* Mobile-only header when left intro is hidden */}
          <div className="login-mobile-header">
            <BrandLogo />
            <div className="login-mobile-status">
              <span className="login-status-dot" />
              <span>{t('login.systemOperational')}</span>
            </div>
          </div>

          <div className="login-panel-header">
            <div className="login-panel-icon-wrap">
              <BrandLogo compact />
            </div>
            <Typography.Title level={2} className="login-panel-title">
              {t('login.title')}
            </Typography.Title>
            <Typography.Text type="secondary" className="login-panel-subtitle">
              {t('login.subtitle')}
            </Typography.Text>
          </div>

          {error && (
            <Alert
              type="error"
              showIcon
              title={error}
              className="login-alert"
              closable
              onClose={() => setError(undefined)}
            />
          )}

          <Form<LoginFormValue>
            layout="vertical"
            initialValues={{ username: initialUsername, password: '' }}
            onFinish={(values) => void handleSubmit(values)}
            className="login-form"
            requiredMark={false}
          >
            <Form.Item
              label={t('login.username')}
              name="username"
              rules={[{ required: true, message: t('login.usernameRequired') }]}
            >
              <Input
                size="large"
                prefix={<UserOutlined className="login-input-icon" />}
                placeholder={t('login.usernamePlaceholder')}
                autoComplete="username"
                className="login-input"
              />
            </Form.Item>

            <Form.Item
              label={t('login.password')}
              name="password"
              rules={[{ required: true, message: t('login.passwordRequired') }]}
            >
              <Input.Password
                size="large"
                prefix={<LockOutlined className="login-input-icon" />}
                placeholder={t('login.passwordPlaceholder')}
                autoComplete="current-password"
                className="login-input"
              />
            </Form.Item>

            <div className="login-meta">
              <Checkbox
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="login-remember-checkbox"
              >
                {t('login.rememberMe')}
              </Checkbox>
              <Tooltip title={t('login.forgotPasswordTooltip')} placement="topRight">
                <Button type="link" className="login-forgot-btn">
                  {t('login.forgotPassword')}
                </Button>
              </Tooltip>
            </div>

            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              icon={<ArrowRightOutlined />}
              loading={loading}
              className="login-submit-btn"
            >
              {t('login.submit')}
            </Button>
          </Form>

          <div className="login-divider">
            <span>{t('login.divider')}</span>
          </div>

          <Tooltip title={t('login.ssoTooltip')}>
            <Button
              size="large"
              block
              icon={<ApartmentOutlined />}
              disabled
              className="login-sso-btn"
            >
              {t('login.sso')}
            </Button>
          </Tooltip>

          <div className="login-secure-footer">
            <SafetyCertificateFilled className="login-secure-icon" />
            <span>{t('login.secureChannel')}</span>
          </div>
        </div>
      </section>
    </main>
  );
}

function Feature({ icon, title, text, tag }: FeatureProps) {
  return (
    <div className="login-feature-card">
      <div className="login-feature-icon">{icon}</div>
      <div className="login-feature-content">
        <div className="login-feature-title-row">
          <strong className="login-feature-title">{title}</strong>
          {tag && <span className="login-feature-tag">{tag}</span>}
        </div>
        <span className="login-feature-text">{text}</span>
      </div>
    </div>
  );
}

export function AppBootScreen() {
  const { t } = useTranslation();

  return (
    <main className="boot-screen">
      <div className="boot-ambient-orb" aria-hidden="true" />
      <div className="boot-content">
        <BrandLogo />
        <div className="boot-spinner-wrap">
          <span className="boot-spinner" />
          <span className="boot-spinner-core" />
        </div>
        <p className="boot-message">{t('common.loadingSession')}</p>
        <span className="boot-submessage">Nodexa RMM Secure Gateway</span>
      </div>
    </main>
  );
}
