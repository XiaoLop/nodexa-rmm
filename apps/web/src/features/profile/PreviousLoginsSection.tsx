import {
  CopyOutlined,
  DesktopOutlined,
  GlobalOutlined,
  LaptopOutlined,
  MobileOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import type { PreviousLogin } from '@meshcentral/control-client';
import { Alert, Button, Empty, Spin, Tooltip, message } from 'antd';
import { useTranslation } from 'react-i18next';

interface PreviousLoginsSectionProps {
  connected: boolean;
  error?: string;
  loading: boolean;
  logins: PreviousLogin[];
  formatDateTime: (value: string) => string;
  onRefresh: () => void;
}

function getClientIcon(platform?: string, client?: string) {
  const text = `${platform ?? ''} ${client ?? ''}`.toLowerCase();
  if (text.includes('mobile') || text.includes('android') || text.includes('ios') || text.includes('iphone')) {
    return <MobileOutlined />;
  }
  if (text.includes('win') || text.includes('mac') || text.includes('linux')) {
    return <LaptopOutlined />;
  }
  return <DesktopOutlined />;
}

export function PreviousLoginsSection({
  connected,
  error,
  loading,
  logins,
  formatDateTime,
  onRefresh,
}: PreviousLoginsSectionProps) {
  const { t } = useTranslation();
  const [messageApi, messageContextHolder] = message.useMessage();

  const handleCopyIp = async (ip?: string) => {
    if (!ip) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(ip);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = ip;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      void messageApi.success(t('profile.ipCopied'));
    } catch {
      void messageApi.error('Copy failed');
    }
  };

  return (
    <section className="console-card profile-section profile-login-section">
      {messageContextHolder}
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
          icon={<SyncOutlined spin={loading} />}
          disabled={!connected || loading}
          onClick={onRefresh}
        >
          {t('profile.logins.refresh')}
        </Button>
      </header>
      {error ? (
        <Alert
          type="error"
          showIcon
          message={t('profile.logins.loadFailed')}
          description={error}
          action={
            <Button size="small" onClick={onRefresh}>
              {t('profile.logins.retry')}
            </Button>
          }
        />
      ) : loading && !logins.length ? (
        <div className="profile-login-loading">
          <Spin size="small" /> {t('profile.logins.loading')}
        </div>
      ) : logins.length ? (
        <div className="profile-login-list">
          {logins.slice(0, 10).map((login, index) => (
            <article className="profile-login-row" key={`${login.occurredAt}-${index}`}>
              <div className="profile-login-indicator">
                <span className="profile-login-marker" />
                <span className="profile-login-device-icon">
                  {getClientIcon(login.platform, login.client)}
                </span>
              </div>
              <div className="profile-login-time">
                <strong>{formatDateTime(login.occurredAt)}</strong>
                <small>
                  {t('profile.logins.messageCode', { code: login.messageId ?? '—' })}
                </small>
              </div>
              <div className="profile-login-client">
                <strong>{login.client ?? t('profile.notAvailable')}</strong>
                <small>{login.platform ?? t('profile.notAvailable')}</small>
              </div>
              <div className="profile-login-ip-wrap">
                <code>{login.ip ?? '—'}</code>
                {login.ip && (
                  <Tooltip title={t('profile.copyIp')}>
                    <button
                      type="button"
                      className="profile-login-copy-btn"
                      onClick={() => void handleCopyIp(login.ip)}
                      aria-label={t('profile.copyIp')}
                    >
                      <CopyOutlined />
                    </button>
                  </Tooltip>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('profile.logins.empty')} />
      )}
    </section>
  );
}