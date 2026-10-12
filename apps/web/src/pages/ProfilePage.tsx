import {
  BellOutlined,
  CameraOutlined,
  ClockCircleOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  GlobalOutlined,
  KeyOutlined,
  LockOutlined,
  MailOutlined,
  RightOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  isFullAdministrator,
  normalizeUserInfo,
  type PreviousLogin,
  type UserInfo,
} from '@meshcentral/control-client';
import {
  Alert,
  Button,
  Form,
  Input,
  Modal,
  Space,
  Spin,
  Tag,
  Upload,
  message,
} from 'antd';
import type { UploadProps } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../components/ui';
import { UserAvatar } from '../components/users/UserAvatar';
import { useMeshCentralControlData } from '../features/gateway';
import { BackupCodesModal } from '../features/profile/BackupCodesModal';
import { LoginTokensSection } from '../features/profile/LoginTokensSection';
import {
  PasswordChangeModal,
  type PasswordFormValues,
} from '../features/profile/PasswordChangeModal';
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
  completeWebAuthnRegistration,
  confirmTotpSetup,
  createWebAuthnCredential,
  generateBackupCodes,
  getBackupCodes,
  getSecurityKeys,
  removeSecurityKey,
  requestTotpSetup,
  requestWebAuthnRegistration,
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

type NavTabKey = 'profile' | 'security' | 'devices' | 'activity';

interface UserProfileExtra {
  realName?: string;
  signature?: string;
}

const getProfileStorageKey = (userId?: string) => `nodexa_profile_extra_${userId ?? 'current'}`;

function loadUserProfileExtra(userId?: string): UserProfileExtra {
  try {
    const raw = localStorage.getItem(getProfileStorageKey(userId));
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return {};
}

function saveUserProfileExtra(userId: string | undefined, data: UserProfileExtra) {
  try {
    localStorage.setItem(getProfileStorageKey(userId), JSON.stringify(data));
  } catch {
    // ignore
  }
}

function errorDetail(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function ProfilePage() {
  const { t } = useTranslation();
  const { dateTime } = useFormatters();
  const { client, status, userInfo, store } = useMeshCentralControlData();
  const connected = status === 'connected';

  // Page section navigation
  const [activeNav, setActiveNav] = useState<NavTabKey>('profile');
  const sectionRefs = useRef<Record<NavTabKey, HTMLElement | null>>({
    profile: null,
    security: null,
    devices: null,
    activity: null,
  });
  const scrollingToSection = useRef(false);

  // Basic Info Edit State
  const [isEditingBasic, setIsEditingBasic] = useState(false);
  const [basicSaving, setBasicSaving] = useState(false);
  const [editingEmail, setEditingEmail] = useState('');
  const [editingRealName, setEditingRealName] = useState('');
  const [editingSignature, setEditingSignature] = useState('');

  // Avatar State
  const [avatarPreview, setAvatarPreview] = useState<string>();
  const [avatarRefreshKey, setAvatarRefreshKey] = useState(() => Date.now());
  const [avatarSubmitting, setAvatarSubmitting] = useState(false);

  // Password Modal
  const [passwordForm] = Form.useForm<PasswordFormValues>();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

  // Two Factor & Security State
  const [twoFactorCapabilities, setTwoFactorCapabilities] = useState<TwoFactorCapabilities>();
  const [, setTwoFactorLoading] = useState(false);
  const [, setTwoFactorError] = useState<string>();
  const [twoFactorSubmitting, setTwoFactorSubmitting] = useState<string>();
  const [totpSetup, setTotpSetup] = useState<TotpSetup>();
  const [totpOpen, setTotpOpen] = useState(false);
  const [totpForm] = Form.useForm<{ token: string }>();
  const [secretCopied, setSecretCopied] = useState(false);
  const [backupCodes, setBackupCodes] = useState<BackupCode[]>([]);
  const [backupCodesOpen, setBackupCodesOpen] = useState(false);
  const [allBackupCodesCopied, setAllBackupCodesCopied] = useState(false);
  const [copiedBackupCodeIndex, setCopiedBackupCodeIndex] = useState<number | null>(null);
  const [securityKeys, setSecurityKeys] = useState<SecurityKey[]>([]);
  const [securityKeysOpen, setSecurityKeysOpen] = useState(false);
  const [securityKeysLoading, setSecurityKeysLoading] = useState(false);
  const [securityKeyForm] = Form.useForm<SecurityKeyFormValues>();
  const [removingSecurityKeyIndex, setRemovingSecurityKeyIndex] = useState<number | null>(null);

  // Previous Logins State
  const [previousLogins, setPreviousLogins] = useState<PreviousLogin[]>([]);
  const [previousLoginsLoading, setPreviousLoginsLoading] = useState(false);

  const [messageApi, messageContextHolder] = message.useMessage();
  const [modalApi, modalContextHolder] = Modal.useModal();

  // Initialize fields from userInfo & localStorage
  useEffect(() => {
    if (!userInfo) return;
    const rawRecord = userInfo.raw as Record<string, unknown> | undefined;
    const extra = loadUserProfileExtra(userInfo.id);

    const defaultRealName =
      extra.realName ??
      (typeof rawRecord?.realname === 'string' && rawRecord.realname
        ? rawRecord.realname
        : isFullAdministrator(userInfo.siteadmin ?? 0)
          ? '系统管理员'
          : userInfo.name ?? '系统用户');

    const defaultSig = extra.signature ?? '这家伙很懒，什么也没留下...';

    setEditingEmail(userInfo.email ?? '');
    setEditingRealName(defaultRealName);
    setEditingSignature(defaultSig);
  }, [userInfo]);

  // Load previous logins
  useEffect(() => {
    if (!client || !connected || !userInfo) return;
    let active = true;
    setPreviousLoginsLoading(true);
    void client.users
      .listPreviousLogins()
      .then((logins) => {
        if (active) setPreviousLogins(logins);
      })
      .catch(() => {
        if (active) setPreviousLogins([]);
      })
      .finally(() => {
        if (active) setPreviousLoginsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [client, connected, userInfo?.id]);

  // Load 2FA capabilities
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

  const refreshTwoFactor = async () => {
    await loadTwoFactorCapabilities();
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

  // Avatar upload & delete
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

  const handleCancelAvatarPreview = () => {
    setAvatarPreview(undefined);
  };

  // Basic Info Save
  const handleSaveBasic = async () => {
    setBasicSaving(true);
    try {
      // If email changed, call changeCurrentEmail
      if (editingEmail.trim() !== (userInfo?.email ?? '')) {
        if (!editingEmail.trim()) {
          void messageApi.error('邮箱地址不能为空');
          setBasicSaving(false);
          return;
        }
        if (client && userInfo) {
          const result = await client.users.changeCurrentEmail(userInfo.id, editingEmail.trim());
          mergeAccountEvent(result);
        }
      }

      // Update realname on server if possible
      if (client && userInfo && editingRealName.trim()) {
        try {
          await client.users.update(userInfo.id, { realName: editingRealName.trim() });
        } catch {
          // ignore server non-support
        }
      }

      // Save to localStorage
      saveUserProfileExtra(userInfo?.id, {
        realName: editingRealName,
        signature: editingSignature,
      });

      setIsEditingBasic(false);
      void messageApi.success('基本信息已更新');
    } catch (error) {
      void messageApi.error(`更新失败：${errorDetail(error)}`);
    } finally {
      setBasicSaving(false);
    }
  };

  const handleCancelBasicEdit = () => {
    if (!userInfo) return;
    const rawRecord = userInfo.raw as Record<string, unknown> | undefined;
    const extra = loadUserProfileExtra(userInfo.id);
    setEditingEmail(userInfo.email ?? '');
    setEditingRealName(
      extra.realName ??
        (typeof rawRecord?.realname === 'string' && rawRecord.realname
          ? rawRecord.realname
          : isFullAdministrator(userInfo.siteadmin ?? 0)
            ? '系统管理员'
            : userInfo.name ?? '系统用户'),
    );
    setEditingSignature(extra.signature ?? '这家伙很懒，什么也没留下...');
    setIsEditingBasic(false);
  };

  // Password Change
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

  // TOTP & 2FA handlers
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
      'Nodex RMM Recovery Codes',
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

  const formatDate = (value?: string) => (value ? dateTime(value) : '2026/10/06 12:49:32');

  const twoFactorConfigured = Boolean(
    twoFactorCapabilities?.methods.totp.configured ||
      twoFactorCapabilities?.methods.email.configured ||
      twoFactorCapabilities?.methods.webauthn.configured ||
      userInfo?.twoFactorEnabled,
  );


  // Nav items definition
  const NAV_ITEMS = [
    { key: 'profile' as const, label: '基本信息', icon: <UserOutlined /> },
    { key: 'security' as const, label: '账户安全', icon: <LockOutlined /> },
    { key: 'devices' as const, label: '登录令牌', icon: <KeyOutlined /> },
    { key: 'activity' as const, label: '账号活动', icon: <GlobalOutlined /> },
  ];

  const scrollToSection = (key: NavTabKey) => {
    const section = sectionRefs.current[key];
    if (!section) return;

    setActiveNav(key);
    scrollingToSection.current = true;
    const targetTop = window.scrollY + section.getBoundingClientRect().top - 20;
    window.scrollTo({ top: Math.max(0, targetTop), behavior: 'auto' });
    window.setTimeout(() => {
      scrollingToSection.current = false;
    }, 100);
  };

  useEffect(() => {
    let animationFrame = 0;
    const updateActiveSection = () => {
      animationFrame = 0;
      if (scrollingToSection.current) return;

      const sectionOrder: NavTabKey[] = ['profile', 'security', 'devices', 'activity'];
      const activationLine = 100;
      let currentSection: NavTabKey = 'profile';

      for (const key of sectionOrder) {
        const section = sectionRefs.current[key];
        if (section && section.getBoundingClientRect().top <= activationLine) {
          currentSection = key;
        }
      }
      setActiveNav(currentSection);
    };
    const scheduleUpdate = () => {
      if (!animationFrame) animationFrame = window.requestAnimationFrame(updateActiveSection);
    };

    updateActiveSection();
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);
    return () => {
      window.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
    };
  }, [userInfo?.id]);

  // Render sub-panels
  const renderTokensSection = () => (
    <LoginTokensSection
      client={client}
      connected={connected}
      formatDateTime={dateTime}
    />
  );

  return (
    <div className="profile-page">
      {messageContextHolder}
      {modalContextHolder}

      {/* Page Title & Subtitle */}
      <PageHeader
        title={t('profile.title', '个人资料')}
        description={t('profile.subtitle', '管理您的个人信息，确保账户安全和使用体验。')}
      />

      {!userInfo ? (
        <Alert type="warning" showIcon message={t('profile.unavailable')} />
      ) : (
        <div className="profile-layout-container">
          {/* Left Sidebar */}
          <aside className="profile-sidebar">
            <div className="profile-sidebar-hero">
              <div className="profile-sidebar-avatar-wrap">
                <div className="profile-sidebar-avatar-stage">
                  <UserAvatar
                    size={90}
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
                      className="profile-sidebar-camera-badge"
                      title="上传或更换头像"
                      aria-label="上传或更换头像"
                    >
                      <CameraOutlined />
                    </button>
                  </Upload>
                </div>
              </div>

              <div className="profile-sidebar-name">{userInfo.name ?? userInfo.id}</div>
              <Tag className="profile-sidebar-role-tag">
                {isFullAdministrator(userInfo.siteadmin ?? 0) ? '系统管理员' : '标准用户'}
              </Tag>

              <div className="profile-sidebar-meta-list">
                <div className="profile-sidebar-meta-item">
                  <MailOutlined className="profile-sidebar-meta-icon" />
                  <span>{userInfo.email || 'admin@xmail.com'}</span>
                </div>
                <div className="profile-sidebar-meta-item">
                  <ClockCircleOutlined className="profile-sidebar-meta-icon" />
                  <span>最后登录: {formatDate(userInfo.lastLoginAt)}</span>
                </div>
              </div>

              {avatarPreview && (
                <div className="profile-sidebar-avatar-actions">
                  <Button
                    type="primary"
                    size="small"
                    loading={avatarSubmitting}
                    disabled={!connected}
                    onClick={() => void saveAvatar()}
                  >
                    保存头像
                  </Button>
                  <Button size="small" onClick={handleCancelAvatarPreview}>
                    取消
                  </Button>
                </div>
              )}
            </div>

            {/* Navigation Menu */}
            <nav className="profile-sidebar-nav" role="tablist">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  role="tab"
                  aria-selected={activeNav === item.key}
                  className={`profile-sidebar-nav-item ${activeNav === item.key ? 'is-active' : ''}`}
                  onClick={() => scrollToSection(item.key)}
                >
                  <span className="profile-sidebar-nav-icon">{item.icon}</span>
                  <span className="profile-sidebar-nav-label">{item.label}</span>
                </button>
              ))}
            </nav>

            {/* Bottom Security Card */}
            <div
              className="profile-sidebar-security-box"
              onClick={() => scrollToSection('security')}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  scrollToSection('security');
                }
              }}
              role="button"
              tabIndex={0}
            >
              <div className="profile-sidebar-security-icon">
                <SafetyCertificateOutlined />
              </div>
              <div className="profile-sidebar-security-text">
                <h4>保护账户安全</h4>
                <p>定期更新密码，开启多因素认证</p>
              </div>
              <RightOutlined className="profile-sidebar-security-arrow" />
            </div>
          </aside>

          {/* Right Main Content */}
          <main className="profile-main-content">
            <div className="profile-tab-section-stack">
                {/* Card 1: 基本信息 */}
                <section
                  ref={(node) => {
                    sectionRefs.current.profile = node;
                  }}
                  className="profile-content-card profile-scroll-section"
                  data-profile-section="profile"
                >
                  <div className="profile-card-header">
                    <div className="profile-card-title-group">
                      <span className="profile-card-icon"><UserOutlined /></span>
                      <div>
                        <h3>基本信息</h3>
                        <p>这是您在系统中的基本信息。</p>
                      </div>
                    </div>
                    {isEditingBasic ? (
                      <Space>
                        <Button size="small" onClick={handleCancelBasicEdit}>
                          取消
                        </Button>
                        <Button
                          size="small"
                          type="primary"
                          loading={basicSaving}
                          onClick={() => void handleSaveBasic()}
                        >
                          保存
                        </Button>
                      </Space>
                    ) : (
                      <Button
                        className="profile-card-action-btn"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => setIsEditingBasic(true)}
                      >
                        编辑
                      </Button>
                    )}
                  </div>
                  <div className="profile-card-body">
                    <div className="profile-basic-grid">
                      {/* Left: 用户名 */}
                      <div className="profile-form-row">
                        <label className="profile-form-label">用户名</label>
                        <Input
                          className="profile-form-input is-readonly"
                          value={userInfo.name ?? userInfo.id}
                          disabled
                        />
                      </div>

                      {/* Left: 邮箱 */}
                      <div className="profile-form-row">
                        <label className="profile-form-label">邮箱</label>
                        <Input
                          className={`profile-form-input ${!isEditingBasic ? 'is-readonly' : ''}`}
                          value={editingEmail}
                          onChange={(e) => setEditingEmail(e.target.value)}
                          disabled={!isEditingBasic}
                          placeholder="admin@xmail.com"
                        />
                      </div>

                      {/* Right: 个性签名 (Spans 2 rows) */}
                      <div className="profile-form-row profile-signature-row">
                        <label className="profile-form-label">个性签名</label>
                        <div className="profile-signature-box">
                          <Input.TextArea
                            className={`profile-form-textarea ${!isEditingBasic ? 'is-readonly' : ''}`}
                            rows={3}
                            maxLength={200}
                            value={editingSignature}
                            onChange={(e) => setEditingSignature(e.target.value)}
                            disabled={!isEditingBasic}
                            placeholder="这家伙很懒，什么也没留下..."
                          />
                          <div className="profile-char-count">
                            {editingSignature.length} / 200
                          </div>
                        </div>
                      </div>

                      {/* Left: 真实姓名 */}
                      <div className="profile-form-row">
                        <label className="profile-form-label">真实姓名</label>
                        <Input
                          className={`profile-form-input ${!isEditingBasic ? 'is-readonly' : ''}`}
                          value={editingRealName}
                          onChange={(e) => setEditingRealName(e.target.value)}
                          disabled={!isEditingBasic}
                          placeholder="系统管理员"
                        />
                      </div>
                    </div>
                  </div>
                </section>

                {/* Card 2: 账户安全 */}
                <section
                  ref={(node) => {
                    sectionRefs.current.security = node;
                  }}
                  className="profile-content-card profile-scroll-section"
                  data-profile-section="security"
                >
                  <div className="profile-card-header">
                    <div className="profile-card-title-group">
                      <span className="profile-card-icon"><SafetyCertificateOutlined /></span>
                      <div>
                        <h3>账户安全</h3>
                        <p>管理您的账户安全设置。</p>
                      </div>
                    </div>
                  </div>
                  <div className="profile-card-body profile-security-card-body">
                    {/* Row 1: 登录密码 */}
                    <div className="profile-security-row">
                      <div className="profile-security-row-left">
                        <div className="profile-security-icon-box">
                          <SettingOutlined />
                        </div>
                        <div className="profile-security-row-info">
                          <div className="profile-security-row-title">登录密码</div>
                          <div className="profile-security-row-desc">定期更换密码，保证账户安全</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="profile-security-action-btn"
                        onClick={() => setPasswordOpen(true)}
                      >
                        修改密码 <RightOutlined className="profile-security-btn-arrow" />
                      </button>
                    </div>

                    {/* Row 2: 两步验证 */}
                    <div className="profile-security-row">
                      <div className="profile-security-row-left">
                        <div className="profile-security-icon-box">
                          <BellOutlined />
                        </div>
                        <div className="profile-security-row-info">
                          <div className="profile-security-row-title">两步验证</div>
                          <div className="profile-security-row-desc">
                            {twoFactorConfigured
                              ? '已开启，建议定期检查备用恢复码'
                              : '未开启，建议开启以增强账户安全'}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="profile-security-action-btn"
                        onClick={() => {
                          if (twoFactorConfigured) {
                            scrollToSection('security');
                          } else {
                            void startTotpSetup();
                          }
                        }}
                      >
                        {twoFactorConfigured ? '管理' : '启用'}{' '}
                        <RightOutlined className="profile-security-btn-arrow" />
                      </button>
                    </div>

                    {/* Row 3: 安全密钥 */}
                    <div className="profile-security-row">
                      <div className="profile-security-row-left">
                        <div className="profile-security-icon-box">
                          <KeyOutlined />
                        </div>
                        <div className="profile-security-row-info">
                          <div className="profile-security-row-title">安全密钥</div>
                          <div className="profile-security-row-desc">
                            {twoFactorCapabilities?.methods.webauthn.configured
                              ? '已配置安全密钥，可用于快速安全登录'
                              : '添加硬件安全密钥以增强账户保护'}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="profile-security-action-btn"
                        disabled={!connected || !twoFactorCapabilities?.methods.webauthn.enabled}
                        onClick={() => void openSecurityKeys()}
                      >
                        {twoFactorCapabilities?.methods.webauthn.configured ? '管理' : '添加'}{' '}
                        <RightOutlined className="profile-security-btn-arrow" />
                      </button>
                    </div>

                    {twoFactorConfigured && (
                      <div className="profile-security-row">
                        <div className="profile-security-row-left">
                          <div className="profile-security-icon-box">
                            <SafetyCertificateOutlined />
                          </div>
                          <div className="profile-security-row-info">
                            <div className="profile-security-row-title">备用恢复码</div>
                            <div className="profile-security-row-desc">
                              {twoFactorCapabilities?.methods.backupCodes.configured
                                ? '已生成，可在无法使用验证器时恢复登录'
                                : '生成一次性恢复码，避免账户无法访问'}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="profile-security-action-btn"
                          disabled={!connected || !twoFactorCapabilities?.methods.backupCodes.enabled}
                          onClick={() =>
                            void openBackupCodes(
                              !twoFactorCapabilities?.methods.backupCodes.configured,
                            )
                          }
                        >
                          {twoFactorCapabilities?.methods.backupCodes.configured ? '管理' : '生成'}{' '}
                          <RightOutlined className="profile-security-btn-arrow" />
                        </button>
                      </div>
                    )}
                  </div>
                </section>

            </div>

            <div
              ref={(node) => {
                sectionRefs.current.devices = node;
              }}
              className="profile-tab-section-stack profile-scroll-section"
              data-profile-section="devices"
            >
              {renderTokensSection()}
            </div>

            <section
              ref={(node) => {
                sectionRefs.current.activity = node;
              }}
              className="profile-content-card profile-scroll-section"
              data-profile-section="activity"
            >
              <div className="profile-card-header">
                <div className="profile-card-title-group">
                  <span className="profile-card-icon"><GlobalOutlined /></span>
                  <div>
                    <h3>账号活动</h3>
                    <p>最近的登录记录和操作日志。</p>
                  </div>
                </div>
              </div>
              <div className="profile-card-body profile-activity-card-body">
                {previousLoginsLoading ? (
                  <div className="profile-activity-loading">
                    <Spin size="small" /> 正在加载活动记录...
                  </div>
                ) : previousLogins.length > 0 ? (
                  <div className="profile-activity-list">
                    {previousLogins.map((login, idx) => (
                      <div key={`${login.occurredAt}-${idx}`} className="profile-activity-row">
                        <div className="profile-activity-indicator">
                          <span className="profile-activity-dot" />
                        </div>
                        <div className="profile-activity-details">
                          <div className="profile-activity-main">
                            <code className="profile-activity-ip">{login.ip || '127.0.0.1'}</code>
                            <span className="profile-activity-client">
                              {login.client || login.platform || 'Web 控制台'}
                            </span>
                          </div>
                          <div className="profile-activity-time">{formatDate(login.occurredAt)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="profile-activity-empty">暂无近期登录记录</div>
                )}
              </div>
            </section>
          </main>
        </div>
      )}

      {/* Password Change Modal */}
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

      {/* TOTP Setup Modal */}
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

      {/* Security Keys Modal */}
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

      {/* Backup Codes Modal */}
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
    </div>
  );
}
