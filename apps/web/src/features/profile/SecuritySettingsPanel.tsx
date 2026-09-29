import {
  CheckCircleFilled,
  FileProtectOutlined,
  KeyOutlined,
  LockOutlined,
  MailOutlined,
  QrcodeOutlined,
  SafetyCertificateFilled,
  SafetyCertificateOutlined,
  UsbOutlined,
} from '@ant-design/icons';
import { Button, Spin, Tag } from 'antd';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { TwoFactorCapabilities } from './twoFactorCapabilities';

const MANAGED_TWO_FACTOR_METHODS = ['totp', 'webauthn', 'email', 'backupCodes'] as const;

const METHOD_ICONS: Record<typeof MANAGED_TWO_FACTOR_METHODS[number], ReactNode> = {
  totp: <QrcodeOutlined />,
  webauthn: <UsbOutlined />,
  email: <MailOutlined />,
  backupCodes: <FileProtectOutlined />,
};

interface SecuritySettingsPanelProps {
  connected: boolean;
  passwordChangedAt: string;
  capabilities?: TwoFactorCapabilities;
  loading: boolean;
  error?: string;
  submitting?: string;
  onChangePassword: () => void;
  onDisableTotp: () => void;
  onManageWebAuthn: () => void;
  onOpenBackupCodes: (generate: boolean) => void;
  onRetry: () => void;
  onStartTotp: () => void;
  onToggleEmail: (enabled: boolean) => void;
}

export function SecuritySettingsPanel({
  connected,
  passwordChangedAt,
  capabilities,
  loading,
  error,
  submitting,
  onChangePassword,
  onDisableTotp,
  onManageWebAuthn,
  onOpenBackupCodes,
  onRetry,
  onStartTotp,
  onToggleEmail,
}: SecuritySettingsPanelProps) {
  const { t } = useTranslation();

  const any2faEnabled = Boolean(
    capabilities &&
      (capabilities.methods.totp.configured ||
        capabilities.methods.webauthn.configured ||
        capabilities.methods.email.configured ||
        capabilities.methods.backupCodes.configured),
  );

  return (
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

      {/* Security Status Banner */}
      <div className={`profile-security-banner ${any2faEnabled ? 'is-protected' : 'is-warning'}`}>
        <div className="profile-security-banner-icon">
          {any2faEnabled ? <SafetyCertificateFilled /> : <LockOutlined />}
        </div>
        <div className="profile-security-banner-text">
          <h4>
            {any2faEnabled
              ? t('profile.security.securityStatusActive')
              : t('profile.security.securityStatusRecommended')}
          </h4>
          <p>
            {any2faEnabled
              ? t('profile.security.securityStatusActiveDesc')
              : t('profile.security.securityStatusRecommendedDesc')}
          </p>
        </div>
      </div>

      {/* Password Item */}
      <div className="profile-security-item">
        <span className="profile-security-icon is-password">
          <KeyOutlined />
        </span>
        <div className="profile-security-info">
          <div className="profile-security-title-row">
            <strong>{t('profile.security.password')}</strong>
            <Tag color="cyan" className="profile-method-tag">
              <CheckCircleFilled /> {t('profile.statusActive')}
            </Tag>
          </div>
          <small>{passwordChangedAt}</small>
        </div>
        <Button size="small" disabled={!connected} onClick={onChangePassword}>
          {t('profile.security.change')}
        </Button>
      </div>

      {error ? (
        <div className="profile-security-item is-error">
          <span className="profile-security-icon">
            <LockOutlined />
          </span>
          <div className="profile-security-info">
            <strong>{t('profile.security.twoFactor')}</strong>
            <small>{error}</small>
          </div>
          <Button size="small" disabled={!connected || loading} onClick={onRetry}>
            {t('profile.security.retry')}
          </Button>
        </div>
      ) : loading && !capabilities ? (
        <div className="profile-security-item is-static">
          <span className="profile-security-icon">
            <LockOutlined />
          </span>
          <div className="profile-security-info">
            <strong>{t('profile.security.twoFactor')}</strong>
            <small>{t('profile.security.twoFactorLoading')}</small>
          </div>
          <Spin size="small" />
        </div>
      ) : null}

      {MANAGED_TWO_FACTOR_METHODS.filter(
        (methodName) => capabilities?.methods[methodName].enabled === true,
      ).map((methodName) => {
        const method = capabilities?.methods[methodName];
        const isConfigured = Boolean(method?.configured);
        const icon = METHOD_ICONS[methodName] ?? <LockOutlined />;

        return (
          <div
            className={`profile-security-item ${isConfigured ? 'is-configured' : ''}`}
            key={methodName}
          >
            <span className={`profile-security-icon is-${methodName}`}>
              {icon}
            </span>
            <div className="profile-security-info">
              <div className="profile-security-title-row">
                <strong>{t(`profile.security.twoFactorMethods.${methodName}`)}</strong>
                <Tag
                  color={isConfigured ? 'success' : 'default'}
                  className="profile-method-tag"
                >
                  {isConfigured ? (
                    <>
                      <CheckCircleFilled /> {t('profile.security.methodStatusEnabled')}
                    </>
                  ) : (
                    t('profile.security.methodStatusDisabled')
                  )}
                </Tag>
              </div>
              <small>
                {methodName === 'backupCodes' && !capabilities?.methods.totp.configured
                  ? t('profile.security.management.backupCodesRequiresTotp')
                  : method?.configured
                    ? t('profile.security.management.configured')
                    : capabilities?.forced
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
                loading={submitting === methodName}
                disabled={!method?.enabled || !method.canConfigure}
                onClick={method?.configured ? onDisableTotp : onStartTotp}
              >
                {t(
                  method?.configured
                    ? 'profile.security.management.disable'
                    : 'profile.security.management.enable',
                )}
              </Button>
            ) : methodName === 'webauthn' ? (
              <Button
                size="small"
                loading={submitting === methodName}
                disabled={!method?.enabled || !method.canConfigure}
                onClick={onManageWebAuthn}
              >
                {t(
                  method?.configured
                    ? 'profile.security.management.manage'
                    : 'profile.security.management.enable',
                )}
              </Button>
            ) : methodName === 'email' ? (
              <Button
                size="small"
                danger={method?.configured}
                loading={submitting === methodName}
                disabled={!method?.enabled || !method.canConfigure}
                onClick={() => onToggleEmail(!method?.configured)}
              >
                {t(
                  method?.configured
                    ? 'profile.security.management.disable'
                    : 'profile.security.management.enable',
                )}
              </Button>
            ) : (
              <Button
                size="small"
                loading={submitting === methodName}
                disabled={
                  !method?.enabled ||
                  !method.canConfigure ||
                  !capabilities?.methods.totp.configured
                }
                onClick={() => onOpenBackupCodes(!method?.configured)}
              >
                {t(
                  method?.configured
                    ? 'profile.security.management.manage'
                    : 'profile.security.management.enable',
                )}
              </Button>
            )}
          </div>
        );
      })}
    </aside>
  );
}