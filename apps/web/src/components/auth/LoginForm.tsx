import {
  ArrowRightOutlined,
  KeyOutlined,
  LockOutlined,
  UserAddOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Alert, Button, Checkbox, Form, Input, Segmented, Tooltip, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { BrandLogo } from '../BrandLogo';
import {
  GatewayLoginError,
  useGateway,
  type TwoFactorChallenge,
} from '../../features/gateway/GatewayProvider';

interface LoginFormValue {
  username: string;
  password: string;
}

interface TwoFactorFormValue {
  code: string;
}

const REMEMBERED_USER_KEY = 'nodexa_rmm_saved_username';

export interface LoginFormProps {
  /** 切换到注册卡片 */
  onSwitchToRegister?: () => void;
  /** 是否允许注册新账号 */
  registrationAllowed?: boolean;
  /** 注册成功后传递过来的用户名 */
  registeredUsername?: string;
  /** 是否展示注册成功提示 */
  registrationSucceeded?: boolean;
  /** 清除注册成功提示 */
  onClearRegistrationSuccess?: () => void;
}

export function LoginForm({
  onSwitchToRegister,
  registrationAllowed = false,
  registeredUsername,
  registrationSucceeded = false,
  onClearRegistrationSuccess,
}: LoginFormProps) {
  const { t } = useTranslation();
  const gateway = useGateway();
  const navigate = useNavigate();
  const location = useLocation();

  const [form] = Form.useForm<LoginFormValue>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [challenge, setChallenge] = useState<TwoFactorChallenge>();
  const [pendingUsername, setPendingUsername] = useState('');
  const [twoFactorType, setTwoFactorType] = useState<'totp' | 'backup'>('totp');

  const [initialUsername] = useState(() => {
    try {
      return localStorage.getItem(REMEMBERED_USER_KEY) || '';
    } catch {
      return '';
    }
  });
  const [rememberMe, setRememberMe] = useState(() => Boolean(initialUsername));

  useEffect(() => {
    if (registeredUsername) {
      form.setFieldsValue({ username: registeredUsername, password: '' });
    }
  }, [registeredUsername, form]);

  const handleSubmit = async (values: LoginFormValue) => {
    setError(undefined);
    onClearRegistrationSuccess?.();
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

  return (
    <div className="auth-card-content auth-login-card">
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
      {!error && registrationSucceeded && (
        <Alert
          type="success"
          showIcon
          title={t('login.registrationSucceeded')}
          className="login-success-alert"
          closable
          onClose={onClearRegistrationSuccess}
        />
      )}

      {!challenge ? (
        <Form<LoginFormValue>
          form={form}
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

          {registrationAllowed && (
            <Button
              size="large"
              block
              icon={<UserAddOutlined />}
              htmlType="button"
              onClick={onSwitchToRegister}
              className="login-register-btn"
            >
              {t('login.register')}
            </Button>
          )}
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
    </div>
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
