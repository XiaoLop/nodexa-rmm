import {
  AppstoreOutlined,
  CalendarOutlined,
  CameraOutlined,
  ClockCircleOutlined,
  CopyOutlined,
  CrownOutlined,
  ExclamationCircleOutlined,
  GlobalOutlined,
  HistoryOutlined,
  InfoCircleOutlined,
  KeyOutlined,
  LockOutlined,
  LoginOutlined,
  MailOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  isFullAdministrator,
  normalizeUserInfo,
  type PreviousLogin,
  type UserInfo,
} from '@meshcentral/control-client';
import { Alert, Button, Form, Input, Modal, Tag, Tooltip, Upload, message } from 'antd';
import type { UploadProps } from 'antd';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { UserAvatar } from '../components/users/UserAvatar';
import { useMeshCentralControlData } from '../features/gateway/useMeshCentralControlData';
import { BackupCodesModal } from '../features/profile/BackupCodesModal';
import { LoginTokensSection } from '../features/profile/LoginTokensSection';
import {
  PasswordChangeModal,
  type PasswordFormValues,
} from '../features/profile/PasswordChangeModal';
import { PreviousLoginsSection } from '../features/profile/PreviousLoginsSection';
import { SecuritySettingsPanel } from '../features/profile/SecuritySettingsPanel';
import {
  SecurityKeysModal,
  type SecurityKeyFormValues,
} from '../features/profile/SecurityKeysModal';
import { TotpSetupModal } from '../features/profile/TotpSetupModal';
import {
  getTwoFactorCapabilities,
  type TwoFactorCapabilities,
} from '../features/profile/twoFactorCapabilities';
import {
  clearBackupCodes,
  clearTotp,
  completeWebAuthnRegistration,
  confirmTotpSetup,
  createWebAuthnCredential,
  generateBackupCodes,
  getBackupCodes,
  getSecurityKeys,
  removeSecurityKey,
  requestTotpSetup,
  requestWebAuthnRegistration,
  setEmailTwoFactor,
  type BackupCode,
  type SecurityKey,
  type TotpSetup,
} from '../features/profile/twoFactorManagement';
import { useFormatters } from '../i18n/formatters';
import {
  AVATAR_MIME_TYPES,
  MAX_AVATAR_FILE_SIZE,
  prepareAvatarImage,
} from '../utils/avatarImage';
import '../assets/styles/profile.css';

type ProfileTab = 'overview' | 'security' | 'tokens' | 'activity';

const PROFILE_TABS: Array<{ key: ProfileTab; labelKey: string; icon: ReactNode }> = [
  { key: 'overview', labelKey: 'profile.tabs.overview', icon: <AppstoreOutlined /> },
  { key: 'security', labelKey: 'profile.tabs.security', icon: <SafetyCertificateOutlined /> },
  { key: 'tokens', labelKey: 'profile.tabs.tokens', icon: <KeyOutlined /> },
  { key: 'activity', labelKey: 'profile.tabs.activity', icon: <GlobalOutlined /> },
];

function errorDetail(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function ProfilePage() {
  const { t } = useTranslation();
  const { dateTime } = useFormatters();
  const { client, status, userInfo, store } = useMeshCentralControlData();
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');
  const [emailForm] = Form.useForm<{ email: string }>();
  const [passwordForm] = Form.useForm<PasswordFormValues>();
  const [securityKeyForm] = Form.useForm<SecurityKeyFormValues>();
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
  const [securityKeys, setSecurityKeys] = useState<SecurityKey[]>([]);
  const [securityKeysOpen, setSecurityKeysOpen] = useState(false);
  const [securityKeysLoading, setSecurityKeysLoading] = useState(false);
  const [removingSecurityKeyIndex, setRemovingSecurityKeyIndex] = useState<number | null>(null);
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

  const loadSecurityKeys = async () => {
    if (!client) return;
    setSecurityKeysLoading(true);
    try {
      setSecurityKeys(await getSecurityKeys(client));
    } finally {
      setSecurityKeysLoading(false);
    }
  };

  const openSecurityKeys = async () => {
    setSecurityKeysOpen(true);
    try {
      await loadSecurityKeys();
    } catch (error) {
      setSecurityKeysOpen(false);
      void messageApi.error(
        t('profile.security.management.operationFailed', { detail: errorDetail(error) }),
      );
    }
  };

  const addSecurityKey = async () => {
    if (!client) return;
    const { name } = await securityKeyForm.validateFields();
    setTwoFactorSubmitting('webauthn');
    try {
      const challenge = await requestWebAuthnRegistration(client, name.trim());
      const credential = await createWebAuthnCredential(challenge);
      await completeWebAuthnRegistration(client, credential);
      securityKeyForm.resetFields();
      await loadSecurityKeys();
      await refreshTwoFactor();
      void messageApi.success(t('profile.securityKeys.added'));
    } catch (error) {
      const detail =
        error instanceof DOMException && error.name === 'NotAllowedError'
          ? t('profile.securityKeys.registrationCancelled')
          : errorDetail(error);
      void messageApi.error(
        t('profile.security.management.operationFailed', { detail }),
      );
    } finally {
      setTwoFactorSubmitting(undefined);
    }
  };

  const confirmRemoveSecurityKey = (securityKey: SecurityKey) => {
    if (!client) return;
    modalApi.confirm({
      title: t('profile.securityKeys.removeTitle'),
      content: t('profile.securityKeys.removeDescription', {
        name: securityKey.name,
      }),
      okText: t('profile.securityKeys.remove'),
      okButtonProps: { danger: true },
      cancelText: t('common.actions.cancel'),
      async onOk() {
        setTwoFactorSubmitting('webauthn');
        setRemovingSecurityKeyIndex(securityKey.index);
        try {
          const keys = await removeSecurityKey(client, securityKey.index);
          if (keys.some((key) => key.index === securityKey.index)) {
            throw new Error(t('profile.securityKeys.removalNotConfirmed'));
          }
          setSecurityKeys(keys);
          await refreshTwoFactor();
          void messageApi.success(t('profile.securityKeys.removed'));
        } catch (error) {
          void messageApi.error(
            t('profile.security.management.operationFailed', { detail: errorDetail(error) }),
          );
          throw error;
        } finally {
          setTwoFactorSubmitting(undefined);
          setRemovingSecurityKeyIndex(null);
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

  const handleCopyUserId = async () => {
    if (!userInfo?.id) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(userInfo.id);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = userInfo.id;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      void messageApi.success(t('profile.idCopied'));
    } catch {
      void messageApi.error(t('profile.security.management.operationFailed', { detail: 'Copy failed' }));
    }
  };

  const handleCancelAvatarPreview = () => {
    setAvatarPreview(undefined);
  };

  const renderBasicProfile = () => (
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
      <div className="profile-basic-fields">
        <div className="profile-field-item">
          <div className="profile-field-header">
            <label>{t('profile.basic.username')}</label>
            <Tag icon={<LockOutlined />}>{t('profile.readOnly')}</Tag>
          </div>
          <div className="profile-field-value">
            <UserOutlined className="profile-field-icon" />
            <strong>{userInfo?.name ?? t('profile.notAvailable')}</strong>
          </div>
        </div>

        <div className="profile-field-item">
          <div className="profile-field-header">
            <label>{t('profile.basic.email')}</label>
            {userInfo?.email ? (
              <Tag color="success">{t('profile.security.verified')}</Tag>
            ) : (
              <Tag>{t('profile.security.unverified')}</Tag>
            )}
          </div>
          <Form form={emailForm} layout="vertical" className="profile-email-form">
            <Form.Item
              name="email"
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
        </div>
      </div>
    </section>
  );

  const renderAccountDetails = () => (
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
      <div className="profile-metrics-grid">
        <div className="profile-metric-card">
          <div className="profile-metric-icon-wrap is-created">
            <CalendarOutlined />
          </div>
          <div className="profile-metric-content">
            <span className="profile-metric-label">{t('profile.account.createdAt')}</span>
            <strong className="profile-metric-value">{formatDate(userInfo?.creationAt)}</strong>
          </div>
        </div>

        <div className="profile-metric-card">
          <div className="profile-metric-icon-wrap is-last-login">
            <LoginOutlined />
          </div>
          <div className="profile-metric-content">
            <span className="profile-metric-label">{t('profile.account.lastLogin')}</span>
            <strong className="profile-metric-value">{formatDate(userInfo?.lastLoginAt)}</strong>
          </div>
        </div>

        <div className="profile-metric-card">
          <div className="profile-metric-icon-wrap is-prev-login">
            <HistoryOutlined />
          </div>
          <div className="profile-metric-content">
            <span className="profile-metric-label">{t('profile.account.previousLogin')}</span>
            <strong className="profile-metric-value">{formatDate(userInfo?.previousLoginAt)}</strong>
          </div>
        </div>

        <div className="profile-metric-card">
          <div className="profile-metric-icon-wrap is-last-access">
            <ThunderboltOutlined />
          </div>
          <div className="profile-metric-content">
            <span className="profile-metric-label">{t('profile.account.lastAccess')}</span>
            <strong className="profile-metric-value">{formatDate(userInfo?.lastAccessAt)}</strong>
          </div>
        </div>
      </div>
    </section>
  );

  const renderSecurityPanel = () => (
    <SecuritySettingsPanel
      connected={connected}
      passwordChangedAt={formatDate(userInfo?.passwordChangedAt)}
      capabilities={twoFactorCapabilities}
      loading={twoFactorLoading}
      error={twoFactorError}
      submitting={twoFactorSubmitting}
      onChangePassword={() => setPasswordOpen(true)}
      onDisableTotp={disableTotp}
      onManageWebAuthn={() => void openSecurityKeys()}
      onOpenBackupCodes={(generate) => void openBackupCodes(generate)}
      onRetry={() => void loadTwoFactorCapabilities()}
      onStartTotp={() => void startTotpSetup()}
      onToggleEmail={toggleEmailTwoFactor}
    />
  );

  const renderTokensSection = () => (
    <LoginTokensSection
      client={client}
      connected={connected}
      formatDateTime={dateTime}
    />
  );

  const renderLoginsSection = () => (
    <PreviousLoginsSection
      connected={connected}
      error={previousLoginsError}
      loading={previousLoginsLoading}
      logins={previousLogins}
      formatDateTime={dateTime}
      onRefresh={() => void refreshPreviousLogins()}
    />
  );

  return (
    <div className="profile-page page-stack">
      {messageContextHolder}
      {modalContextHolder}
      <div className="page-heading profile-heading">
        <div className="profile-heading-title">
          <h1>{t('profile.title')}</h1>
          <p>{t('profile.subtitle')}</p>
        </div>
      </div>

      {!userInfo ? (
        <Alert type="warning" showIcon message={t('profile.unavailable')} />
      ) : (
        <div className="profile-body-stack">
          {/* Full-width Profile Hero Card */}
          <section className="profile-hero console-card">
            <div className="profile-hero-cover" />

            <div className="profile-hero-main">
              <div className="profile-hero-avatar-area">
                <div className="profile-avatar-stage">
                  <UserAvatar
                    size={84}
                    username={userInfo.name}
                    refreshKey={avatarRefreshKey}
                    src={avatarPreview ?? userInfo.image}
                    hasImage={Boolean(avatarPreview || userInfo.image || userInfo.hasImage)}
                  />
                  <Upload
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    beforeUpload={beforeAvatarUpload}
                    maxCount={1}
                    showUploadList={false}
                  >
                    <button
                      type="button"
                      className="profile-avatar-badge-btn"
                      title={t('profile.selectAvatar')}
                      aria-label={t('profile.selectAvatar')}
                    >
                      <CameraOutlined />
                    </button>
                  </Upload>
                </div>
              </div>

              <div className="profile-hero-details">
                <div className="profile-hero-primary-row">
                  <h2 className="profile-hero-name">{userInfo.name ?? userInfo.id}</h2>
                  <Tag
                    className="profile-role-tag"
                    color={isFullAdministrator(userInfo.siteadmin ?? 0) ? 'gold' : 'blue'}
                    icon={
                      isFullAdministrator(userInfo.siteadmin ?? 0) ? (
                        <CrownOutlined />
                      ) : (
                        <UserOutlined />
                      )
                    }
                  >
                    {isFullAdministrator(userInfo.siteadmin ?? 0)
                      ? t('profile.siteAdministrator')
                      : t('profile.standardUser')}
                  </Tag>
                  <Tag
                    color={connected ? 'success' : 'warning'}
                    className="profile-connection-tag"
                  >
                    <span className={`profile-status-dot ${connected ? 'is-connected' : 'is-disconnected'}`} />
                    {connected ? t('profile.connected') : t('profile.disconnected')}
                  </Tag>
                </div>

                <div className="profile-hero-meta-row">
                  <div className="profile-user-id-bar">
                    <span className="profile-user-id-prefix">{t('profile.basic.userId')}:</span>
                    <code>{userInfo.id}</code>
                    <Tooltip title={t('profile.copyId')}>
                      <Button
                        type="text"
                        size="small"
                        icon={<CopyOutlined />}
                        onClick={() => void handleCopyUserId()}
                        aria-label={t('profile.copyId')}
                      />
                    </Tooltip>
                  </div>
                  {userInfo.email && (
                    <div className="profile-hero-email-pill">
                      <MailOutlined />
                      <span>{userInfo.email}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="profile-hero-stats">
                <div className="profile-hero-stat-cell">
                  <span className="profile-hero-stat-label">
                    <CalendarOutlined /> {t('profile.account.createdAt')}
                  </span>
                  <strong className="profile-hero-stat-val">{formatDate(userInfo.creationAt)}</strong>
                </div>
                <div className="profile-hero-stat-cell">
                  <span className="profile-hero-stat-label">
                    <LoginOutlined /> {t('profile.account.lastLogin')}
                  </span>
                  <strong className="profile-hero-stat-val">{formatDate(userInfo.lastLoginAt)}</strong>
                </div>
                <div className="profile-hero-stat-cell">
                  <span className="profile-hero-stat-label">
                    <ThunderboltOutlined /> {t('profile.account.lastAccess')}
                  </span>
                  <strong className="profile-hero-stat-val">{formatDate(userInfo.lastAccessAt)}</strong>
                </div>
              </div>

              <div className="profile-hero-actions">
                <Button
                  type="primary"
                  icon={<KeyOutlined />}
                  disabled={!connected}
                  onClick={() => setPasswordOpen(true)}
                >
                  {t('profile.password.title')}
                </Button>
                <Upload
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  beforeUpload={beforeAvatarUpload}
                  maxCount={1}
                  showUploadList={false}
                >
                  <Button icon={<CameraOutlined />}>{t('profile.selectAvatar')}</Button>
                </Upload>
              </div>
            </div>

            {avatarPreview && (
              <div className="profile-avatar-preview-banner">
                <div className="profile-avatar-preview-text">
                  <CameraOutlined />
                  <span>{t('profile.previewAvatar')}</span>
                </div>
                <div className="profile-avatar-preview-btns">
                  <Button
                    type="primary"
                    size="small"
                    loading={avatarSubmitting}
                    disabled={!connected}
                    onClick={() => void saveAvatar()}
                  >
                    {t('profile.saveAvatar')}
                  </Button>
                  <Button size="small" onClick={handleCancelAvatarPreview}>
                    {t('profile.cancelAvatar')}
                  </Button>
                </div>
              </div>
            )}
          </section>

          {/* Navigation Tabs */}
          <nav className="profile-tabs" role="tablist">
            {PROFILE_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.key}
                className={`profile-tab-btn ${activeTab === tab.key ? 'is-active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.icon}
                <span>{t(tab.labelKey)}</span>
              </button>
            ))}
          </nav>

          {/* Tab Panes */}
          <div className="profile-tab-content">
            {activeTab === 'overview' && (
              <div className="profile-balanced-grid">
                <div className="profile-grid-column">
                  {renderBasicProfile()}
                  {renderSecurityPanel()}
                </div>
                <div className="profile-grid-column">
                  {renderTokensSection()}
                  {renderLoginsSection()}
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="profile-balanced-grid">
                <div className="profile-grid-column">
                  {renderBasicProfile()}
                  {renderAccountDetails()}
                </div>
                <div className="profile-grid-column">
                  {renderSecurityPanel()}
                </div>
              </div>
            )}

            {activeTab === 'tokens' && (
              <div className="profile-single-column">
                {renderTokensSection()}
              </div>
            )}

            {activeTab === 'activity' && (
              <div className="profile-single-column">
                {renderLoginsSection()}
              </div>
            )}
          </div>
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

      <SecurityKeysModal
        form={securityKeyForm}
        open={securityKeysOpen}
        keys={securityKeys}
        loading={securityKeysLoading}
        registering={twoFactorSubmitting === 'webauthn' && removingSecurityKeyIndex == null}
        removingIndex={removingSecurityKeyIndex}
        canAdd={
          twoFactorCapabilities?.methods.webauthn.canConfigure === true &&
          (twoFactorCapabilities.maxFidoKeys == null ||
            securityKeys.length < twoFactorCapabilities.maxFidoKeys)
        }
        maxKeys={twoFactorCapabilities?.maxFidoKeys ?? null}
        onAdd={() => void addSecurityKey().catch(() => undefined)}
        onCancel={() => {
          setSecurityKeysOpen(false);
          securityKeyForm.resetFields();
        }}
        onRemove={confirmRemoveSecurityKey}
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
