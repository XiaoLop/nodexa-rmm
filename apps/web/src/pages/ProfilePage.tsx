import {
  CameraOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  KeyOutlined,
  LockOutlined,
  MailOutlined,
  LaptopOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { isFullAdministrator, normalizeUserInfo, type UserInfo } from '@meshcentral/control-client';
import { Alert, Button, Form, Input, Modal, Tag, Upload, message } from 'antd';
import type { UploadProps } from 'antd';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UserAvatar } from '../components/users/UserAvatar';
import { useGatewayData } from '../features/gateway/useGatewayData';
import { useFormatters } from '../i18n/formatters';
import '../assets/styles/profile.css';

const MAX_AVATAR_SIZE = 2 * 1024 * 1024;

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
  const [messageApi, messageContextHolder] = message.useMessage();
  const connected = status === 'connected';

  useEffect(() => {
    emailForm.setFieldValue('email', userInfo?.email ?? '');
  }, [emailForm, userInfo?.email]);

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
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
      void messageApi.error(t('profile.messages.invalidImageType'));
      return Upload.LIST_IGNORE;
    }
    if (file.size > MAX_AVATAR_SIZE) {
      void messageApi.error(t('profile.messages.avatarTooLarge'));
      return Upload.LIST_IGNORE;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setAvatarPreview(reader.result);
    };
    reader.onerror = () => void messageApi.error(t('profile.messages.imageReadFailed'));
    reader.readAsDataURL(file);
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
      void messageApi.error(t('profile.messages.avatarUpdateFailed', { detail: errorDetail(error) }));
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
      void messageApi.error(t('profile.messages.emailUpdateFailed', { detail: errorDetail(error) }));
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
      void messageApi.error(t('profile.messages.passwordUpdateFailed', { detail: errorDetail(error) }));
    } finally {
      setPasswordSubmitting(false);
    }
  };

  const formatDate = (value?: string) => value ? dateTime(value) : t('profile.notAvailable');

  return (
    <div className="profile-page page-stack">
      {messageContextHolder}
      <div className="page-heading profile-heading">
        <div>
          <h1>{t('profile.title')}</h1>
          <p>{t('profile.subtitle')}</p>
        </div>
        <Tag color={connected ? 'success' : 'warning'}>
          {connected ? t('profile.connected') : t('profile.disconnected')}
        </Tag>
      </div>

      {!userInfo ? <Alert type="warning" showIcon message={t('profile.unavailable')} /> : (
        <div className="profile-layout">
          <aside className="profile-identity console-card">
            <div className="profile-avatar-stage">
              <UserAvatar
                size={112}
                username={userInfo.name}
                refreshKey={avatarRefreshKey}
                src={avatarPreview ?? userInfo.image}
              />
              <span className="profile-avatar-badge"><CameraOutlined /></span>
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
              <header><span><UserOutlined /></span><div><h2>{t('profile.basic.title')}</h2><p>{t('profile.basic.description')}</p></div></header>
              <div className="profile-readonly-row">
                <div><label>{t('profile.basic.username')}</label><strong>{userInfo.name ?? t('profile.notAvailable')}</strong></div>
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
              <header><span><ClockCircleOutlined /></span><div><h2>{t('profile.account.title')}</h2><p>{t('profile.account.description')}</p></div></header>
              <dl className="profile-info-grid">
                <div><dt>{t('profile.account.createdAt')}</dt><dd>{formatDate(userInfo.creationAt)}</dd></div>
                <div><dt>{t('profile.account.lastLogin')}</dt><dd>{formatDate(userInfo.lastLoginAt)}</dd></div>
                <div><dt>{t('profile.account.previousLogin')}</dt><dd>{formatDate(userInfo.previousLoginAt)}</dd></div>
                <div><dt>{t('profile.account.lastAccess')}</dt><dd>{formatDate(userInfo.lastAccessAt)}</dd></div>
              </dl>
            </section>
          </main>

          <aside className="profile-security console-card">
            <header><span><SafetyCertificateOutlined /></span><div><h2>{t('profile.security.title')}</h2><p>{t('profile.security.description')}</p></div></header>
            <div className="profile-security-item">
              <span className="profile-security-icon"><KeyOutlined /></span>
              <div><strong>{t('profile.security.password')}</strong><small>{formatDate(userInfo.passwordChangedAt)}</small></div>
              <Button size="small" disabled={!connected} onClick={() => setPasswordOpen(true)}>{t('profile.security.change')}</Button>
            </div>
            <div className="profile-security-item">
              <span className="profile-security-icon"><CheckCircleFilled /></span>
              <div><strong>{t('profile.security.emailVerification')}</strong><small>{userInfo.emailVerified ? t('profile.security.verified') : t('profile.security.unverified')}</small></div>
              <Tag color={userInfo.emailVerified ? 'success' : 'warning'}>{userInfo.emailVerified ? t('profile.security.enabled') : t('profile.security.pending')}</Tag>
            </div>
            <div className="profile-security-item is-static">
              <span className="profile-security-icon"><LockOutlined /></span>
              <div><strong>{t('profile.security.twoFactor')}</strong><small>{userInfo.twoFactorEnabled ? t('profile.security.configured') : t('profile.security.notConfigured')}</small></div>
              <Tag>{t('profile.security.displayOnly')}</Tag>
            </div>
            <div className="profile-security-item is-static">
              <span className="profile-security-icon"><LaptopOutlined /></span>
              <div><strong>{t('profile.security.sessions')}</strong><small>{t('profile.security.sessionsDescription')}</small></div>
              <Tag>{t('profile.security.displayOnly')}</Tag>
            </div>
            <Alert type="info" showIcon message={t('profile.security.staticNotice')} />
          </aside>
        </div>
      )}

      <Modal
        title={t('profile.password.title')}
        open={passwordOpen}
        okText={t('profile.password.submit')}
        cancelText={t('common.actions.cancel')}
        confirmLoading={passwordSubmitting}
        onCancel={() => { setPasswordOpen(false); passwordForm.resetFields(); }}
        onOk={() => void savePassword().catch(() => undefined)}
        destroyOnHidden
      >
        <Alert type="warning" showIcon message={t('profile.password.notice')} />
        <Form form={passwordForm} layout="vertical" className="profile-password-form">
          <Form.Item name="currentPassword" label={t('profile.password.current')} rules={[{ required: true, message: t('profile.validation.currentPasswordRequired') }]}>
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Form.Item name="newPassword" label={t('profile.password.new')} rules={[{ required: true, message: t('profile.validation.newPasswordRequired') }]}>
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