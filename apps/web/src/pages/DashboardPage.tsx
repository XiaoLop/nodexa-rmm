import {
  AndroidOutlined,
  AppleOutlined,
  ArrowRightOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  DesktopOutlined,
  ExclamationCircleFilled,
  GlobalOutlined,
  HistoryOutlined,
  LinuxOutlined,
  RightOutlined,
  RobotOutlined,
  SyncOutlined,
  UserOutlined,
  WarningFilled,
  WindowsOutlined,
} from '@ant-design/icons';
import type { GatewayEvent, ServerStats } from '@meshcentral/control-client';
import { formatEventMessage, getEventTargetName } from '@meshcentral/shared-state';
import { Alert, Button, Empty, Progress, Spin, Tag, Tooltip } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { MetricCard, iconForMetric } from '../components/ConsoleUi';
import { useGatewayData } from '../features/gateway/useGatewayData';
import { useApplicationUiCapabilities } from '../features/permissions/useUiCapabilities';
import { useFormatters } from '../i18n';
import '../assets/styles/dashboard.css';
import '../assets/styles/dashboard-widgets.css';

function formatMemory(bytes?: number) {
  if (bytes === undefined || !Number.isFinite(bytes) || bytes < 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

function getOperatingSystem(platform?: string) {
  const value = platform?.trim().toLowerCase() ?? '';
  if (!value) return 'other';
  if (value.includes('windows')) return 'Windows';
  if (value.includes('android')) return 'Android';
  if (value.includes('ios') || value.includes('ipados')) return 'iOS';
  if (value.includes('mac') || value.includes('darwin') || value.includes('apple')) return 'macOS';
  if (
    [
      'linux',
      'ubuntu',
      'debian',
      'centos',
      'fedora',
      'red hat',
      'rhel',
      'rocky',
      'alma',
      'arch',
      'suse',
      'alpine',
      'raspbian',
    ].some((name) => value.includes(name))
  ) {
    return 'Linux';
  }
  if (value.includes('freebsd')) return 'FreeBSD';
  if (value.includes('openbsd')) return 'OpenBSD';
  if (value.includes('netbsd')) return 'NetBSD';
  return 'other';
}

function getPlatformMeta(osKey: string) {
  switch (osKey) {
    case 'Windows':
      return { icon: <WindowsOutlined className="platform-icon" style={{ color: '#0078d4' }} />, color: '#0078d4' };
    case 'macOS':
    case 'iOS':
      return { icon: <AppleOutlined className="platform-icon" style={{ color: '#9bb0c4' }} />, color: '#9bb0c4' };
    case 'Linux':
    case 'FreeBSD':
    case 'OpenBSD':
    case 'NetBSD':
      return { icon: <LinuxOutlined className="platform-icon" style={{ color: '#f39c12' }} />, color: '#f39c12' };
    case 'Android':
      return { icon: <AndroidOutlined className="platform-icon" style={{ color: '#3ddc84' }} />, color: '#3ddc84' };
    default:
      return { icon: <DesktopOutlined className="platform-icon" style={{ color: '#6d7f95' }} />, color: '#6d7f95' };
  }
}

export function DashboardPage() {
  const { t } = useTranslation();
  const formatters = useFormatters();
  const navigate = useNavigate();
  const data = useGatewayData();
  const applicationCapabilities = useApplicationUiCapabilities();
  const [historyEvents, setHistoryEvents] = useState<GatewayEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string>();
  const [serverStats, setServerStats] = useState<ServerStats>();

  const online = data.devices.filter((device) => device.online).length;
  const offline = data.devices.length - online;
  const onlineRate = data.devices.length ? Math.round((online / data.devices.length) * 100) : 0;
  const offlineRate = data.devices.length ? Math.round((offline / data.devices.length) * 100) : 0;

  const dashboardEvents = useMemo(() => {
    const eventsById = new Map(historyEvents.map((event) => [event.id, event]));
    for (const event of data.events) eventsById.set(event.id, event);
    return [...eventsById.values()]
      .sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt))
      .slice(0, 30);
  }, [data.events, historyEvents]);

  const waitingForRealtimeEvents =
    dashboardEvents.length === 0 &&
    (eventsLoading || data.status === 'connecting' || data.status === 'reconnecting');
  const recentEvents = dashboardEvents.filter(
    (event) => Date.now() - new Date(event.occurredAt).getTime() <= 86_400_000,
  );

  const platformData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const device of data.devices) {
      const osKey = getOperatingSystem(device.platform);
      counts.set(osKey, (counts.get(osKey) ?? 0) + 1);
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const visible = sorted.slice(0, 4);
    const remaining = sorted.slice(4).reduce((sum, [, value]) => sum + value, 0);
    if (remaining) visible.push(['other', remaining]);
    return visible.map(([osKey, value]) => {
      const meta = getPlatformMeta(osKey);
      return {
        key: osKey,
        label: osKey === 'other' ? t('dashboard.platforms.other') : osKey,
        value,
        icon: meta.icon,
        color: meta.color,
      };
    });
  }, [data.devices, t]);

  const allGroups = useMemo(() => {
    const groupById = new Set(data.groups.map((group) => group.id));
    const result: Array<{
      id: string;
      name: string;
      count: number;
      online: number;
      isUngrouped?: boolean;
    }> = data.groups.map((group) => {
      const devices = data.devices.filter((device) => device.groupId === group.id);
      return {
        id: group.id,
        name: group.name,
        count: devices.length,
        online: devices.filter((device) => device.online).length,
      };
    });

    const ungroupedDevices = data.devices.filter(
      (device) => !device.groupId || !groupById.has(device.groupId),
    );
    if (ungroupedDevices.length > 0) {
      result.push({
        id: '__ungrouped__',
        name: t('common.status.ungrouped'),
        count: ungroupedDevices.length,
        online: ungroupedDevices.filter((device) => device.online).length,
        isUngrouped: true,
      });
    }

    return result;
  }, [data.devices, data.groups, t]);

  const groups = useMemo(
    () =>
      [...allGroups]
        .sort((a, b) => {
          if (a.count > 0 && b.count === 0) return -1;
          if (a.count === 0 && b.count > 0) return 1;
          if (b.count !== a.count) return b.count - a.count;
          const rateA = a.count ? a.online / a.count : 1;
          const rateB = b.count ? b.online / b.count : 1;
          return rateA - rateB;
        })
        .slice(0, 6),
    [allGroups],
  );

  const offlineDevices = useMemo(
    () =>
      data.devices
        .filter((device) => !device.online)
        .sort((left, right) => {
          const leftSeen = left.lastSeenAt ? Date.parse(left.lastSeenAt) : 0;
          const rightSeen = right.lastSeenAt ? Date.parse(right.lastSeenAt) : 0;
          return rightSeen - leftSeen;
        })
        .slice(0, 4),
    [data.devices],
  );

  const unhealthyGroups = useMemo(
    () =>
      allGroups.filter((group) => group.count >= 2 && group.online / group.count < 0.75),
    [allGroups],
  );
  const attentionCount = offline + unhealthyGroups.length + (data.status === 'connected' ? 0 : 1);
  const statusTone = data.status !== 'connected' ? 'danger' : attentionCount ? 'warning' : 'success';
  const statusIcon =
    statusTone === 'success' ? (
      <CheckCircleFilled />
    ) : statusTone === 'warning' ? (
      <WarningFilled />
    ) : (
      <ExclamationCircleFilled />
    );

  const host = (() => {
    try {
      return data.gatewayUrl ? new URL(data.gatewayUrl).host : t('common.status.notConfigured');
    } catch {
      return t('dashboard.gateway.gatewayConfigured');
    }
  })();

  const cpuAverage = serverStats?.cpuAverage.slice(0, 3);
  const memoryUsed =
    serverStats?.totalMemory === undefined
      ? undefined
      : Math.max(
          serverStats.totalMemory -
            (serverStats.availableMemory ?? serverStats.freeMemory ?? serverStats.totalMemory),
          0,
        );
  const memoryPercent =
    memoryUsed === undefined || !serverStats?.totalMemory
      ? undefined
      : Math.round((memoryUsed / serverStats.totalMemory) * 100);

  useEffect(() => {
    if (!applicationCapabilities.manageSettings || !data.client || data.status !== 'connected') {
      setServerStats(undefined);
      return;
    }
    setServerStats(undefined);
    return data.client.server.subscribeStats(setServerStats);
  }, [applicationCapabilities.manageSettings, data.client, data.status]);

  useEffect(() => {
    if (!data.client || data.status !== 'connected') return;
    let active = true;
    setEventsLoading(true);
    setEventsError(undefined);
    void data.client.events
      .list({ limit: 30 })
      .then((events) => {
        if (active) setHistoryEvents(events);
      })
      .catch((error) => {
        if (active) {
          setEventsError(
            error instanceof Error ? error.message : t('dashboard.events.loadFailedDefault'),
          );
        }
      })
      .finally(() => {
        if (active) setEventsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [data.client, data.status, t]);

  return (
    <div className="dashboard-page page-stack">
      {data.error && <Alert type="error" showIcon title={data.error} closable />}

      {/* Top Posture Banner */}
      <section className={`dashboard-status dashboard-status-${statusTone}`}>
        <div className="dashboard-status-mark">{statusIcon}</div>
        <div className="dashboard-status-copy">
          <span>{t('dashboard.status.eyebrow')}</span>
          <strong>
            {data.status !== 'connected'
              ? t('dashboard.status.gatewayUnavailable')
              : attentionCount
                ? t('dashboard.status.attentionRequired')
                : t('dashboard.status.healthy')}
          </strong>
          <div className="dashboard-status-pills">
            <span className="pill-highlight">
              {online} / {data.devices.length} {t('common.status.online')}
            </span>
            {attentionCount > 0 && (
              <span className="pill-warning">
                {t('dashboard.attention.count', { count: attentionCount })}
              </span>
            )}
            <span>
              {data.groups.length} {t('dashboard.metrics.deviceGroups')}
            </span>
          </div>
        </div>
        <div className="dashboard-status-meta">
          <span>
            <ClockCircleOutlined />
            {data.lastMessageAt
              ? t('dashboard.status.updatedAt', {
                  time: formatters.time(data.lastMessageAt),
                })
              : t('dashboard.status.awaitingUpdate')}
          </span>
          <Button
            className="reconnect-btn"
            icon={<SyncOutlined />}
            loading={data.status === 'connecting' || data.status === 'reconnecting'}
            onClick={() => void data.reconnect().catch(() => undefined)}
          >
            {t('common.actions.reconnect')}
          </Button>
        </div>
      </section>

      {/* Metrics Row */}
      <div className="metrics-grid">
        <MetricCard
          label={t('dashboard.metrics.onlineDevices')}
          value={online}
          hint={t('dashboard.metrics.onlineRate', {
            rate: onlineRate,
          })}
          badge={`${onlineRate}%`}
          tone="green"
          icon={iconForMetric('online')}
          onClick={() => navigate('/devices?status=online')}
        />
        <MetricCard
          label={t('dashboard.metrics.abnormalDevices')}
          value={offline}
          hint={t('dashboard.metrics.offlineRate', {
            rate: offlineRate,
          })}
          badge={offline > 0 ? `${offlineRate}%` : undefined}
          tone="amber"
          icon={iconForMetric('offline')}
          onClick={() => navigate('/devices?status=offline')}
        />
        <MetricCard
          label={t('dashboard.metrics.deviceGroups')}
          value={data.groups.length}
          hint={t('dashboard.metrics.deviceGroupsHint')}
          tone="purple"
          icon={iconForMetric('groups')}
          onClick={() => navigate('/devices/groups')}
        />
        <MetricCard
          label={t('dashboard.metrics.events24h')}
          value={recentEvents.length}
          hint={t('dashboard.metrics.events24hHint')}
          tone="red"
          icon={iconForMetric('events')}
          onClick={() => navigate('/monitoring/realtime')}
        />
      </div>

      {/* Overview Grid: Attention vs Connection & Server */}
      <div className="dashboard-overview-grid">
        <section className="console-card attention-card">
          <div className="card-header">
            <div>
              <h2>{t('dashboard.attention.title')}</h2>
              <span>{t('dashboard.attention.description')}</span>
            </div>
            <Tag color={attentionCount ? 'warning' : 'success'}>
              {t('dashboard.attention.count', { count: attentionCount })}
            </Tag>
          </div>

          <div className="attention-list">
            {data.status !== 'connected' && (
              <button
                type="button"
                className="attention-item-btn"
                onClick={() => void data.reconnect().catch(() => undefined)}
              >
                <div className="attention-icon-wrap danger">
                  <ExclamationCircleFilled />
                </div>
                <div className="attention-item-content">
                  <strong>{t('dashboard.attention.gatewayTitle')}</strong>
                  <small>{t('dashboard.attention.gatewayDescription')}</small>
                </div>
                <RightOutlined className="attention-arrow" />
              </button>
            )}

            {offlineDevices.map((device) => (
              <button
                type="button"
                className="attention-item-btn"
                key={device.id}
                onClick={() => navigate(`/devices/${encodeURIComponent(device.id)}/workspace`)}
              >
                <div className="attention-icon-wrap warning">
                  <DesktopOutlined />
                </div>
                <div className="attention-item-content">
                  <strong>{device.name}</strong>
                  <small>
                    {device.lastSeenAt
                      ? t('dashboard.attention.lastSeen', {
                          time: formatters.dateTime(device.lastSeenAt),
                        })
                      : t('dashboard.attention.offline')}
                  </small>
                </div>
                <RightOutlined className="attention-arrow" />
              </button>
            ))}

            {unhealthyGroups.slice(0, Math.max(4 - offlineDevices.length, 1)).map((group) => (
              <button
                type="button"
                className="attention-item-btn"
                key={group.id}
                onClick={() =>
                  navigate(
                    group.id === '__ungrouped__'
                      ? '/devices?groupId=__ungrouped__'
                      : `/devices?groupId=${encodeURIComponent(group.id)}`,
                  )
                }
              >
                <div className="attention-icon-wrap warning">
                  <WarningFilled />
                </div>
                <div className="attention-item-content">
                  <strong>{group.name}</strong>
                  <small>
                    {t('dashboard.attention.groupHealth', {
                      online: group.online,
                      total: group.count,
                    })}
                  </small>
                </div>
                <RightOutlined className="attention-arrow" />
              </button>
            ))}

            {attentionCount === 0 && (
              <div className="attention-healthy-state">
                <div className="healthy-icon-ring">
                  <CheckCircleFilled />
                </div>
                <h3>{t('dashboard.status.healthy')}</h3>
                <p>{t('dashboard.attention.empty')}</p>
              </div>
            )}
          </div>
        </section>

        <section className="console-card connection-card">
          <div className="card-header">
            <div>
              <h2>{t('dashboard.gateway.title')}</h2>
              <span>{t('dashboard.gateway.description')}</span>
            </div>
            <Tag color={data.status === 'connected' ? 'success' : 'warning'}>
              {data.status === 'connected'
                ? t('common.status.connected')
                : t('common.status.unavailable')}
            </Tag>
          </div>

          <div className="connection-meta-grid">
            <div className="connection-meta-item">
              <span>
                <GlobalOutlined /> {t('dashboard.gateway.address')}
              </span>
              <Tooltip title={host}>
                <strong>{host}</strong>
              </Tooltip>
            </div>
            <div className="connection-meta-item">
              <span>
                <ClockCircleOutlined /> {t('dashboard.gateway.connectedAt')}
              </span>
              <strong>{data.lastConnectedAt ? formatters.time(data.lastConnectedAt) : '—'}</strong>
            </div>
            <div className="connection-meta-item">
              <span>
                <SyncOutlined /> {t('dashboard.gateway.reconnectCount')}
              </span>
              <strong>{formatters.number(data.reconnectAttempt)}</strong>
            </div>
            <div className="connection-meta-item">
              <span>
                <HistoryOutlined /> {t('dashboard.gateway.lastMessage')}
              </span>
              <strong>{data.lastMessageAt ? formatters.time(data.lastMessageAt) : '—'}</strong>
            </div>
          </div>

          <div className="connection-health">
            <div className="connection-health-header">
              <span>{t('dashboard.gateway.deviceAvailability')}</span>
              <strong>{onlineRate}%</strong>
            </div>
            <Progress
              percent={onlineRate}
              showInfo={false}
              strokeColor={{ '0%': '#2f80ff', '100%': '#2dcc70' }}
            />
          </div>

          {applicationCapabilities.manageSettings && (
            <div className="server-stats-grid">
            <div className="server-stat-box">
              <div className="server-stat-header">
                <span>{t('dashboard.server.cpu')}</span>
              </div>
              <div className="cpu-badges">
                {cpuAverage && cpuAverage.length > 0 ? (
                  cpuAverage.map((value, i) => (
                    <span
                      key={i}
                      className={`cpu-badge ${value >= 2 ? 'high' : ''}`}
                      title={`Load ${[1, 5, 15][i]}m`}
                    >
                      {value.toFixed(2)}
                    </span>
                  ))
                ) : (
                  <span className="server-stat-value">—</span>
                )}
              </div>
            </div>

            <div className="server-stat-box">
              <div className="server-stat-header">
                <span>{t('dashboard.server.memory')}</span>
                {memoryPercent !== undefined && (
                  <span style={{ color: memoryPercent >= 80 ? '#f4b43c' : '#2dcc70' }}>
                    {memoryPercent}%
                  </span>
                )}
              </div>
              <strong className="server-stat-value">
                {memoryUsed === undefined
                  ? '—'
                  : t('dashboard.server.memoryValue', {
                      used: formatMemory(memoryUsed),
                      total: formatMemory(serverStats?.totalMemory),
                    })}
              </strong>
              <Progress
                percent={memoryPercent ?? 0}
                showInfo={false}
                strokeColor={
                  memoryPercent !== undefined && memoryPercent >= 80 ? '#f4b43c' : '#2dcc70'
                }
              />
            </div>

            <div className="server-stat-box">
              <div className="server-stat-header">
                <span>
                  <RobotOutlined /> {t('dashboard.server.agentSessions')}
                </span>
              </div>
              <strong className="server-stat-value">
                {serverStats?.serverState?.agentSessions === undefined
                  ? '—'
                  : formatters.number(serverStats.serverState.agentSessions)}
              </strong>
            </div>

            <div className="server-stat-box">
              <div className="server-stat-header">
                <span>
                  <UserOutlined /> {t('dashboard.server.connectedUsers')}
                </span>
              </div>
              <strong className="server-stat-value">
                {serverStats?.serverState?.connectedUsers === undefined
                  ? '—'
                  : formatters.number(serverStats.serverState.connectedUsers)}
              </strong>
            </div>
            </div>
          )}
        </section>
      </div>

      {/* Insights Grid: Events + Platforms + Groups */}
      <div className="dashboard-insights-grid">
        <section className="console-card events-card">
          <div className="card-header">
            <div>
              <h2>{t('dashboard.events.title')}</h2>
              <span>{t('dashboard.events.description')}</span>
            </div>
            <Button type="link" onClick={() => navigate('/monitoring/realtime')}>
              {t('common.actions.viewAll')} <ArrowRightOutlined />
            </Button>
          </div>

          <div className="event-list">
            {eventsError && (
              <Alert
                showIcon
                type="warning"
                message={t('dashboard.events.loadFailed')}
                description={eventsError}
              />
            )}

            {dashboardEvents.slice(0, 10).map((event) => {
              const name = getEventTargetName(event, data.devices);
              const message = formatEventMessage(event, data.devices, data.groups);
              const tone =
                event.type === 'deviceOnline'
                  ? 'success'
                  : event.type === 'deviceOffline' || event.type === 'deviceRemoved'
                    ? 'danger'
                    : 'info';

              return (
                <div className="event-row" key={event.id}>
                  <i className={tone} />
                  <div className="event-row-body">
                    <strong>{name || event.user || t('common.status.systemEvent')}</strong>
                    <span>{message}</span>
                  </div>
                  <Tooltip title={formatters.dateTime(event.occurredAt)}>
                    <time>{formatters.time(event.occurredAt)}</time>
                  </Tooltip>
                </div>
              );
            })}

            {dashboardEvents.length === 0 &&
              (waitingForRealtimeEvents ? (
                <div className="event-list-loading">
                  <Spin size="small" />
                  <span>{t('dashboard.events.connecting')}</span>
                </div>
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={t('dashboard.events.waiting')}
                />
              ))}
          </div>
        </section>

        <section className="console-card platform-card">
          <div className="card-header">
            <div>
              <h2>{t('dashboard.platforms.title')}</h2>
              <span>{t('dashboard.platforms.description')}</span>
            </div>
          </div>

          <div className="platform-list">
            {platformData.map((platform) => {
              const percent = data.devices.length
                ? Math.round((platform.value / data.devices.length) * 100)
                : 0;
              return (
                <div className="platform-item" key={platform.key}>
                  <div className="platform-meta">
                    {platform.icon}
                    <b>{platform.label}</b>
                  </div>
                  <strong>{platform.value}</strong>
                  <em>{percent}%</em>
                  <div className="platform-bar-bg">
                    <div
                      className="platform-bar-fill"
                      style={{ width: `${percent}%`, background: platform.color }}
                    />
                  </div>
                </div>
              );
            })}

            {platformData.length === 0 && (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={t('dashboard.platforms.empty')}
              />
            )}
          </div>

          {platformData.length > 0 && (
            <div className="platform-summary-footer">
              <span>{t('dashboard.platforms.totalDevices')}</span>
              <strong>{data.devices.length}</strong>
            </div>
          )}
        </section>

        <section className="console-card groups-card">
          <div className="card-header">
            <div>
              <h2>{t('dashboard.groups.title')}</h2>
              <span>{t('dashboard.groups.description')}</span>
            </div>
            <Button type="link" onClick={() => navigate('/devices/groups')}>
              {t('common.actions.viewAll')} <ArrowRightOutlined />
            </Button>
          </div>

          <div className="group-list">
            {groups.map((group) => {
              const hasDevices = group.count > 0;
              const percent = hasDevices ? Math.round((group.online / group.count) * 100) : 0;
              const statusColor = !hasDevices
                ? '#5a6d82'
                : percent >= 80
                  ? '#2dcc70'
                  : percent >= 50
                    ? '#f4b43c'
                    : '#ff5364';

              return (
                <button
                  type="button"
                  className="group-item-btn"
                  key={group.id}
                  onClick={() =>
                    navigate(
                      group.id === '__ungrouped__'
                        ? '/devices?groupId=__ungrouped__'
                        : `/devices?groupId=${encodeURIComponent(group.id)}`,
                    )
                  }
                >
                  <div className="group-item-info">
                    <b>{group.name}</b>
                    <small>
                      {hasDevices
                        ? t('dashboard.groups.health', { online: group.online, total: group.count })
                        : t('dashboard.groups.noDevices')}
                    </small>
                  </div>
                  <div className="group-bar-wrap">
                    <div
                      className="group-bar-fill"
                      style={{ width: `${hasDevices ? percent : 0}%`, background: statusColor }}
                    />
                  </div>
                  <strong className="group-item-rate" style={{ color: statusColor }}>
                    {hasDevices ? `${percent}%` : '—'}
                  </strong>
                  <RightOutlined className="group-arrow" />
                </button>
              );
            })}

            {groups.length === 0 && (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={t('dashboard.groups.empty')}
              />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
