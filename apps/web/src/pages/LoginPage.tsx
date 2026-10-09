import {
  DesktopOutlined,
  DownOutlined,
  GlobalOutlined,
  SafetyCertificateFilled,
  SafetyCertificateOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { Dropdown, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation } from 'react-router-dom';
import { LoginForm, RegisterForm } from '../components/auth';
import { BrandLogo } from '../components/BrandLogo';
import { useMeshCentralControl } from '../features/gateway';
import {
  requestRegistrationAvailability,
  type RegistrationAvailability,
} from '../features/gateway/registration';
import { resolveLanguage, type AppLanguage } from '../i18n';
import '../assets/styles/login.css';

interface FeatureProps {
  icon: React.ReactNode;
  title: string;
  text: string;
  tag?: string;
}

export interface LoginPageProps {
  /** 初始显示的卡片模式，默认为登录卡片 */
  initialMode?: 'login' | 'register';
}

export function LoginPage({ initialMode = 'login' }: LoginPageProps) {
  const { t, i18n } = useTranslation();
  const gateway = useMeshCentralControl();
  const location = useLocation();

  const [mode, setMode] = useState<'login' | 'register'>(() => {
    if (initialMode === 'register') return 'register';
    if (location.pathname === '/register') return 'register';
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get('mode') === 'register') return 'register';
    return 'login';
  });

  const [availability, setAvailability] = useState<RegistrationAvailability>();
  const [availabilityFailed, setAvailabilityFailed] = useState(false);
  const [availabilityLoading, setAvailabilityLoading] = useState(true);

  const [registeredUsername, setRegisteredUsername] = useState('');
  const [registrationSucceeded, setRegistrationSucceeded] = useState(() =>
    Boolean((location.state as { registrationSucceeded?: boolean } | null)?.registrationSucceeded),
  );

  const language = resolveLanguage(i18n.resolvedLanguage);

  useEffect(() => {
    let active = true;
    setAvailabilityLoading(true);
    void requestRegistrationAvailability()
      .then((result) => {
        if (active) setAvailability(result);
      })
      .catch(() => {
        if (active) setAvailabilityFailed(true);
      })
      .finally(() => {
        if (active) setAvailabilityLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (gateway.initializing) return <AppBootScreen />;
  if (gateway.authenticated) return <Navigate to="/dashboard" replace />;

  const registrationAllowed = Boolean(
    availability?.allowed && !availability?.requiresCaptcha,
  );

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

      {/* Left Column: Brand, Value Proposition & Feature Highlights (固定不变) */}
      <section className="login-intro">
        <div className="login-intro-header">
          <div className="login-badge">
            <span className="login-badge-dot" />
            <span className="login-badge-text">{t('login.badge')}</span>
          </div>

          <div className="login-brand-wrapper">
            <BrandLogo variant="hero" />
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

      {/* Right Column: Sign-in / Sign-up Glass Card (仅在此区域切换表单) */}
      <section className="login-panel-wrap">
        <div className={`login-panel ${mode === 'register' ? 'register-panel' : ''}`}>
          {/* Mobile-only header when left intro is hidden */}
          <div className="login-mobile-header">
            <BrandLogo variant="hero" />
            <div className="login-mobile-status">
              <span className="login-status-dot" />
              <span>{t('login.systemOperational')}</span>
            </div>
          </div>

          {mode === 'login' ? (
            <LoginForm
              onSwitchToRegister={() => {
                setRegistrationSucceeded(false);
                setMode('register');
              }}
              registrationAllowed={registrationAllowed}
              registeredUsername={registeredUsername}
              registrationSucceeded={registrationSucceeded}
              onClearRegistrationSuccess={() => setRegistrationSucceeded(false)}
            />
          ) : (
            <RegisterForm
              onSwitchToLogin={() => setMode('login')}
              onRegisterSuccess={(newUsername) => {
                setRegisteredUsername(newUsername);
                setRegistrationSucceeded(true);
                setMode('login');
              }}
              availability={availability}
              availabilityLoading={availabilityLoading}
              availabilityFailed={availabilityFailed}
            />
          )}

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
        <BrandLogo variant="boot" />
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
