import {
  FileSearchOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import type {
  GatewayClient,
  GatewayEvent,
  GatewayEventType,
  HistoricalEventFilter,
} from '@meshcentral/control-client';
import { formatEventMessage, type Device } from '@meshcentral/shared-state';
import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  Empty,
  Input,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const allEventFilter = 'all' as const;

const eventFilters: Array<{
  label: string;
  value: HistoricalEventFilter | typeof allEventFilter;
}> = [
  { label: '全部类型', value: allEventFilter },
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
  if (filter === 'removenode') return event.action === 'removenode' || event.action === 'deletenode';
  return event.action === filter;
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

export function DeviceLogsPanel({
  device,
  events,
  gatewayClient,
  gatewayConnected,
}: {
  device: Device;
  events: GatewayEvent[];
  gatewayClient?: GatewayClient;
  gatewayConnected: boolean;
}) {
  const [historyEvents, setHistoryEvents] = useState<GatewayEvent[]>([]);
  const [eventFilter, setEventFilter] = useState<HistoricalEventFilter>();
  const [historyLimit, setHistoryLimit] = useState(100);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(false);
  const [queryError, setQueryError] = useState<string>();
  const [selectedEvent, setSelectedEvent] = useState<GatewayEvent>();
  const requestNumber = useRef(0);

  const loadHistory = useCallback(async () => {
    if (!gatewayClient || !gatewayConnected) return;
    const request = ++requestNumber.current;
    setLoading(true);
    setQueryError(undefined);
    try {
      const result = await gatewayClient.events.listByDevice(device.id, {
        limit: historyLimit,
        filter: eventFilter,
      });
      if (request === requestNumber.current) setHistoryEvents(result);
    } catch (error) {
      if (request === requestNumber.current) {
        setQueryError(error instanceof Error ? error.message : '设备日志查询失败。');
      }
    } finally {
      if (request === requestNumber.current) setLoading(false);
    }
  }, [device.id, eventFilter, gatewayClient, gatewayConnected, historyLimit]);

  useEffect(() => {
    void loadHistory();
    return () => {
      requestNumber.current += 1;
    };
  }, [loadHistory]);

  const deviceList = useMemo(() => [device], [device]);
  const filteredEvents = useMemo(() => {
    const byId = new Map(historyEvents.map((event) => [event.id, event]));
    for (const event of events) {
      if (event.deviceId === device.id) byId.set(event.id, event);
    }
    const query = searchText.trim().toLocaleLowerCase('zh-CN');
    return [...byId.values()]
      .filter((event) => filterMatches(event, eventFilter))
      .filter((event) => {
        if (!query) return true;
        const searchable = [
          typeLabels[event.type],
          event.action,
          event.user,
          event.ip,
          formatEventMessage(event, deviceList, []),
        ];
        return searchable.some((value) => value?.toLocaleLowerCase('zh-CN').includes(query));
      })
      .sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt));
  }, [device.id, deviceList, eventFilter, events, historyEvents, searchText]);

  const columns = [
    { title: '时间', dataIndex: 'occurredAt', width: 175, render: formatDateTime },
    {
      title: '类型',
      dataIndex: 'type',
      width: 116,
      render: (type: GatewayEventType) => <Tag>{typeLabels[type]}</Tag>,
    },
    { title: '用户', dataIndex: 'user', width: 120, render: (value?: string) => value || '系统' },
    { title: '来源 IP', dataIndex: 'ip', width: 135, render: (value?: string) => value || '—' },
    {
      title: '日志内容',
      render: (_: unknown, event: GatewayEvent) => formatEventMessage(event, deviceList, []),
    },
    {
      title: '操作',
      width: 76,
      fixed: 'right' as const,
      render: (_: unknown, event: GatewayEvent) => (
        <Button type="link" onClick={() => setSelectedEvent(event)}>详情</Button>
      ),
    },
  ];

  const waitingForConnection = !gatewayClient || !gatewayConnected;

  return (
    <section className="console-card workspace-logs-panel">
      <div className="card-header workspace-logs-toolbar">
        <div>
          <h2><FileSearchOutlined /> 设备日志监控</h2>
          <span>历史记录与当前连接推送的设备事件会自动合并。</span>
        </div>
        <Space wrap>
          <Tag color={gatewayConnected ? 'success' : 'warning'}>
            {gatewayConnected ? '实时监控中' : '连接已断开'}
          </Tag>
          <Input.Search
            allowClear
            aria-label="搜索设备日志"
            placeholder="搜索内容、用户或 IP"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
          />
          <Select
            aria-label="日志类型"
            value={eventFilter ?? allEventFilter}
            options={eventFilters}
            onChange={(value) => setEventFilter(value === allEventFilter ? undefined : value)}
          />
          <Select
            aria-label="日志条数"
            value={historyLimit}
            options={[30, 60, 100, 200].map((value) => ({ label: `${value} 条`, value }))}
            onChange={setHistoryLimit}
          />
          <Button
            icon={<ReloadOutlined />}
            loading={loading}
            disabled={waitingForConnection}
            onClick={() => void loadHistory()}
          >
            刷新
          </Button>
        </Space>
      </div>

      {!gatewayConnected && (
        <Alert banner type="warning" message="网关连接已断开，当前日志可能不是最新数据。" />
      )}
      {queryError && (
        <Alert
          showIcon
          type="error"
          message="设备日志加载失败"
          description={queryError}
          action={<Button size="small" onClick={() => void loadHistory()}>重试</Button>}
        />
      )}

      <Table<GatewayEvent>
        rowKey="id"
        className="workspace-logs-table"
        columns={columns}
        dataSource={filteredEvents}
        loading={loading && filteredEvents.length === 0 ? { indicator: <Spin /> } : false}
        pagination={{ pageSize: 20, showSizeChanger: false, hideOnSinglePage: true }}
        scroll={{ x: 880 }}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={waitingForConnection ? '正在等待网关连接' : '暂无匹配的设备日志'}
            />
          ),
        }}
        onRow={(event) => ({ onDoubleClick: () => setSelectedEvent(event) })}
      />

      <Drawer
        title="设备日志详情"
        placement="right"
        width="min(680px, 100vw)"
        open={Boolean(selectedEvent)}
        onClose={() => setSelectedEvent(undefined)}
        rootClassName="workspace-log-drawer"
      >
        {selectedEvent ? (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="时间">{formatDateTime(selectedEvent.occurredAt)}</Descriptions.Item>
              <Descriptions.Item label="类型">{typeLabels[selectedEvent.type]}</Descriptions.Item>
              <Descriptions.Item label="操作">{selectedEvent.action || '—'}</Descriptions.Item>
              <Descriptions.Item label="用户">{selectedEvent.user || '系统'}</Descriptions.Item>
              <Descriptions.Item label="来源 IP">{selectedEvent.ip || '—'}</Descriptions.Item>
              <Descriptions.Item label="日志内容">
                {formatEventMessage(selectedEvent, deviceList, [])}
              </Descriptions.Item>
            </Descriptions>
            <section>
              <Typography.Title level={5}>脱敏后的原始数据</Typography.Title>
              <pre className="workspace-log-raw">
                {JSON.stringify(sanitizeRaw(selectedEvent.raw), null, 2)}
              </pre>
            </section>
          </Space>
        ) : null}
      </Drawer>
    </section>
  );
}