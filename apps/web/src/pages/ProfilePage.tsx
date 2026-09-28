import {
  CameraOutlined,
  ClockCircleOutlined,
  GlobalOutlined,
  KeyOutlined,
  LockOutlined,
  MailOutlined,
  SafetyCertificateOutlined,
  SyncOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  isFullAdministrator,
  normalizeUserInfo,
  type PreviousLogin,
  type UserInfo,
} from '@meshcentral/control-client';
import { Alert, Button, Empty, Form, Input, Modal, Spin, Tag, Upload, message } from 'antd';
import type { UploadProps } from 'antd';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import { UserAvatar } from '../components/users/UserAvatar';
import { useGatewayData } from '../features/gateway/useGatewayData';
import {
  getTwoFactorCapabilities,
  type TwoFactorCapabilities,
} from '../features/profile/twoFactorCapabilities';
import {
  clearBackupCodes,
  clearTotp,
  confirmTotpSetup,
  generateBackupCodes,
  getBackupCodes,
  requestTotpSetup,
  setEmailTwoFactor,
  type BackupCode,
  type TotpSetup,
} from '../features/profile/twoFactorManagement';
import { useFormatters } from '../i18n/formatters';
import {
  AVATAR_MIME_TYPES,
  MAX_AVATAR_FILE_SIZE,
  prepareAvatarImage,
} from '../utils/avatarImage';
import '../assets/styles/profile.css';

const MANAGED_TWO_FACTOR_METHODS = ['totp', 'email', 'backupCodes'] as const;

interface PasswordFormValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

function errorDetail(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function ProfilePage() {
  const { t } = useTranslation();
  const { dateTime } = useFormatters();
  const { client, status, userInfo, store } = useGatewayData();
  const [emailForm] = Form.useForm<{ email: string }>();
  const [passwordForm] = Form.useForm<PasswordFormValues>();
  const [avatarPreview, setAvatarPreview] = useState<string>();
  const [avatarRefreshKey, setAvatarRefreshKey] = useState(() => Date.now());
  const [avatarSubmitting, setAvatarSubmitting] = useState(false);
  const [emailSubmitting, setEmailSubmitting] = useState(false);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [previousLogins, setPreviousLogins] = useState<PreviousLogin[]>([]);
  const [previousLoginsLoading, setPreviousLoginsLoading] = useState(false);
  const [previousLoginsError, setPreviousLoginsError] = useState<string>();
  const [twoFactorCapabilities, setTwoFactorCapabilities] =
    useState<TwoFactorCapabilities>();
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);
  const [twoFactorError, setTwoFactorError] = useState<string>();
  const [twoFactorSubmitting, setTwoFactorSubmitting] = useState<string>();
  const [totpSetup, setTotpSetup] = useState<TotpSetup>();
  const [totpOpen, setTotpOpen] = useState(false);
  const [backupCodes, setBackupCodes] = useState<BackupCode[]>([]);
  const [backupCodesOpen, setBackupCodesOpen] = useState(false);
  const [totpForm] = Form.useForm<{ token: string }>();
  const [messageApi, messageContextHolder] = message.useMessage();
  const [modalApi, modalContextHolder] = Modal.useModal();
  const connected = status === 'connected';

  useEffect(() => {
    emailForm.setFieldValue('email', userInfo?.email ?? '');
  }, [emailForm, userInfo?.email]);

  useEffect(() => {
    if (!client || !connected || !userInfo) return;
    let active = true;
    setPreviousLoginsLoading(true);
    setPreviousLoginsError(undefined);
    void client.users
      .listPreviousLogins()
      .then(
        (logins) => {
          if (active) setPreviousLogins(logins);
        },
        (error) => {
          if (active) setPreviousLoginsError(errorDetail(error));
        },
      )
      .finally(() => {
        if (active) setPreviousLoginsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [client, connected, userInfo?.id]);

  const loadTwoFactorCapabilities = async (signal?: AbortSignal) => {
    if (!client || !connected || !userInfo) return;
    setTwoFactorLoading(true);
    setTwoFactorError(undefined);
    try {
      setTwoFactorCapabilities(await getTwoFactorCapabilities(client, { signal }));
    } catch (error) {
      if (signal?.aborted) return;
      setTwoFactorCapabilities(undefined);
      setTwoFactorError(errorDetail(error));
    } finally {
      if (!signal?.aborted) setTwoFactorLoading(false);
    }
  };

  useEffect(() => {
    if (!client || !connected || !userInfo) {
      setTwoFactorCapabilities(undefined);
      setTwoFactorError(undefined);
      setTwoFactorLoading(false);
      return;
    }
    const controller = new AbortController();
    void loadTwoFactorCapabilities(controller.signal);
    return () => controller.abort();
  }, [client, connected, userInfo?.id]);

  const refreshPreviousLogins = async () => {
    if (!client || !connected) return;
    setPreviousLoginsLoading(true);
    setPreviousLoginsError(undefined);
    try {
      setPreviousLogins(await client.users.listPreviousLogins());
    } catch (error) {
      setPreviousLoginsError(errorDetail(error));
    } finally {
      setPreviousLoginsLoading(false);
    }
  };

  const refreshTwoFactor = async () => {
    await loadTwoFactorCapabilities();
  };

  const startTotpSetup = async () => {
    if (!client) return;
    setTwoFactorSubmitting('totp');
    try {
      setTotpSetup(await requestTotpSetup(client));
      totpForm.resetFields();
      setTotpOpen(true);
    } catch (error) {
      void messageApi.error(t('profile.security.management.operationFailed', { detail: errorDetail(error) }));
    } finally {
      setTwoFactorSubmitting(undefined);
    }
  };

  const submitTotpSetup = async () => {
    if (!client || !totpSetup) return;
    const { token } = await totpForm.validateFields();
    setTwoFactorSubmitting('totp');
    try {
      await confirmTotpSetup(client, totpSetup.secret, token);
      setTotpOpen(false);
      setTotpSetup(undefined);
      totpForm.resetFields();
      await refreshTwoFactor();
      void messageApi.success(t('profile.security.management.totpEnabled'));
    } catch (error) {
      void messageApi.error(t('profile.security.management.operationFailed', { detail: errorDetail(error) }));
    } finally {
      setTwoFactorSubmitting(undefined);
    }
  };

  const disableTotp = () => {
    if (!client) return;
    modalApi.confirm({
      title: t('profile.security.management.disableTotpTitle'),
      content: t('profile.security.management.disableTotpDescription'),
      okText: t('profile.security.management.disable'),
      okButtonProps: { danger: true },
      cancelText: t('common.actions.cancel'),
      async onOk() {
        setTwoFactorSubmitting('totp');
        try {
          await clearTotp(client);
          await refreshTwoFactor();
          void messageApi.success(t('profile.security.management.totpDisabled'));
        } catch (error) {
          void messageApi.error(t('profile.security.management.operationFailed', { detail: errorDetail(error) }));
          throw error;
        } finally {
          setTwoFactorSubmitting(undefined);
        }
      },
    });
  };

  const toggleEmailTwoFactor = (enabled: boolean) => {
    if (!client) return;
    modalApi.confirm({
      title: t(enabled ? 'profile.security.management.enableEmailTitle' : 'profile.security.management.disableEmailTitle'),
      content: t(enabled ? 'profile.security.management.enableEmailDescription' : 'profile.security.management.disableEmailDescription'),
      okText: t(enabled ? 'profile.security.management.enable' : 'profile.security.management.disable'),
      okButtonProps: { danger: !enabled },
      cancelText: t('common.actions.cancel'),
      async onOk() {
        setTwoFactorSubmitting('email');
        try {
          await setEmailTwoFactor(client, enabled);
          await refreshTwoFactor();
          void messageApi.success(t(enabled ? 'profile.security.management.emailEnabled' : 'profile.security.management.emailDisabled'));
        } catch (error) {
          void messageApi.error(t('profile.security.management.operationFailed', { detail: errorDetail(error) }));
          throw error;
        } finally {
          setTwoFactorSubmitting(undefined);
        }
      },
    });
  };

  const openBackupCodes = async (generate: boolean) => {
    if (!client) return;
    setTwoFactorSubmitting('backupCodes');
    try {
      setBackupCodes(generate ? await generateBackupCodes(client) : await getBackupCodes(client));
      setBackupCodesOpen(true);
      await refreshTwoFactor();
    } catch (error) {
      void messageApi.error(t('profile.security.management.operationFailed', { detail: errorDetail(error) }));
    } finally {
      setTwoFactorSubmitting(undefined);
    }
  };

  const disableBackupCodes = () => {
    if (!client) return;
    modalApi.confirm({
      title: t('profile.security.management.disableBackupCodesTitle'),
      content: t('profile.security.management.disableBackupCodesDescription'),
      okText: t('profile.security.management.disable'),
      okButtonProps: { danger: true },
      cancelText: t('common.actions.cancel'),
      async onOk() {
        setTwoFactorSubmitting('backupCodes');
        try {
          await clearBackupCodes(client);
          setBackupCodes([]);
          setBackupCodesOpen(false);
          await refreshTwoFactor();
          void messageApi.success(t('profile.security.management.backupCodesDisabled'));
        } catch (error) {
          void messageApi.error(t('profile.security.management.operationFailed', { detail: errorDetail(error) }));
          throw error;
        } finally {
          setTwoFactorSubmitting(undefined);
        }
      },
    });
  };

  const mergeAccountEvent = (result: unknown) => {
    const event = result as { account?: unknown };
    const changed = normalizeUserInfo(event.account);
    if (!changed || !userInfo) return;
    const nextUserInfo: UserInfo = { ...userInfo };
    for (const [key, value] of Object.entries(changed)) {
      if (value !== undefined && key !== 'links' && key !== 'removeRights' && key !== 'raw') {
        (nextUserInfo as unknown as Record<string, unknown>)[key] = value;
      }
    }
    nextUserInfo.raw = { ...(userInfo.raw as object), ...(changed.raw as object) };
    store.getState().setUserInfo(nextUserInfo);
  };

  const beforeAvatarUpload: UploadProps['beforeUpload'] = (file) => {
    if (!(AVATAR_MIME_TYPES as readonly string[]).includes(file.type)) {
      void messageApi.error(t('profile.messages.invalidImageType'));
      return Upload.LIST_IGNORE;
    }
    if (file.size > MAX_AVATAR_FILE_SIZE) {
      void messageApi.error(t('profile.messages.avatarTooLarge'));
      return Upload.LIST_IGNORE;
    }
    void prepareAvatarImage(file).then(setAvatarPreview, () => {
      void messageApi.error(t('profile.messages.imageReadFailed'));
    });
    return false;
  };

  const saveAvatar = async () => {
    if (!client || !userInfo || !avatarPreview) return;
    setAvatarSubmitting(true);
    try {
      await client.users.updateCurrentImage(userInfo.id, avatarPreview);
      store.getState().setUserInfo({ ...userInfo, image: avatarPreview });
      setAvatarPreview(undefined);
      setAvatarRefreshKey(Date.now());
      void messageApi.success(t('profile.messages.avatarUpdated'));
    } catch (error) {
      void messageApi.error(
        t('profile.messages.avatarUpdateFailed', { detail: errorDetail(error) }),
      );
    } finally {
      setAvatarSubmitting(false);
    }
  };

  const saveEmail = async () => {
    if (!client) return;
    const { email } = await emailForm.validateFields();
    if (email.trim() === (userInfo?.email ?? '')) {
      void messageApi.info(t('profile.messages.emailUnchanged'));
      return;
    }
    setEmailSubmitting(true);
    try {
      if (!userInfo) return;
      const result = await client.users.changeCurrentEmail(userInfo.id, email);
      mergeAccountEvent(result);
      void messageApi.success(t('profile.messages.emailUpdated'));
    } catch (error) {
      void messageApi.error(
        t('profile.messages.emailUpdateFailed', { detail: errorDetail(error) }),
      );
    } finally {
      setEmailSubmitting(false);
    }
  };

  const savePassword = async () => {
    if (!client || !userInfo) return;
    const values = await passwordForm.validateFields();
    setPasswordSubmitting(true);
    try {
      const result = await client.users.changeCurrentPassword(
        userInfo.id,
        values.currentPassword,
        values.newPassword,
      );
      mergeAccountEvent(result);
      passwordForm.resetFields();
      setPasswordOpen(false);
      void messageApi.success(t('profile.messages.passwordUpdated'));
    } catch (error) {
      void messageApi.error(
        t('profile.messages.passwordUpdateFailed', { detail: errorDetail(error) }),
      );
    } finally {
      setPasswordSubmitting(false);
    }
  };

  const formatDate = (value?: string) => (value ? dateTime(value) : t('profile.notAvailable'));

  return (
    <div className="profile-page page-stack">
      {messageContextHolder}
      {modalContextHolder}
      <div className="page-heading profile-heading">
        <div>
          <h1>{t('profile.title')}</h1>
          <p>{t('profile.subtitle')}</p>
        </div>
        <Tag color={connected ? 'success' : 'warning'}>
          {connected ? t('profile.connected') : t('profile.disconnected')}
        </Tag>
      </div>

      {!userInfo ? (
        <Alert type="warning" showIcon message={t('profile.unavailable')} />
      ) : (
        <div className="profile-layout">
          <aside className="profile-identity console-card">
            <div className="profile-avatar-stage">
              <UserAvatar
                size={112}
                username={userInfo.name}
                refreshKey={avatarRefreshKey}
                src={avatarPreview ?? userInfo.image}
                hasImage={Boolean(avatarPreview || userInfo.image || userInfo.hasImage)}
              />
              <span className="profile-avatar-badge">
                <CameraOutlined />
              </span>
            </div>
            <h2>{userInfo.name ?? userInfo.id}</h2>
            <span className="profile-user-id">{userInfo.id}</span>
            <Tag color={isFullAdministrator(userInfo.siteadmin ?? 0) ? 'blue' : 'default'}>
              {isFullAdministrator(userInfo.siteadmin ?? 0)
                ? t('profile.siteAdministrator')
                : t('profile.standardUser')}
            </Tag>
            <div className="profile-avatar-actions">
              <Upload
                accept="image/jpeg,image/png,image/gif,image/webp"
                beforeUpload={beforeAvatarUpload}
                maxCount={1}
                showUploadList={false}
              >
                <Button icon={<CameraOutlined />}>{t('profile.selectAvatar')}</Button>
              </Upload>
              {avatarPreview ? (
                <Button
                  type="primary"
                  loading={avatarSubmitting}
                  disabled={!connected}
                  onClick={() => void saveAvatar()}
                >
                  {t('profile.saveAvatar')}
                </Button>
              ) : null}
            </div>
            <p className="profile-avatar-hint">{t('profile.avatarHint')}</p>
          </aside>

          <main className="profile-main-column">
            <section className="console-card profile-section">
              <header>
                <span>
                  <UserOutlined />
                </span>
                <div>
                  <h2>{t('profile.basic.title')}</h2>
                  <p>{t('profile.basic.description')}</p>
                </div>
              </header>
              <div className="profile-readonly-row">
                <div>
                  <label>{t('profile.basic.username')}</label>
                  <strong>{userInfo.name ?? t('profile.notAvailable')}</strong>
                </div>
                <Tag>{t('profile.readOnly')}</Tag>
              </div>
              <Form form={emailForm} layout="vertical" className="profile-email-form">
                <Form.Item
                  name="email"
                  label={t('profile.basic.email')}
                  rules={[
                    { required: true, message: t('profile.validation.emailRequired') },
                    { type: 'email', message: t('profile.validation.emailInvalid') },
                  ]}
                >
                  <Input prefix={<MailOutlined />} maxLength={256} />
                </Form.Item>
                <Button
                  type="primary"
                  loading={emailSubmitting}
                  disabled={!connected}
                  onClick={() => void saveEmail().catch(() => undefined)}
                >
                  {t('profile.basic.saveEmail')}
                </Button>
              </Form>
            </section>

            <section className="console-card profile-section">
              <header>
                <span>
                  <ClockCircleOutlined />
                </span>
                <div>
                  <h2>{t('profile.account.title')}</h2>
                  <p>{t('profile.account.description')}</p>
                </div>
              </header>
              <dl className="profile-info-grid">
                <div>
                  <dt>{t('profile.account.createdAt')}</dt>
                  <dd>{formatDate(userInfo.creationAt)}</dd>
                </div>
                <div>
                  <dt>{t('profile.account.lastLogin')}</dt>
                  <dd>{formatDate(userInfo.lastLoginAt)}</dd>
                </div>
                <div>
                  <dt>{t('profile.account.previousLogin')}</dt>
                  <dd>{formatDate(userInfo.previousLoginAt)}</dd>
                </div>
                <div>
                  <dt>{t('profile.account.lastAccess')}</dt>
                  <dd>{formatDate(userInfo.lastAccessAt)}</dd>
                </div>
              </dl>
            </section>

            <section className="console-card profile-section profile-login-section">
              <header>
                <span>
                  <GlobalOutlined />
                </span>
                <div>
                  <h2>{t('profile.logins.title')}</h2>
                  <p>{t('profile.logins.description')}</p>
                </div>
                <Button
                  type="text"
                  size="small"
                  icon={<SyncOutlined spin={previousLoginsLoading} />}
                  disabled={!connected || previousLoginsLoading}
                  onClick={() => void refreshPreviousLogins()}
                >
                  {t('profile.logins.refresh')}
                </Button>
              </header>
              {previousLoginsError ? (
                <Alert
                  type="error"
                  showIcon
                  message={t('profile.logins.loadFailed')}
                  description={previousLoginsError}
                  action={
                    <Button size="small" onClick={() => void refreshPreviousLogins()}>
                      {t('profile.logins.retry')}
                    </Button>
                  }
                />
              ) : previousLoginsLoading && !previousLogins.length ? (
                <div className="profile-login-loading">
                  <Spin size="small" /> {t('profile.logins.loading')}
                </div>
              ) : previousLogins.length ? (
                <div className="profile-login-list">
                  {previousLogins.slice(0, 10).map((login, index) => (
                    <article className="profile-login-row" key={`${login.occurredAt}-${index}`}>
                      <span className="profile-login-marker" />
                      <div className="profile-login-time">
                        <strong>{dateTime(login.occurredAt)}</strong>
                        <small>
                          {t('profile.logins.messageCode', { code: login.messageId ?? '—' })}
                        </small>
                      </div>
                      <div className="profile-login-client">
                        <strong>{login.client ?? t('profile.notAvailable')}</strong>
                        <small>{login.platform ?? t('profile.notAvailable')}</small>
                      </div>
                      <code>{login.ip ?? '—'}</code>
                    </article>
                  ))}
                </div>
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={t('profile.logins.empty')}
                />
              )}
            </section>
          </main>

          <aside className="profile-security console-card">
            <header>
              <span>
                <SafetyCertificateOutlined />
              </span>
              <div>
                <h2>{t('profile.security.title')}</h2>
                <p>{t('profile.security.description')}</p>
              </div>
            </header>
            <div className="profile-security-item">
              <span className="profile-security-icon">
                <KeyOutlined />
              </span>
              <div>
                <strong>{t('profile.security.password')}</strong>
                <small>{formatDate(userInfo.passwordChangedAt)}</small>
              </div>
              <Button size="small" disabled={!connected} onClick={() => setPasswordOpen(true)}>
                {t('profile.security.change')}
              </Button>
            </div>
            {twoFactorError ? (
              <div className="profile-security-item">
                <span className="profile-security-icon">
                  <LockOutlined />
                </span>
                <div>
                  <strong>{t('profile.security.twoFactor')}</strong>
                  <small>{twoFactorError}</small>
                </div>
                <Button
                  size="small"
                  disabled={!connected || twoFactorLoading}
                  onClick={() => void loadTwoFactorCapabilities()}
                >
                  {t('profile.security.retry')}
                </Button>
              </div>
            ) : twoFactorLoading && !twoFactorCapabilities ? (
              <div className="profile-security-item is-static">
                <span className="profile-security-icon">
                  <LockOutlined />
                </span>
                <div>
                  <strong>{t('profile.security.twoFactor')}</strong>
                  <small>{t('profile.security.twoFactorLoading')}</small>
                </div>
                <Spin size="small" />
              </div>
            ) : null}
            {MANAGED_TWO_FACTOR_METHODS.filter(
              (methodName) => twoFactorCapabilities?.methods[methodName].enabled === true,
            ).map((methodName) => {
                const method = twoFactorCapabilities?.methods[methodName];
                return (
                  <div className="profile-security-item" key={methodName}>
                    <span className="profile-security-icon">
                      <LockOutlined />
                    </span>
                    <div>
                      <strong>{t(`profile.security.twoFactorMethods.${methodName}`)}</strong>
                      <small>
                        {method?.configured
                          ? t('profile.security.management.configured')
                          : twoFactorCapabilities?.forced
                            ? t('profile.security.twoFactorForced')
                            : method?.enabled
                              ? t('profile.security.twoFactorDescription')
                              : t('profile.security.twoFactorUnavailable')}
                      </small>
                    </div>
                    {methodName === 'totp' ? (
                      <Button
                        size="small"
                        danger={method?.configured}
                        loading={twoFactorSubmitting === methodName}
                        disabled={!method?.enabled || !method.canConfigure}
                        onClick={() => method?.configured ? disableTotp() : void startTotpSetup()}
                      >
                        {t(method?.configured ? 'profile.security.management.disable' : 'profile.security.management.enable')}
                      </Button>
                    ) : methodName === 'email' ? (
                      <Button
                        size="small"
                        danger={method?.configured}
                        loading={twoFactorSubmitting === methodName}
                        disabled={!method?.enabled || !method.canConfigure}
                        onClick={() => toggleEmailTwoFactor(!method?.configured)}
                      >
                        {t(method?.configured ? 'profile.security.management.disable' : 'profile.security.management.enable')}
                      </Button>
                    ) : methodName === 'backupCodes' ? (
                      <Button
                        size="small"
                        loading={twoFactorSubmitting === methodName}
                        disabled={!method?.enabled || !method.canConfigure}
                        onClick={() => void openBackupCodes(!method?.configured)}
                      >
                        {t(method?.configured ? 'profile.security.management.manage' : 'profile.security.management.enable')}
                      </Button>
                    ) : null}
                  </div>
                );
              })}
          </aside>
        </div>
      )}

      <Modal
        title={t('profile.security.management.totpTitle')}
        open={totpOpen}
        okText={t('profile.security.management.confirmTotp')}
        cancelText={t('common.actions.cancel')}
        confirmLoading={twoFactorSubmitting === 'totp'}
        onCancel={() => {
          setTotpOpen(false);
          setTotpSetup(undefined);
          totpForm.resetFields();
        }}
        onOk={() => void submitTotpSetup().catch(() => undefined)}
        destroyOnHidden
      >
        {totpSetup ? (
          <div className="profile-totp-setup">
            <QRCodeSVG value={totpSetup.url} size={184} level="M" />
            <p>{t('profile.security.management.totpInstructions')}</p>
            <code>{totpSetup.secret}</code>
            <Form form={totpForm} layout="vertical">
              <Form.Item
                name="token"
                label={t('profile.security.management.totpCode')}
                rules={[
                  { required: true, message: t('profile.security.management.totpCodeRequired') },
                  { pattern: /^\d{6}$/, message: t('profile.security.management.totpCodeInvalid') },
                ]}
              >
                <Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} />
              </Form.Item>
            </Form>
          </div>
        ) : null}
      </Modal>

      <Modal
        title={t('profile.security.management.backupCodesTitle')}
        open={backupCodesOpen}
        onCancel={() => setBackupCodesOpen(false)}
        footer={[
          <Button key="regenerate" onClick={() => void openBackupCodes(true)} loading={twoFactorSubmitting === 'backupCodes'}>
            {t('profile.security.management.regenerate')}
          </Button>,
          <Button key="disable" danger onClick={disableBackupCodes}>
            {t('profile.security.management.disable')}
          </Button>,
          <Button key="close" type="primary" onClick={() => setBackupCodesOpen(false)}>
            {t('common.actions.close')}
          </Button>,
        ]}
      >
        <Alert type="warning" showIcon message={t('profile.security.management.backupCodesNotice')} />
        <div className="profile-backup-codes">
          {backupCodes.map((backupCode) => (
            <code className={backupCode.unused ? undefined : 'is-used'} key={backupCode.code}>
              {String(backupCode.code).padStart(8, '0')}
            </code>
          ))}
        </div>
      </Modal>

      <Modal
        title={t('profile.password.title')}
        open={passwordOpen}
        okText={t('profile.password.submit')}
        cancelText={t('common.actions.cancel')}
        confirmLoading={passwordSubmitting}
        onCancel={() => {
          setPasswordOpen(false);
          passwordForm.resetFields();
        }}
        onOk={() => void savePassword().catch(() => undefined)}
        destroyOnHidden
      >
        <Alert type="warning" showIcon message={t('profile.password.notice')} />
        <Form form={passwordForm} layout="vertical" className="profile-password-form">
          <Form.Item
            name="currentPassword"
            label={t('profile.password.current')}
            rules={[{ required: true, message: t('profile.validation.currentPasswordRequired') }]}
          >
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Form.Item
            name="newPassword"
            label={t('profile.password.new')}
            rules={[{ required: true, message: t('profile.validation.newPasswordRequired') }]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label={t('profile.password.confirm')}
            dependencies={['newPassword']}
            rules={[
              { required: true, message: t('profile.validation.confirmPasswordRequired') },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  return !value || getFieldValue('newPassword') === value
                    ? Promise.resolve()
                    : Promise.reject(new Error(t('profile.validation.passwordMismatch')));
                },
              }),
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
