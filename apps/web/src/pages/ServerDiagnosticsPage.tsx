import { useTranslation } from 'react-i18next';
import { PageHeader, Panel, StatusBadge } from '../components/ui';
import { ServerDiagnosticsPanel } from '../components/server-admin/ServerDiagnosticsPanel';
import { ServerOpsSummary } from '../components/server-admin/ServerOpsSummary';
import { useServerConnection } from '../features/server-admin/hooks';
import '../assets/styles/server-diagnostics.css';

export function ServerDiagnosticsPage() {
  const { t } = useTranslation();
  const { connected } = useServerConnection();

  return (
    <div className="page-stack server-diagnostics-container">
      <PageHeader
        title={t('serverAdmin.diagnostics')}
        description={t('serverAdmin.pageDescription')}
        status={
          <StatusBadge tone={connected ? 'success' : 'warning'}>
            {t(connected ? 'common.status.connected' : 'common.status.disconnected')}
          </StatusBadge>
        }
      />
      <ServerOpsSummary />
      <Panel className="server-ops-panel">
        <ServerDiagnosticsPanel />
      </Panel>
    </div>
  );
}

