import {
  EllipsisOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SettingOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { formatEventMessage, getEventTargetName, type Device } from '@meshcentral/shared-state';
import {
  Alert,
  Button,
  Empty,
  Input,
  Select,
  Table,
  Tag,
  Tooltip,
  type TableColumnsType,
} from 'antd';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DonutChart,
  MetricCard,
  TrendChart,
  deviceIcon,
  iconForMetric,
} from '../components/ConsoleUi';
import { useGatewayData } from '../features/gateway/useGatewayData';

const platformColors = ['#2f80ff', '#7259e8', '#2dbf73', '#f4b43c', '#708097'];

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
  const online = data.devices.filter((device) => device.online).length;
  const offline = data.devices.length - online;
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
      const platform = device.platform?.trim() || '其他';
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

  const columns: TableColumnsType<Device> = [
    {
      title: '设备名称',
      dataIndex: 'name',
      render: (value, device) => (
        <span className="device-name">
          {deviceIcon(device.platform)}
          <b>{value}</b>
        </span>
      ),
    },
    { title: '设备 ID', dataIndex: 'id', ellipsis: true, responsive: ['lg'] },
    {
      title: '分组',
      dataIndex: 'groupName',
      render: (value) => value || '未分组',
      responsive: ['md'],
    },
    {
      title: '状态',
      dataIndex: 'online',
      render: (value) => (
        <span className={`status-text ${value ? 'online' : 'offline'}`}>
          <i />
          {value ? '在线' : '离线'}
        </span>
      ),
    },
    {
      title: '平台',
      dataIndex: 'platform',
      render: (value) => value || '未知',
      responsive: ['lg'],
    },
    {
      title: 'Agent 版本',
      dataIndex: 'agentVersion',
      render: (value) => value || '—',
      responsive: ['xl'],
    },
    { title: '最后在线', dataIndex: 'lastSeenAt', render: formatDateTime, responsive: ['xl'] },
    {
      title: '操作',
      key: 'actions',
      width: 56,
      render: () => <Button type="text" icon={<EllipsisOutlined />} disabled />,
    },
  ];

  const host = (() => {
    try {
      return data.gatewayUrl ? new URL(data.gatewayUrl).host : '未配置';
    } catch {
      return '已配置业务网关';
    }
  })();

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
          label="需关注设备"
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

      <div className="dashboard-main-grid">
        <section className="console-card device-list-card">
          <div className="card-header">
            <div>
              <h2>设备列表</h2>
              <span>实时设备摘要</span>
            </div>
            <Button type="primary" icon={<PlusOutlined />} disabled>
              添加设备
            </Button>
          </div>
          <div className="table-toolbar">
            <Input prefix={<SearchOutlined />} placeholder="搜索设备名称、ID、IP..." />
            <Select defaultValue="all" options={[{ value: 'all', label: '全部分组' }]} />
            <Select defaultValue="all" options={[{ value: 'all', label: '全部状态' }]} />
            <Select defaultValue="all" options={[{ value: 'all', label: '全部平台' }]} />
            <div className="toolbar-spacer" />
            <Tooltip title="刷新快照">
              <Button
                icon={<ReloadOutlined />}
                disabled={data.status !== 'connected'}
                onClick={() => data.client?.requestSnapshot()}
              />
            </Tooltip>
            <Button icon={<SettingOutlined />} disabled />
          </div>
          <Table
            rowKey="id"
            columns={columns}
            dataSource={data.devices.slice(0, 8)}
            pagination={false}
            size="small"
            scroll={{ x: 760 }}
            locale={{ emptyText: <Empty description="等待网关同步设备" /> }}
          />
          <div className="table-footer">
            <span>共 {data.devices.length} 条</span>
            <Button type="link" onClick={() => navigate('/devices')}>
              查看全部设备
            </Button>
          </div>
        </section>

        <aside className="dashboard-side">
          <section className="console-card connection-card">
            <div className="card-header">
              <h2>连接状态</h2>
              <Tag color={data.status === 'connected' ? 'success' : 'warning'}>
                {data.status === 'connected' ? '已连接到网关' : '连接不可用'}
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
          <section className="console-card events-card">
            <div className="card-header">
              <h2>实时事件</h2>
              <Button type="link" onClick={() => navigate('/monitoring/realtime')}>
                查看全部
              </Button>
            </div>
            <div className="event-list">
              {data.events.slice(0, 6).map((event) => {
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
              {data.events.length === 0 && (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="等待实时事件" />
              )}
            </div>
          </section>
        </aside>
      </div>

      <div className="dashboard-charts-grid">
        <section className="console-card chart-card">
          <div className="card-header">
            <h2>设备状态统计</h2>
            <Tag>24 小时</Tag>
          </div>
          <TrendChart online={onlineTrend} offline={offlineTrend} />
        </section>
        <section className="console-card chart-card">
          <div className="card-header">
            <h2>设备平台分布</h2>
          </div>
          <DonutChart data={platformData} total={data.devices.length} />
        </section>
        <section className="console-card groups-card">
          <div className="card-header">
            <h2>设备分组统计</h2>
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
