import { ApartmentOutlined, TeamOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

export function UserGroupLoadingSkeleton() {
  const { t } = useTranslation();

  return (
    <main
      className="page-stack user-details-page user-group-loading"
      aria-busy="true"
      aria-label={t('userGroups.details.loading')}
    >
      <nav className="user-detail-breadcrumb user-group-loading-breadcrumb" aria-hidden="true">
        <span className="user-group-loading-line is-breadcrumb" />
        <span>›</span>
        <span className="user-group-loading-line is-breadcrumb-current" />
      </nav>

      <section className="user-detail-hero user-group-loading-hero" aria-hidden="true">
        <div className="user-detail-profile">
          <span className="user-group-loading-avatar">
            <TeamOutlined />
          </span>
          <div className="user-group-loading-profile-copy">
            <span className="user-group-loading-line is-title" />
            <span className="user-group-loading-line is-description" />
            <span className="user-group-loading-line is-id" />
            <div className="user-group-loading-actions">
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>

        <div className="user-detail-meta-container">
          <div className="user-detail-meta-grid">
            {Array.from({ length: 6 }, (_, index) => (
              <div className="user-detail-meta-item user-group-loading-meta" key={index}>
                <span className="user-group-loading-line is-meta-label" />
                <span className="user-group-loading-line is-meta-value" />
              </div>
            ))}
          </div>
        </div>

        <div className="user-detail-sessions">
          <div className="user-detail-sessions-card user-group-loading-status">
            <span className="user-group-loading-status-icon">
              <ApartmentOutlined />
            </span>
            <div>
              <span className="user-group-loading-line is-status-label" />
              <span className="user-group-loading-line is-status-value" />
              <span className="user-group-loading-line is-status-note" />
            </div>
          </div>
        </div>
      </section>

      <section className="user-group-loading-content" aria-hidden="true">
        <div className="user-group-loading-tabs">
          <span className="is-active" />
          <span />
          <span />
          <span />
        </div>
        <div className="user-group-loading-body">
          <div className="user-group-loading-heading">
            <span className="user-group-loading-line is-section-title" />
            <span className="user-group-loading-line is-section-action" />
          </div>
          {Array.from({ length: 4 }, (_, index) => (
            <div className="user-group-loading-row" key={index}>
              <span className="user-group-loading-row-icon" />
              <span className="user-group-loading-line is-row-primary" />
              <span className="user-group-loading-line is-row-secondary" />
              <span className="user-group-loading-line is-row-tag" />
            </div>
          ))}
        </div>
      </section>

      <span className="user-group-loading-announcement">{t('userGroups.details.loading')}...</span>
    </main>
  );
}
