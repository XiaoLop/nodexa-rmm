import { SyncOutlined } from '@ant-design/icons';
import type { GatewayEvent } from '@meshcentral/control-client';
import { formatEventMessage, getEventTargetName } from '@meshcentral/shared-state';
import { Alert, Button, Empty, Spin, Tag } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { DonutChart, MetricCard, TrendChart, iconForMetric } from '../components/ConsoleUi';
import { useGatewayData } from '../features/gateway/useGatewayData';
import { useFormatters } from '../i18n';
import '../assets/styles/dashboard.css';
import '../assets/styles/dashboard-widgets.css';

const platformColors = ['#2f80ff', '#7259e8', '#2dbf73', '#f4b43c', '#708097'];

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

function makeEventTrend(events: ReturnType<typeof useGatewayData>['events']) {
  const now = Date.now();
  const bins = Array.from({ length: 12 }, () => 0);
  for (const event of events) {
    const timestamp = new Date(event.occurredAt).getTime();
    if (!Number.isFinite(timestamp)) continue;
    const ageHours = (now - timestamp) / 3_600_000;
    if (ageHours < 0 || ageHours >= 24) continue;
    const index = 11 - Math.floor(ageHours / 2);
    bins[index] = (bins[index] ?? 0) + 1;
  }
  return bins;
}

export function DashboardPage() {
  const { t } = useTranslation();
  const formatters = useFormatters();
  const navigate = useNavigate();
  const data = useGatewayData();
  const [historyEvents, setHistoryEvents] = useState<GatewayEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string>();
  const online = data.devices.filter((device) => device.online).length;
  const offline = data.devices.length - online;
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
  const recentEvents = data.events.filter(
    (event) => Date.now() - new Date(event.occurredAt).getTime() <= 86_400_000,
  );
  const eventTrend = useMemo(() => makeEventTrend(data.events), [data.events]);
  const onlineTrend = eventTrend.map((value, index) =>
    Math.max(online - Math.round(value / 2) + (index % 3), 0),
  );
  const offlineTrend = onlineTrend.map((value) => Math.max(data.devices.length - value, 0));

  const platformData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const device of data.devices) {
      const osKey = getOperatingSystem(device.platform);
      const label = osKey === 'other' ? t('dashboard.platforms.other') : osKey;
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label, value], index) => ({
        label,
        value,
        color: platformColors[index] ?? '#708097',
      }));
  }, [data.devices, t]);

  const groups = useMemo(
    () =>
      data.groups
        .map((group) => {
          const devices = data.devices.filter((device) => device.groupId === group.id);
          return {
            ...group,
            count: devices.length,
            online: devices.filter((device) => device.online).length,
          };
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 6),
    [data.devices, data.groups],
  );

  const host = (() => {
    try {
      return data.gatewayUrl ? new URL(data.gatewayUrl).host : t('common.status.notConfigured');
    } catch {
      return t('dashboard.gateway.gatewayConfigured');
    }
  })();

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
      <div className="metrics-grid">
        <MetricCard
          label={t('dashboard.metrics.totalDevices')}
          value={data.devices.length}
          hint={t('dashboard.metrics.totalDevicesHint')}
          tone="blue"
          icon={iconForMetric('total')}
        />
        <MetricCard
          label={t('dashboard.metrics.onlineDevices')}
          value={online}
          hint={t('dashboard.metrics.onlineRate', {
            rate: data.devices.length ? Math.round((online / data.devices.length) * 100) : 0,
          })}
          tone="green"
          icon={iconForMetric('online')}
          chart={onlineTrend.slice(-8)}
        />
        <MetricCard
          label={t('dashboard.metrics.deviceGroups')}
          value={data.groups.length}
          hint={t('dashboard.metrics.deviceGroupsHint')}
          tone="purple"
          icon={iconForMetric('groups')}
        />
        <MetricCard
          label={t('dashboard.metrics.abnormalDevices')}
          value={offline}
          hint={t('dashboard.metrics.offlineRate', {
            rate: data.devices.length ? Math.round((offline / data.devices.length) * 100) : 0,
          })}
          tone="amber"
          icon={iconForMetric('offline')}
          chart={offlineTrend.slice(-8)}
        />
        <MetricCard
          label={t('dashboard.metrics.events24h')}
          value={recentEvents.length}
          hint={t('dashboard.metrics.events24hHint')}
          tone="red"
          icon={iconForMetric('events')}
        />
      </div>

      <div className="dashboard-overview-grid">
        <section className="console-card chart-card dashboard-trend-card">
          <div className="card-header">
            <div>
              <h2>{t('dashboard.trend.title')}</h2>
              <span>{t('dashboard.trend.description')}</span>
            </div>
            <Tag>{t('dashboard.trend.tag24h')}</Tag>
          </div>
          <TrendChart online={onlineTrend} offline={offlineTrend} />
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
          <dl>
            <div>
              <dt>{t('dashboard.gateway.address')}</dt>
              <dd>{host}</dd>
            </div>
            <div>
              <dt>{t('dashboard.gateway.connectedAt')}</dt>
              <dd>{data.lastConnectedAt ? formatters.dateTime(data.lastConnectedAt) : '—'}</dd>
            </div>
            <div>
              <dt>{t('dashboard.gateway.reconnectCount')}</dt>
              <dd>{formatters.number(data.reconnectAttempt)}</dd>
            </div>
            <div>
              <dt>{t('dashboard.gateway.lastMessage')}</dt>
              <dd>{data.lastMessageAt ? formatters.dateTime(data.lastMessageAt) : '—'}</dd>
            </div>
          </dl>
          <Button
            icon={<SyncOutlined />}
            block
            loading={data.status === 'connecting' || data.status === 'reconnecting'}
            onClick={() => void data.reconnect().catch(() => undefined)}
          >
            {t('common.actions.reconnect')}
          </Button>
        </section>
      </div>

      <div className="dashboard-insights-grid">
        <section className="console-card events-card">
          <div className="card-header">
            <div>
              <h2>{t('dashboard.events.title')}</h2>
              <span>{t('dashboard.events.description')}</span>
            </div>
            <Button type="link" onClick={() => navigate('/monitoring/realtime')}>
              {t('common.actions.viewAll')}
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
            {dashboardEvents.map((event) => {
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
                  <div>
                    <strong>{name || event.user || t('common.status.systemEvent')}</strong>
                    <span>{message}</span>
                  </div>
                  <time>{formatters.time(event.occurredAt)}</time>
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

        <section className="console-card chart-card platform-card">
          <div className="card-header">
            <div>
              <h2>{t('dashboard.platforms.title')}</h2>
              <span>{t('dashboard.platforms.description')}</span>
            </div>
          </div>
          <DonutChart data={platformData} total={data.devices.length} />
        </section>

        <section className="console-card groups-card">
          <div className="card-header">
            <div>
              <h2>{t('dashboard.groups.title')}</h2>
              <span>{t('dashboard.groups.description')}</span>
            </div>
            <Button type="link" onClick={() => navigate('/devices/groups')}>
              {t('common.actions.viewAll')}
            </Button>
          </div>
          <div className="group-list">
            {groups.map((group) => (
              <div key={group.id}>
                <span>
                  <b>{group.name}</b>
                  <small>{t('dashboard.groups.deviceCount', { count: group.count })}</small>
                </span>
                <em>
                  <i
                    style={{ width: `${group.count ? (group.online / group.count) * 100 : 0}%` }}
                  />
                </em>
                <strong>{t('dashboard.groups.onlineCount', { count: group.online })}</strong>
              </div>
            ))}
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
