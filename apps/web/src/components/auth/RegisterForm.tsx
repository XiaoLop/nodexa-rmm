import {
  ArrowLeftOutlined,
  LockOutlined,
  MailOutlined,
  SendOutlined,
  TagsOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Alert, Button, Form, Input, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BrandLogo } from '../BrandLogo';
import {
  RegistrationError,
  registerMeshUser,
  requestRegistrationAvailability,
  type RegistrationAvailability,
} from '../../features/gateway/registration';

interface RegisterFormValue {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  token?: string;
}

export interface RegisterFormProps {
  /** 切换回登录卡片 */
  onSwitchToLogin: () => void;
  /** 注册成功后的回调 */
  onRegisterSuccess: (username: string) => void;
  /** 外部传入的注册可用性信息 */
  availability?: RegistrationAvailability;
  /** 可用性信息是否加载中 */
  availabilityLoading?: boolean;
  /** 可用性请求是否失败 */
  availabilityFailed?: boolean;
  /** 可选的初始用户名 */
  initialUsername?: string;
}

export function RegisterForm({
  onSwitchToLogin,
  onRegisterSuccess,
  availability: externalAvailability,
  availabilityLoading: externalLoading,
  availabilityFailed: externalFailed,
  initialUsername = '',
}: RegisterFormProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm<RegisterFormValue>();
  const [internalAvailability, setInternalAvailability] = useState<RegistrationAvailability>();
  const [internalFailed, setInternalFailed] = useState(false);
  const [internalLoading, setInternalLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  // If availability is not managed externally, fetch internally
  useEffect(() => {
    if (externalAvailability !== undefined || externalFailed !== undefined) return;
    let active = true;
    setInternalLoading(true);
    void requestRegistrationAvailability()
      .then((result) => {
        if (active) setInternalAvailability(result);
      })
      .catch(() => {
        if (active) setInternalFailed(true);
      })
      .finally(() => {
        if (active) setInternalLoading(false);
      });
    return () => {
      active = false;
    };
  }, [externalAvailability, externalFailed]);

  const availability = externalAvailability ?? internalAvailability;
  const isFailed = externalFailed ?? internalFailed;
  const isLoading = externalLoading ?? internalLoading;

  const registrationUnavailable =
    isFailed || (!isLoading && (!availability?.allowed || availability?.requiresCaptcha === true));

  const handleSubmit = async (values: RegisterFormValue) => {
    setError(undefined);
    setSubmitting(true);
    try {
      const username = values.username.trim();
      await registerMeshUser({
        username,
        email: values.email.trim(),
        password: values.password,
        token: values.token?.trim(),
      });
      form.resetFields();
      onRegisterSuccess(username);
    } catch (nextError) {
      setError(getRegistrationErrorMessage(nextError, t));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-card-content auth-register-card">
      <div className="login-panel-header">
        <div className="login-panel-icon-wrap">
          <BrandLogo compact />
        </div>
        <Typography.Title level={2} className="login-panel-title">
          {t('register.title')}
        </Typography.Title>
        <Typography.Text type="secondary" className="login-panel-subtitle">
          {availability?.isFirstUser
            ? t('register.firstUserSubtitle')
            : t('register.subtitle')}
        </Typography.Text>
      </div>

      {registrationUnavailable ? (
        <div className="register-unavailable-wrap">
          <Alert
            type="warning"
            showIcon
            title={
              availability?.requiresCaptcha
                ? t('register.captchaUnsupported')
                : t('register.unavailable')
            }
            className="register-alert"
          />
          <Button
            type="primary"
            block
            icon={<ArrowLeftOutlined />}
            className="login-submit-btn register-back-btn"
            onClick={onSwitchToLogin}
          >
            {t('register.backToLogin')}
          </Button>
        </div>
      ) : (
        <>
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

          <Form<RegisterFormValue>
            form={form}
            layout="vertical"
            initialValues={{ username: initialUsername }}
            onFinish={(values) => void handleSubmit(values)}
            className="login-form register-form"
            requiredMark={false}
          >
            <Form.Item
              label={t('register.username')}
              name="username"
              rules={[{ required: true, message: t('register.usernameRequired') }]}
            >
              <Input
                size="large"
                prefix={<UserOutlined className="login-input-icon" />}
                placeholder={t('login.usernamePlaceholder')}
                autoComplete="username"
                maxLength={64}
                className="login-input"
              />
            </Form.Item>

            <Form.Item
              label={t('register.email')}
              name="email"
              rules={[
                { required: true, message: t('register.emailRequired') },
                { type: 'email', message: t('register.emailInvalid') },
              ]}
            >
              <Input
                size="large"
                prefix={<MailOutlined className="login-input-icon" />}
                placeholder="user@example.com"
                autoComplete="email"
                maxLength={256}
                className="login-input"
              />
            </Form.Item>

            <Form.Item
              label={t('register.password')}
              name="password"
              rules={[{ required: true, message: t('register.passwordRequired') }]}
            >
              <Input.Password
                size="large"
                prefix={<LockOutlined className="login-input-icon" />}
                placeholder={t('login.passwordPlaceholder')}
                autoComplete="new-password"
                maxLength={256}
                className="login-input"
              />
            </Form.Item>

            <Form.Item
              label={t('register.confirmPassword')}
              name="confirmPassword"
              dependencies={['password']}
              rules={[
                { required: true, message: t('register.confirmPasswordRequired') },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) return Promise.resolve();
                    return Promise.reject(new Error(t('register.passwordMismatch')));
                  },
                }),
              ]}
            >
              <Input.Password
                size="large"
                prefix={<LockOutlined className="login-input-icon" />}
                placeholder={t('register.confirmPasswordRequired')}
                autoComplete="new-password"
                maxLength={256}
                className="login-input"
              />
            </Form.Item>

            {availability?.requiresToken && (
              <Form.Item
                label={t('register.token')}
                name="token"
                rules={[{ required: true, message: t('register.tokenRequired') }]}
              >
                <Input.Password
                  size="large"
                  prefix={<TagsOutlined className="login-input-icon" />}
                  placeholder={t('register.tokenRequired')}
                  autoComplete="off"
                  maxLength={256}
                  className="login-input"
                />
              </Form.Item>
            )}

            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              icon={<SendOutlined />}
              loading={submitting}
              className="login-submit-btn"
            >
              {t('register.submit')}
            </Button>
          </Form>

          <Button
            type="link"
            block
            icon={<ArrowLeftOutlined />}
            className="login-back-btn register-back-btn"
            onClick={onSwitchToLogin}
          >
            {t('register.backToLogin')}
          </Button>
        </>
      )}
    </div>
  );
}

function getRegistrationErrorMessage(
  error: unknown,
  t: ReturnType<typeof useTranslation>['t'],
): string {
  if (!(error instanceof RegistrationError)) return t('register.errors.failed');
  const keyByStatus: Record<string, string> = {
    REGISTRATION_CLOSED: 'register.errors.closed',
    INVALID_REGISTRATION_TOKEN: 'register.errors.invalidToken',
    INVALID_USERNAME: 'register.errors.invalidUsername',
    INVALID_EMAIL: 'register.errors.invalidEmail',
    EMAIL_DOMAIN_NOT_ALLOWED: 'register.errors.emailDomainNotAllowed',
    INVALID_PASSWORD: 'register.errors.invalidPassword',
    USERNAME_EXISTS: 'register.errors.usernameExists',
    ACCOUNT_LIMIT_REACHED: 'register.errors.accountLimitReached',
    MAINTENANCE_MODE: 'register.errors.maintenance',
    ACCESS_DENIED: 'register.errors.accessDenied',
    CAPTCHA_REQUIRED: 'register.captchaUnsupported',
    SERVER_UNAVAILABLE: 'register.errors.unavailable',
  };
  return t(keyByStatus[error.status] ?? 'register.errors.failed');
}
