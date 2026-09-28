import {
  ApartmentOutlined,
  ArrowRightOutlined,
  DesktopOutlined,
  DownOutlined,
  GlobalOutlined,
  KeyOutlined,
  LockOutlined,
  SafetyCertificateFilled,
  SafetyCertificateOutlined,
  SettingOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Alert, Button, Checkbox, Dropdown, Form, Input, Segmented, Tooltip, Typography } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { BrandLogo } from '../components/BrandLogo';
import {
  GatewayLoginError,
  useGateway,
  type TwoFactorChallenge,
} from '../features/gateway/GatewayProvider';
import { resolveLanguage, type AppLanguage } from '../i18n';
import '../assets/styles/login.css';

interface LoginFormValue {
  username: string;
  password: string;
}

interface TwoFactorFormValue {
  code: string;
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
  const [challenge, setChallenge] = useState<TwoFactorChallenge>();
  const [pendingUsername, setPendingUsername] = useState('');
  const [twoFactorType, setTwoFactorType] = useState<'totp' | 'backup'>('totp');
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
      const username = values.username.trim();
      const nextChallenge = await gateway.login(username, values.password, rememberMe);
      if (nextChallenge) {
        const supportedMethods = nextChallenge.methods.filter(
          (method): method is { type: 'totp' | 'backup'; supported: true } =>
            method.supported && (method.type === 'totp' || method.type === 'backup'),
        );
        setPendingUsername(username);
        setChallenge(nextChallenge);
        if (supportedMethods[0]) setTwoFactorType(supportedMethods[0].type);
        if (supportedMethods.length === 0) setError(t('login.twoFactorUnsupported'));
        return;
      }
      const state = location.state as { from?: string } | null;
      navigate(state?.from || '/dashboard', { replace: true });
    } catch (nextError) {
      setError(getLoginErrorMessage(nextError, t));
    } finally {
      setLoading(false);
    }
  };

  const handleTwoFactorSubmit = async (values: TwoFactorFormValue) => {
    if (!challenge) return;
    setError(undefined);
    setLoading(true);
    try {
      await gateway.verifyTwoFactor(
        challenge,
        twoFactorType,
        values.code.trim(),
        rememberMe,
        pendingUsername,
      );
      const state = location.state as { from?: string } | null;
      navigate(state?.from || '/dashboard', { replace: true });
    } catch (nextError) {
      if (
        nextError instanceof GatewayLoginError &&
        ['AUTH_TRANSACTION_EXPIRED', 'INVALID_AUTH_TRANSACTION'].includes(nextError.status)
      ) {
        setChallenge(undefined);
      }
      setError(getLoginErrorMessage(nextError, t));
    } finally {
      setLoading(false);
    }
  };

  const resetChallenge = () => {
    setChallenge(undefined);
    setError(undefined);
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
              {challenge ? t('login.twoFactorTitle') : t('login.title')}
            </Typography.Title>
            <Typography.Text type="secondary" className="login-panel-subtitle">
              {challenge
                ? t('login.twoFactorSubtitle', { seconds: challenge.expiresIn })
                : t('login.subtitle')}
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

          {!challenge ? (
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
          ) : (
            <TwoFactorForm
              challenge={challenge}
              loading={loading}
              rememberToken={rememberMe}
              type={twoFactorType}
              onTypeChange={setTwoFactorType}
              onRememberTokenChange={setRememberMe}
              onSubmit={handleTwoFactorSubmit}
              onBack={resetChallenge}
              t={t}
            />
          )}

          {!challenge && <div className="login-divider">
            <span>{t('login.divider')}</span>
          </div>}

          {!challenge && <Tooltip title={t('login.ssoTooltip')}>
            <Button
              size="large"
              block
              icon={<ApartmentOutlined />}
              disabled
              className="login-sso-btn"
            >
              {t('login.sso')}
            </Button>
          </Tooltip>}

          <div className="login-secure-footer">
            <SafetyCertificateFilled className="login-secure-icon" />
            <span>{t('login.secureChannel')}</span>
          </div>
        </div>
      </section>
    </main>
  );
}

interface TwoFactorFormProps {
  challenge: TwoFactorChallenge;
  loading: boolean;
  rememberToken: boolean;
  type: 'totp' | 'backup';
  onTypeChange: (type: 'totp' | 'backup') => void;
  onRememberTokenChange: (value: boolean) => void;
  onSubmit: (values: TwoFactorFormValue) => Promise<void>;
  onBack: () => void;
  t: ReturnType<typeof useTranslation>['t'];
}

function TwoFactorForm({
  challenge,
  loading,
  rememberToken,
  type,
  onTypeChange,
  onRememberTokenChange,
  onSubmit,
  onBack,
  t,
}: TwoFactorFormProps) {
  const supportedMethods = challenge.methods
    .filter((method) => method.supported && (method.type === 'totp' || method.type === 'backup'))
    .map((method) => method.type as 'totp' | 'backup');

  if (supportedMethods.length === 0) {
    return (
      <Button block size="large" onClick={onBack}>
        {t('login.backToLogin')}
      </Button>
    );
  }

  return (
    <Form<TwoFactorFormValue>
      layout="vertical"
      onFinish={(values) => void onSubmit(values)}
      className="login-form login-two-factor-form"
      requiredMark={false}
    >
      {supportedMethods.length > 1 && (
        <Segmented
          block
          className="login-two-factor-methods"
          value={type}
          options={supportedMethods.map((method) => ({
            value: method,
            label: method === 'totp' ? t('login.totpMethod') : t('login.backupMethod'),
          }))}
          onChange={(value) => onTypeChange(value as 'totp' | 'backup')}
        />
      )}
      <Form.Item
        label={type === 'totp' ? t('login.totpCode') : t('login.backupCode')}
        name="code"
        rules={[{ required: true, message: t('login.twoFactorCodeRequired') }]}
      >
        <Input
          size="large"
          prefix={<KeyOutlined className="login-input-icon" />}
          placeholder={
            type === 'totp' ? t('login.totpCodePlaceholder') : t('login.backupCodePlaceholder')
          }
          autoComplete="one-time-code"
          inputMode={type === 'totp' ? 'numeric' : 'text'}
          maxLength={type === 'totp' ? 6 : 8}
          className="login-input"
        />
      </Form.Item>
      <Checkbox
        checked={rememberToken}
        onChange={(event) => onRememberTokenChange(event.target.checked)}
        className="login-remember-checkbox login-trust-device"
      >
        {t('login.trustDevice')}
      </Checkbox>
      <Button
        type="primary"
        htmlType="submit"
        size="large"
        block
        icon={<ArrowRightOutlined />}
        loading={loading}
        className="login-submit-btn"
      >
        {t('login.verifyTwoFactor')}
      </Button>
      <Button type="link" block className="login-back-btn" onClick={onBack}>
        {t('login.backToLogin')}
      </Button>
    </Form>
  );
}

function getLoginErrorMessage(
  error: unknown,
  t: ReturnType<typeof useTranslation>['t'],
): string {
  if (!(error instanceof GatewayLoginError)) return t('login.failed');
  const keyByStatus: Record<string, string> = {
    BAD_PASSWORD: 'login.badPassword',
    ACCOUNT_LOCKED: 'login.accountLocked',
    INVALID_2FA_TOKEN: 'login.invalidTwoFactor',
    INVALID_AUTH_TRANSACTION: 'login.twoFactorExpired',
    AUTH_TRANSACTION_EXPIRED: 'login.twoFactorExpired',
    UNSUPPORTED_2FA_METHOD: 'login.twoFactorUnsupported',
    EMAIL_NOT_VERIFIED: 'login.emailNotVerified',
    PASSWORD_EXPIRED: 'login.passwordExpired',
    MAINTENANCE_MODE: 'login.maintenanceMode',
    SERVER_UNAVAILABLE: 'login.serviceUnavailable',
  };
  return t(keyByStatus[error.status] ?? 'login.failed');
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
