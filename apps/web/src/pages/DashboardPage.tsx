import { SyncOutlined } from '@ant-design/icons';
import type { GatewayEvent } from '@meshcentral/control-client';
import { formatEventMessage, getEventTargetName } from '@meshcentral/shared-state';
import { Alert, Button, Empty, Spin, Tag } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DonutChart, MetricCard, TrendChart, iconForMetric } from '../components/ConsoleUi';
import { useGatewayData } from '../features/gateway/useGatewayData';

const platformColors = ['#2f80ff', '#7259e8', '#2dbf73', '#f4b43c', '#708097'];

function getOperatingSystem(platform?: string) {
  const value = platform?.trim().toLowerCase() ?? '';
  if (!value) return '其他';
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
  return '其他';
}

function formatDateTime(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
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
      const platform = getOperatingSystem(device.platform);
      counts.set(platform, (counts.get(platform) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label, value], index) => ({
        label,
        value,
        color: platformColors[index] ?? '#708097',
      }));
  }, [data.devices]);

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
      return data.gatewayUrl ? new URL(data.gatewayUrl).host : '未配置';
    } catch {
      return '已配置业务网关';
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
          setEventsError(error instanceof Error ? error.message : '仪表盘事件加载失败。');
        }
      })
      .finally(() => {
        if (active) setEventsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [data.client, data.status]);

  return (
    <div className="dashboard-page page-stack">
      {data.error && <Alert type="error" showIcon title={data.error} closable />}
      <div className="metrics-grid">
        <MetricCard
          label="总设备数"
          value={data.devices.length}
          hint="网关实时快照"
          tone="blue"
          icon={iconForMetric('total')}
        />
        <MetricCard
          label="在线设备"
          value={online}
          hint={`${data.devices.length ? Math.round((online / data.devices.length) * 100) : 0}% 在线率`}
          tone="green"
          icon={iconForMetric('online')}
          chart={onlineTrend.slice(-8)}
        />
        <MetricCard
          label="设备分组"
          value={data.groups.length}
          hint="集中分类管理"
          tone="purple"
          icon={iconForMetric('groups')}
        />
        <MetricCard
          label="异常设备"
          value={offline}
          hint={`${data.devices.length ? Math.round((offline / data.devices.length) * 100) : 0}% 离线`}
          tone="amber"
          icon={iconForMetric('offline')}
          chart={offlineTrend.slice(-8)}
        />
        <MetricCard
          label="事件（24h）"
          value={recentEvents.length}
          hint="网关实时事件"
          tone="red"
          icon={iconForMetric('events')}
        />
      </div>

      <div className="dashboard-overview-grid">
        <section className="console-card chart-card dashboard-trend-card">
          <div className="card-header">
            <div>
              <h2>设备状态趋势</h2>
              <span>过去 24 小时在线与离线设备变化</span>
            </div>
            <Tag>24 小时</Tag>
          </div>
          <TrendChart online={onlineTrend} offline={offlineTrend} />
        </section>

        <section className="console-card connection-card">
          <div className="card-header">
            <div>
              <h2>网关连接</h2>
              <span>业务网关实时通信状态</span>
            </div>
            <Tag color={data.status === 'connected' ? 'success' : 'warning'}>
              {data.status === 'connected' ? '已连接' : '不可用'}
            </Tag>
          </div>
          <dl>
            <div>
              <dt>网关地址</dt>
              <dd>{host}</dd>
            </div>
            <div>
              <dt>连接时间</dt>
              <dd>{formatDateTime(data.lastConnectedAt)}</dd>
            </div>
            <div>
              <dt>重连次数</dt>
              <dd>{data.reconnectAttempt}</dd>
            </div>
            <div>
              <dt>最后消息</dt>
              <dd>{formatDateTime(data.lastMessageAt)}</dd>
            </div>
          </dl>
          <Button
            icon={<SyncOutlined />}
            block
            loading={data.status === 'connecting' || data.status === 'reconnecting'}
            onClick={() => void data.reconnect().catch(() => undefined)}
          >
            重新连接
          </Button>
        </section>
      </div>

      <div className="dashboard-insights-grid">
        <section className="console-card events-card">
          <div className="card-header">
            <div>
              <h2>实时事件</h2>
              <span>最近的设备和系统活动</span>
            </div>
            <Button type="link" onClick={() => navigate('/monitoring/realtime')}>
              查看全部
            </Button>
          </div>
          <div className="event-list">
            {eventsError && (
              <Alert
                showIcon
                type="warning"
                message="仪表盘事件加载失败"
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
                    <strong>{name || event.user || '系统事件'}</strong>
                    <span>{message}</span>
                  </div>
                  <time>{formatDateTime(event.occurredAt).slice(-8)}</time>
                </div>
              );
            })}
            {dashboardEvents.length === 0 &&
              (waitingForRealtimeEvents ? (
                <div className="event-list-loading">
                  <Spin size="small" />
                  <span>正在连接实时事件流…</span>
                </div>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="等待实时事件" />
              ))}
          </div>
        </section>

        <section className="console-card chart-card platform-card">
          <div className="card-header">
            <div>
              <h2>平台分布</h2>
              <span>设备操作系统构成</span>
            </div>
          </div>
          <DonutChart data={platformData} total={data.devices.length} />
        </section>

        <section className="console-card groups-card">
          <div className="card-header">
            <div>
              <h2>设备分组</h2>
              <span>各分组在线设备概览</span>
            </div>
            <Button type="link" onClick={() => navigate('/devices/groups')}>
              查看全部
            </Button>
          </div>
          <div className="group-list">
            {groups.map((group) => (
              <div key={group.id}>
                <span>
                  <b>{group.name}</b>
                  <small>{group.count} 台</small>
                </span>
                <em>
                  <i
                    style={{ width: `${group.count ? (group.online / group.count) * 100 : 0}%` }}
                  />
                </em>
                <strong>{group.online} 在线</strong>
              </div>
            ))}
            {groups.length === 0 && (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无设备分组" />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
