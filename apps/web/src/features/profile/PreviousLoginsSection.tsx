import { GlobalOutlined, SyncOutlined } from '@ant-design/icons';
import type { PreviousLogin } from '@meshcentral/control-client';
import { Alert, Button, Empty, Spin } from 'antd';
import { useTranslation } from 'react-i18next';

interface PreviousLoginsSectionProps {
  connected: boolean;
  error?: string;
  loading: boolean;
  logins: PreviousLogin[];
  formatDateTime: (value: string) => string;
  onRefresh: () => void;
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

  return (
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
              <span className="profile-login-marker" />
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
              <code>{login.ip ?? '—'}</code>
            </article>
          ))}
        </div>
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('profile.logins.empty')} />
      )}
    </section>
  );
}