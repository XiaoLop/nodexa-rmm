import { KeyOutlined, LockOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { Button, Spin } from 'antd';
import { useTranslation } from 'react-i18next';
import type { TwoFactorCapabilities } from './twoFactorCapabilities';

const MANAGED_TWO_FACTOR_METHODS = ['totp', 'email', 'backupCodes'] as const;

interface SecuritySettingsPanelProps {
  connected: boolean;
  passwordChangedAt: string;
  capabilities?: TwoFactorCapabilities;
  loading: boolean;
  error?: string;
  submitting?: string;
  onChangePassword: () => void;
  onDisableTotp: () => void;
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
  onOpenBackupCodes,
  onRetry,
  onStartTotp,
  onToggleEmail,
}: SecuritySettingsPanelProps) {
  const { t } = useTranslation();

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
      <div className="profile-security-item">
        <span className="profile-security-icon">
          <KeyOutlined />
        </span>
        <div>
          <strong>{t('profile.security.password')}</strong>
          <small>{passwordChangedAt}</small>
        </div>
        <Button size="small" disabled={!connected} onClick={onChangePassword}>
          {t('profile.security.change')}
        </Button>
      </div>
      {error ? (
        <div className="profile-security-item">
          <span className="profile-security-icon">
            <LockOutlined />
          </span>
          <div>
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
          <div>
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
        return (
          <div className="profile-security-item" key={methodName}>
            <span className="profile-security-icon">
              <LockOutlined />
            </span>
            <div>
              <strong>{t(`profile.security.twoFactorMethods.${methodName}`)}</strong>
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