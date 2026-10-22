import {
  CodeOutlined,
  ExclamationCircleOutlined,
  FieldTimeOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { ServerConsole } from './ServerConsole';
import { TracePanel } from './TracePanel';
import { ErrorLogPanel } from './ErrorLogPanel';

export type ServerAdminTab = 'console' | 'trace' | 'logs';

export function ServerDiagnosticsPanel() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const activeTab: ServerAdminTab =
    rawTab === 'trace' || rawTab === 'logs' ? rawTab : 'console';

  const handleTabChange = (key: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (key === 'console') {
          next.delete('tab');
        } else {
          next.set('tab', key);
        }
        return next;
      },
      { replace: true }
    );
  };

  return (
    <>
      <nav className="workspace-tabs server-ops-workspace-tabs" aria-label={t('serverAdmin.diagnostics')}>
        <button
          type="button"
          className={activeTab === 'console' ? 'is-active' : ''}
          aria-current={activeTab === 'console' ? 'page' : undefined}
          onClick={() => handleTabChange('console')}
        >
          <CodeOutlined aria-hidden="true" />
          <span>{t('serverAdmin.console')}</span>
        </button>
        <button
          type="button"
          className={activeTab === 'trace' ? 'is-active' : ''}
          aria-current={activeTab === 'trace' ? 'page' : undefined}
          onClick={() => handleTabChange('trace')}
        >
          <FieldTimeOutlined aria-hidden="true" />
          <span>{t('serverAdmin.trace')}</span>
        </button>
        <button
          type="button"
          className={activeTab === 'logs' ? 'is-active' : ''}
          aria-current={activeTab === 'logs' ? 'page' : undefined}
          onClick={() => handleTabChange('logs')}
        >
          <ExclamationCircleOutlined aria-hidden="true" />
          <span>{t('serverAdmin.logs')}</span>
        </button>
      </nav>

      <div className="server-ops-tab-content">
        <div className="server-ops-tab-pane" hidden={activeTab !== 'console'}>
          <ServerConsole active={activeTab === 'console'} />
        </div>
        <div className="server-ops-tab-pane" hidden={activeTab !== 'trace'}>
          <TracePanel />
        </div>
        <div className="server-ops-tab-pane" hidden={activeTab !== 'logs'}>
          <ErrorLogPanel />
        </div>
      </div>
    </>
  );
}

