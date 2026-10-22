import {
  ApiOutlined,
  DashboardOutlined,
  HddOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { Progress, Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import { useServerStats } from '../../features/server-admin/hooks';
import { calcMemoryUsage, formatBytes } from '../../features/server-admin/model';
import { StatusBadge } from '../ui/StatusBadge';

export function ServerOpsSummary() {
  const { t } = useTranslation();
  const { connected, stats } = useServerStats();

  const cpuLoads = stats?.cpuAverage?.slice(0, 3);
  const memory = calcMemoryUsage(
    stats?.totalMemory,
    stats?.freeMemory,
    stats?.availableMemory,
  );

  const agentSessions = stats?.serverState?.agentSessions;
  const userSessions = stats?.serverState?.userSessions ?? stats?.serverState?.connectedUsers;

  return (
    <div className="server-ops-summary" aria-label={t('serverAdmin.diagnostics')}>
      <div className="server-ops-metric-card">
        <div className="server-ops-metric-header">
          <span className="server-ops-metric-title">
            <ApiOutlined /> {t('serverAdmin.channel')}
          </span>
          <StatusBadge tone={connected ? 'success' : 'warning'}>
            {t(connected ? 'common.status.connected' : 'common.status.disconnected')}
          </StatusBadge>
        </div>
        <div className="server-ops-metric-body">
          <strong className="server-ops-metric-value">
            {connected ? 'WebSocket RPC' : '—'}
          </strong>
          <span className="server-ops-metric-hint">
            {t(connected ? 'serverAdmin.live' : 'serverAdmin.disconnected')}
          </span>
        </div>
      </div>

      <div className="server-ops-metric-card">
        <div className="server-ops-metric-header">
          <span className="server-ops-metric-title">
            <DashboardOutlined /> {t('serverAdmin.cpuLoad')}
          </span>
          <span className="server-ops-metric-sub">1m / 5m / 15m</span>
        </div>
        <div className="server-ops-metric-body">
          <div className="server-ops-cpu-pills">
            {cpuLoads && cpuLoads.length > 0 ? (
              cpuLoads.map((load, index) => {
                const interval = [1, 5, 15][index] ?? 1;
                const isHigh = load >= 2.0;
                return (
                  <Tooltip key={interval} title={`Load average (${interval}m): ${load.toFixed(2)}`}>
                    <span className={`server-ops-cpu-pill ${isHigh ? 'is-high' : ''}`}>
                      {load.toFixed(2)}
                    </span>
                  </Tooltip>
                );
              })
            ) : (
              <span className="server-ops-metric-placeholder">—</span>
            )}
          </div>
          <span className="server-ops-metric-hint">
            {cpuLoads && cpuLoads.length > 0 ? 'Load averages' : '—'}
          </span>
        </div>
      </div>

      <div className="server-ops-metric-card">
        <div className="server-ops-metric-header">
          <span className="server-ops-metric-title">
            <HddOutlined /> {t('serverAdmin.memoryUsage')}
          </span>
          {memory.percent !== undefined && (
            <span
              className={`server-ops-percent-tag ${
                memory.percent >= 85 ? 'is-high' : memory.percent >= 70 ? 'is-warning' : ''
              }`}
            >
              {memory.percent}%
            </span>
          )}
        </div>
        <div className="server-ops-metric-body">
          <strong className="server-ops-metric-value">
            {memory.used !== undefined && memory.total !== undefined
              ? `${formatBytes(memory.used)} / ${formatBytes(memory.total)}`
              : '—'}
          </strong>
          <Progress
            percent={memory.percent ?? 0}
            showInfo={false}
            strokeColor={
              (memory.percent ?? 0) >= 85
                ? 'var(--color-danger)'
                : (memory.percent ?? 0) >= 70
                  ? 'var(--color-warning)'
                  : 'var(--color-brand)'
            }
            className="server-ops-progress"
          />
        </div>
      </div>

      <div className="server-ops-metric-card">
        <div className="server-ops-metric-header">
          <span className="server-ops-metric-title">
            <TeamOutlined /> {t('serverAdmin.activeSessions')}
          </span>
        </div>
        <div className="server-ops-metric-body">
          <div className="server-ops-sessions-row">
            <div className="server-ops-session-col">
              <span className="server-ops-session-label">{t('serverAdmin.agentCount')}</span>
              <strong className="server-ops-session-value">
                {agentSessions !== undefined ? agentSessions : '—'}
              </strong>
            </div>
            <div className="server-ops-session-divider" />
            <div className="server-ops-session-col">
              <span className="server-ops-session-label">{t('serverAdmin.userCount')}</span>
              <strong className="server-ops-session-value">
                {userSessions !== undefined ? userSessions : '—'}
              </strong>
            </div>
          </div>
          <span className="server-ops-metric-hint">
            {connected ? t('dashboard.welcome.operational') : '—'}
          </span>
        </div>
      </div>
    </div>
  );
}
