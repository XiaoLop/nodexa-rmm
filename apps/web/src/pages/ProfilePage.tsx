import {
  CameraOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  MailOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  isFullAdministrator,
  normalizeUserInfo,
  type PreviousLogin,
  type UserInfo,
} from '@meshcentral/control-client';
import { Alert, Button, Form, Input, Modal, Tag, Upload, message } from 'antd';
import type { UploadProps } from 'antd';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UserAvatar } from '../components/users/UserAvatar';
import { useGatewayData } from '../features/gateway/useGatewayData';
import { BackupCodesModal } from '../features/profile/BackupCodesModal';
import {
  PasswordChangeModal,
  type PasswordFormValues,
} from '../features/profile/PasswordChangeModal';
import { PreviousLoginsSection } from '../features/profile/PreviousLoginsSection';
import { SecuritySettingsPanel } from '../features/profile/SecuritySettingsPanel';
import { TotpSetupModal } from '../features/profile/TotpSetupModal';
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
  const [allBackupCodesCopied, setAllBackupCodesCopied] = useState(false);
  const [copiedBackupCodeIndex, setCopiedBackupCodeIndex] = useState<number | null>(null);
  const [totpForm] = Form.useForm<{ token: string }>();
  const [secretCopied, setSecretCopied] = useState(false);
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

  const handleCopySecret = async (secret?: string) => {
    if (!secret) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(secret);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = secret;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setSecretCopied(true);
      void messageApi.success(t('profile.security.management.totpCopiedSecret'));
      setTimeout(() => setSecretCopied(false), 2500);
    } catch {
      void messageApi.error(t('profile.security.management.operationFailed', { detail: 'Copy failed' }));
    }
  };

  const startTotpSetup = async () => {
    if (!client) return;
    setTwoFactorSubmitting('totp');
    try {
      setTotpSetup(await requestTotpSetup(client));
      setSecretCopied(false);
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
    } catch {
      void messageApi.error(t('profile.security.management.totpVerificationFailed'));
      try {
        setTotpSetup(await requestTotpSetup(client));
        setSecretCopied(false);
        totpForm.resetFields();
      } catch (refreshError) {
        setTotpOpen(false);
        setTotpSetup(undefined);
        void messageApi.error(
          t('profile.security.management.operationFailed', {
            detail: errorDetail(refreshError),
          }),
        );
      }
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
    if (!client || !twoFactorCapabilities?.methods.totp.configured) return;
    setTwoFactorSubmitting('backupCodes');
    try {
      setBackupCodes(generate ? await generateBackupCodes(client) : await getBackupCodes(client));
      setAllBackupCodesCopied(false);
      setCopiedBackupCodeIndex(null);
      setBackupCodesOpen(true);
      await refreshTwoFactor();
    } catch (error) {
      void messageApi.error(t('profile.security.management.operationFailed', { detail: errorDetail(error) }));
    } finally {
      setTwoFactorSubmitting(undefined);
    }
  };

  const handleCopyAllBackupCodes = async () => {
    const unusedCodes = backupCodes
      .filter((bc) => bc.unused)
      .map((bc) => String(bc.code).padStart(8, '0'));
    if (!unusedCodes.length) {
      void messageApi.warning(t('profile.security.management.noUnusedCodesToCopy'));
      return;
    }
    const text = unusedCodes.join('\n');
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setAllBackupCodesCopied(true);
      void messageApi.success(t('profile.security.management.copiedAllCodes'));
      setTimeout(() => setAllBackupCodesCopied(false), 2500);
    } catch {
      void messageApi.error(t('profile.security.management.operationFailed', { detail: 'Copy failed' }));
    }
  };

  const handleCopySingleBackupCode = async (code: number, index: number) => {
    const rawCode = String(code).padStart(8, '0');
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(rawCode);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = rawCode;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedBackupCodeIndex(index);
      void messageApi.success(
        t('profile.security.management.copiedSingleCode', {
          code: `${rawCode.slice(0, 4)} ${rawCode.slice(4)}`,
        }),
      );
      setTimeout(() => setCopiedBackupCodeIndex(null), 2000);
    } catch {
      void messageApi.error(t('profile.security.management.operationFailed', { detail: 'Copy failed' }));
    }
  };

  const handleDownloadBackupCodes = () => {
    if (!backupCodes.length) return;
    const content = [
      'MeshCentral Recovery Codes',
      '========================',
      `Account: ${userInfo?.name ?? userInfo?.id ?? 'User'} (${userInfo?.id ?? ''})`,
      `Exported: ${new Date().toISOString()}`,
      '',
      'Keep these backup recovery codes in a safe place (e.g. your password manager).',
      'Each code can only be used once to access your account if your authenticator app is lost.',
      '',
      'Recovery Codes:',
      ...backupCodes.map((bc, idx) => {
        const codeStr = String(bc.code).padStart(8, '0');
        const formatted = `${codeStr.slice(0, 4)} ${codeStr.slice(4)}`;
        return `  ${String(idx + 1).padStart(2, '0')}. ${formatted}  ${bc.unused ? '[Available]' : '[Used]'}`;
      }),
      '',
      '* Notice: Regenerating codes will immediately invalidate all previous codes.',
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `meshcentral-recovery-codes-${userInfo?.name ?? 'account'}.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    void messageApi.success(t('profile.security.management.downloadedCodes'));
  };

  const confirmRegenerateBackupCodes = () => {
    modalApi.confirm({
      title: t('profile.security.management.confirmRegenerateTitle'),
      icon: <ExclamationCircleOutlined style={{ color: '#faad14' }} />,
      content: t('profile.security.management.confirmRegenerateDescription'),
      okText: t('profile.security.management.regenerate'),
      okButtonProps: { danger: true },
      cancelText: t('common.actions.cancel'),
      async onOk() {
        await openBackupCodes(true);
      },
    });
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

            <PreviousLoginsSection
              connected={connected}
              error={previousLoginsError}
              loading={previousLoginsLoading}
              logins={previousLogins}
              formatDateTime={dateTime}
              onRefresh={() => void refreshPreviousLogins()}
            />
          </main>

          <SecuritySettingsPanel
            connected={connected}
            passwordChangedAt={formatDate(userInfo.passwordChangedAt)}
            capabilities={twoFactorCapabilities}
            loading={twoFactorLoading}
            error={twoFactorError}
            submitting={twoFactorSubmitting}
            onChangePassword={() => setPasswordOpen(true)}
            onDisableTotp={disableTotp}
            onOpenBackupCodes={(generate) => void openBackupCodes(generate)}
            onRetry={() => void loadTwoFactorCapabilities()}
            onStartTotp={() => void startTotpSetup()}
            onToggleEmail={toggleEmailTwoFactor}
          />
        </div>
      )}

      <TotpSetupModal
        form={totpForm}
        open={totpOpen}
        setup={totpSetup}
        submitting={twoFactorSubmitting === 'totp'}
        secretCopied={secretCopied}
        onCancel={() => {
          setTotpOpen(false);
          setTotpSetup(undefined);
          setSecretCopied(false);
          totpForm.resetFields();
        }}
        onCopySecret={(secret) => void handleCopySecret(secret)}
        onSubmit={() => void submitTotpSetup().catch(() => undefined)}
      />

      <BackupCodesModal
        codes={backupCodes}
        open={backupCodesOpen}
        submitting={twoFactorSubmitting === 'backupCodes'}
        allCodesCopied={allBackupCodesCopied}
        copiedCodeIndex={copiedBackupCodeIndex}
        onCancel={() => setBackupCodesOpen(false)}
        onCopyAll={() => void handleCopyAllBackupCodes()}
        onCopyCode={(code, index) => void handleCopySingleBackupCode(code, index)}
        onDisable={disableBackupCodes}
        onDownload={handleDownloadBackupCodes}
        onRegenerate={confirmRegenerateBackupCodes}
      />

      <PasswordChangeModal
        form={passwordForm}
        open={passwordOpen}
        submitting={passwordSubmitting}
        onCancel={() => {
          setPasswordOpen(false);
          passwordForm.resetFields();
        }}
        onSubmit={() => void savePassword().catch(() => undefined)}
      />
    </div>
  );
}
