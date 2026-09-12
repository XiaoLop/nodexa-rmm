import type {
  GatewayEvent,
  GatewayEventType,
  HistoricalEventFilter,
} from '@meshcentral/control-client';
import { formatEventMessage, getEventTargetName } from '@meshcentral/shared-state';
import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  Empty,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGatewayData } from '../features/gateway/useGatewayData';

const allEventFilter = 'all' as const;

const eventFilters: Array<{
  label: string;
  value: HistoricalEventFilter | typeof allEventFilter;
}> = [
  { label: '全部', value: allEventFilter },
  { label: 'Agent 日志', value: 'agentlog' },
  { label: '中继日志', value: 'relaylog' },
  { label: '手动操作', value: 'manual' },
  { label: '命令执行', value: 'runcommands' },
  { label: '批量上传', value: 'batchupload' },
  { label: '设备变更', value: 'changenode' },
  { label: '设备删除', value: 'removenode' },
];

const typeLabels: Record<GatewayEventType, string> = {
  deviceOnline: '设备上线',
  deviceOffline: '设备离线',
  deviceChanged: '设备变更',
  deviceRemoved: '设备删除',
  relayLog: '中继日志',
  agentLog: 'Agent 日志',
  manualOperation: '手动操作',
  commandExecution: '命令执行',
  batchUpload: '批量上传',
  userSessionCount: '会话统计',
  unknown: '其他事件',
};

function formatDateTime(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

function filterMatches(event: GatewayEvent, filter?: HistoricalEventFilter) {
  if (!filter) return true;
  const action = event.action;
  if (filter === 'removenode') return action === 'removenode' || action === 'deletenode';
  return action === filter;
}

function sanitizeRaw(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeRaw);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      /(?:password|passwd|token|secret|cookie|authorization|auth)$/i.test(key)
        ? '***'
        : sanitizeRaw(item),
    ]),
  );
}

function rawValue(event: GatewayEvent, field: string) {
  const raw = event.raw;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const value = (raw as Record<string, unknown>)[field];
  return value === undefined || value === null ? undefined : String(value);
}

function terminalRelayEventLabel(event: GatewayEvent): string | undefined {
  if (event.type !== 'relayLog' || rawValue(event, 'protocol') !== '1') return undefined;
  const messageId = rawValue(event, 'msgid');
  if (messageId === '14') return '终端会话开始';
  if (messageId === '10') return '终端会话结束';
  return undefined;
}

function EventDetailsDrawer({
  event,
  onClose,
  devices,
}: {
  event?: GatewayEvent;
  onClose: () => void;
  devices: ReturnType<typeof useGatewayData>['devices'];
}) {
  const target = event ? getEventTargetName(event, devices) : undefined;
  const relayDetails = event?.type === 'relayLog';
  const agentDetails = event?.type === 'agentLog';
  const terminalRelayLabel = event ? terminalRelayEventLabel(event) : undefined;
  return (
    <Drawer
      title="事件详情"
      placement="right"
      width="min(720px, 100vw)"
      open={Boolean(event)}
      onClose={onClose}
      rootClassName="realtime-event-drawer"
    >
      {event ? (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="时间">{formatDateTime(event.occurredAt)}</Descriptions.Item>
            <Descriptions.Item label="类型">{typeLabels[event.type]}</Descriptions.Item>
            <Descriptions.Item label="设备">
              {target || event.deviceId || '系统事件'}
            </Descriptions.Item>
            <Descriptions.Item label="用户">{event.user || '—'}</Descriptions.Item>
            <Descriptions.Item label="来源 IP">{event.ip || '—'}</Descriptions.Item>
            <Descriptions.Item label="事件内容">
              {formatEventMessage(event, devices)}
            </Descriptions.Item>
          </Descriptions>
          {(relayDetails || agentDetails) && (
            <section>
              <Typography.Title level={5}>
                {relayDetails ? '中继扩展字段' : 'Agent 扩展字段'}
              </Typography.Title>
              <Descriptions column={1} size="small" bordered>
                {terminalRelayLabel && (
                  <Descriptions.Item label="终端审计事件">
                    {terminalRelayLabel}
                  </Descriptions.Item>
                )}
                {relayDetails && (
                  <Descriptions.Item label="协议">
                    {rawValue(event, 'protocol') || '—'}
                  </Descriptions.Item>
                )}
                {relayDetails && (
                  <Descriptions.Item label="服务端接收字节">
                    {rawValue(event, 'bytesin') || '—'}
                  </Descriptions.Item>
                )}
                {relayDetails && (
                  <Descriptions.Item label="服务端发送字节">
                    {rawValue(event, 'bytesout') || '—'}
                  </Descriptions.Item>
                )}
                {terminalRelayLabel === '终端会话结束' && (
                  <Descriptions.Item label="结束原因">未知</Descriptions.Item>
                )}
                {agentDetails && (
                  <Descriptions.Item label="消息 ID">
                    {rawValue(event, 'msgid') || '—'}
                  </Descriptions.Item>
                )}
                {agentDetails && (
                  <Descriptions.Item label="消息参数">
                    {rawValue(event, 'msgArgs') || '—'}
                  </Descriptions.Item>
                )}
                {agentDetails && (
                  <Descriptions.Item label="会话 ID">
                    {rawValue(event, 'sessionid') || '—'}
                  </Descriptions.Item>
                )}
                {agentDetails && (
                  <Descriptions.Item label="来源地址">
                    {rawValue(event, 'remoteaddr') || event.ip || '—'}
                  </Descriptions.Item>
                )}
              </Descriptions>
            </section>
          )}
          <section>
            <Typography.Title level={5}>脱敏后的原始数据</Typography.Title>
            <pre className="realtime-event-raw">
              {JSON.stringify(sanitizeRaw(event.raw), null, 2)}
            </pre>
          </section>
        </Space>
      ) : null}
    </Drawer>
  );
}

export function RealtimeEventsPage() {
  const data = useGatewayData();
  const [historyEvents, setHistoryEvents] = useState<GatewayEvent[]>([]);
  const [eventFilter, setEventFilter] = useState<HistoricalEventFilter | undefined>();
  const [historyLimit, setHistoryLimit] = useState(60);
  const [loading, setLoading] = useState(false);
  const [queryError, setQueryError] = useState<string>();
  const [selectedEvent, setSelectedEvent] = useState<GatewayEvent>();
  const requestNumber = useRef(0);

  const loadHistory = useCallback(async () => {
    if (!data.client || data.status !== 'connected') return;
    const request = ++requestNumber.current;
    setLoading(true);
    setQueryError(undefined);
    try {
      const result = await data.client.events.list({ limit: historyLimit, filter: eventFilter });
      if (request === requestNumber.current) setHistoryEvents(result);
    } catch (error) {
      if (request === requestNumber.current) {
        setQueryError(error instanceof Error ? error.message : '历史事件查询失败。');
      }
    } finally {
      if (request === requestNumber.current) setLoading(false);
    }
  }, [data.client, data.status, eventFilter, historyLimit]);

  useEffect(() => {
    void loadHistory();
    return () => {
      requestNumber.current += 1;
    };
  }, [loadHistory]);

  const events = useMemo(() => {
    const byId = new Map(historyEvents.map((event) => [event.id, event]));
    for (const event of data.events) byId.set(event.id, event);
    return [...byId.values()]
      .filter((event) => filterMatches(event, eventFilter))
      .sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt));
  }, [data.events, eventFilter, historyEvents]);
  const waitingForConnection = !data.client || data.status !== 'connected';
  const tableLoading = loading || (waitingForConnection && events.length === 0);

  const columns = [
    { title: '时间', dataIndex: 'occurredAt', width: 175, render: formatDateTime },
    {
      title: '类型',
      dataIndex: 'type',
      width: 112,
      render: (type: GatewayEventType) => <Tag>{typeLabels[type]}</Tag>,
    },
    {
      title: '设备',
      width: 150,
      render: (_: unknown, event: GatewayEvent) =>
        getEventTargetName(event, data.devices) || event.deviceId || '系统事件',
    },
    { title: '用户', dataIndex: 'user', width: 125, render: (value?: string) => value || '—' },
    { title: '来源 IP', dataIndex: 'ip', width: 135, render: (value?: string) => value || '—' },
    {
      title: '事件内容',
      render: (_: unknown, event: GatewayEvent) =>
        formatEventMessage(event, data.devices, data.groups),
    },
    {
      title: '操作',
      width: 88,
      fixed: 'right' as const,
      render: (_: unknown, event: GatewayEvent) => (
        <Button type="link" onClick={() => setSelectedEvent(event)}>
          详情
        </Button>
      ),
    },
  ];

  return (
    <div className="page-stack realtime-events-page">
      <section className="console-card">
        <div className="card-header realtime-events-toolbar">
          <div>
            <h2>实时事件</h2>
            <span>历史记录与当前连接推送的事件会自动合并。</span>
          </div>
          <Space wrap>
            <Tag
              color={
                data.status === 'connected'
                  ? 'success'
                  : data.status === 'reconnecting'
                    ? 'warning'
                    : 'default'
              }
            >
              {data.status === 'connected'
                ? '已连接'
                : data.status === 'connecting'
                  ? '连接中'
                  : data.status === 'reconnecting'
                    ? '重连中'
                    : '已断开'}
            </Tag>
            <Select
              aria-label="事件类型"
              value={eventFilter ?? allEventFilter}
              options={eventFilters}
              style={{ width: 132 }}
              onChange={(value) =>
                setEventFilter(value === allEventFilter ? undefined : value)
              }
            />
            <Select
              aria-label="获取条数"
              value={historyLimit}
              options={[30, 60, 100, 200].map((value) => ({ label: `${value} 条`, value }))}
              style={{ width: 100 }}
              onChange={(value) => setHistoryLimit(value)}
            />
          </Space>
        </div>
        {data.status !== 'connected' && (
          <Alert banner type="warning" message="实时连接已断开，当前内容可能不是最新数据。" />
        )}
        {queryError && (
          <Alert
            showIcon
            type="error"
            message="历史事件加载失败"
            description={queryError}
            action={
              <Button
                size="small"
                onClick={() => void loadHistory()}
                disabled={waitingForConnection}
                loading={loading}
              >
                重试
              </Button>
            }
          />
        )}
        <Table<GatewayEvent>
          rowKey="id"
          className="realtime-events-table"
          columns={columns}
          dataSource={events}
          loading={tableLoading ? { indicator: <Spin /> } : false}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  loading
                    ? '正在加载历史事件'
                    : waitingForConnection
                      ? '正在等待网关连接'
                      : '暂无事件'
                }
              />
            ),
          }}
          pagination={false}
          scroll={{ x: 1080 }}
          onRow={(event) => ({ onClick: () => setSelectedEvent(event) })}
        />
      </section>
      <EventDetailsDrawer
        event={selectedEvent}
        onClose={() => setSelectedEvent(undefined)}
        devices={data.devices}
      />
    </div>
  );
}
