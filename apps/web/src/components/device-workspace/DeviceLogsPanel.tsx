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
import { useTranslation } from 'react-i18next';
import { useFormatters } from '../../i18n/formatters';

const allEventFilter = 'all' as const;

const eventFilters: Array<{
  labelKey: string;
  value: HistoricalEventFilter | typeof allEventFilter;
}> = [
  { labelKey: 'deviceWorkspace.logs.filters.all', value: allEventFilter },
  { labelKey: 'deviceWorkspace.logs.filters.agentlog', value: 'agentlog' },
  { labelKey: 'deviceWorkspace.logs.filters.relaylog', value: 'relaylog' },
  { labelKey: 'deviceWorkspace.logs.filters.manual', value: 'manual' },
  { labelKey: 'deviceWorkspace.logs.filters.runcommands', value: 'runcommands' },
  { labelKey: 'deviceWorkspace.logs.filters.batchupload', value: 'batchupload' },
  { labelKey: 'deviceWorkspace.logs.filters.changenode', value: 'changenode' },
  { labelKey: 'deviceWorkspace.logs.filters.removenode', value: 'removenode' },
];

const typeLabelKeys: Record<GatewayEventType, string> = {
  deviceOnline: 'deviceWorkspace.logs.types.deviceOnline',
  deviceOffline: 'deviceWorkspace.logs.types.deviceOffline',
  deviceChanged: 'deviceWorkspace.logs.types.deviceChanged',
  deviceRemoved: 'deviceWorkspace.logs.types.deviceRemoved',
  relayLog: 'deviceWorkspace.logs.types.relayLog',
  agentLog: 'deviceWorkspace.logs.types.agentLog',
  manualOperation: 'deviceWorkspace.logs.types.manualOperation',
  commandExecution: 'deviceWorkspace.logs.types.commandExecution',
  batchUpload: 'deviceWorkspace.logs.types.batchUpload',
  userSessionCount: 'deviceWorkspace.logs.types.userSessionCount',
  unknown: 'deviceWorkspace.logs.types.unknown',
};

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
  const { t } = useTranslation();
  const { dateTime, compare } = useFormatters();
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
        setQueryError(error instanceof Error ? error.message : t('deviceWorkspace.logs.queryFailed'));
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
    const query = searchText.trim().toLocaleLowerCase();
    return [...byId.values()]
      .filter((event) => filterMatches(event, eventFilter))
      .filter((event) => {
        if (!query) return true;
        const searchable = [
          t(typeLabelKeys[event.type]),
          event.action,
          event.user,
          event.ip,
          formatEventMessage(event, deviceList, []),
        ];
        return searchable.some((value) => value?.toLocaleLowerCase().includes(query));
      })
        .sort((left, right) => compare(right.occurredAt, left.occurredAt));
      }, [compare, device.id, deviceList, eventFilter, events, historyEvents, searchText, t]);

  const columns = [
    { title: t('deviceWorkspace.logs.columns.time'), dataIndex: 'occurredAt', width: 175, render: (value?: string) => value ? dateTime(value) : '—' },
    {
      title: t('deviceWorkspace.logs.columns.type'),
      dataIndex: 'type',
      width: 116,
      render: (type: GatewayEventType) => <Tag>{t(typeLabelKeys[type])}</Tag>,
    },
    { title: t('deviceWorkspace.logs.columns.user'), dataIndex: 'user', width: 120, render: (value?: string) => value || t('common.status.systemEvent') },
    { title: t('deviceWorkspace.logs.columns.ip'), dataIndex: 'ip', width: 135, render: (value?: string) => value || '—' },
    {
      title: t('deviceWorkspace.logs.columns.content'),
      render: (_: unknown, event: GatewayEvent) => formatEventMessage(event, deviceList, []),
    },
    {
      title: t('deviceWorkspace.logs.columns.actions'),
      width: 76,
      fixed: 'right' as const,
      render: (_: unknown, event: GatewayEvent) => (
        <Button type="link" onClick={() => setSelectedEvent(event)}>{t('common.actions.details')}</Button>
      ),
    },
  ];

  const waitingForConnection = !gatewayClient || !gatewayConnected;

  return (
    <section className="console-card workspace-logs-panel">
      <div className="card-header workspace-logs-toolbar">
        <div>
          <h2><FileSearchOutlined /> {t('deviceWorkspace.logs.title')}</h2>
          <span>{t('deviceWorkspace.logs.description')}</span>
        </div>
        <Space wrap>
          <Tag color={gatewayConnected ? 'success' : 'warning'}>
            {gatewayConnected ? t('deviceWorkspace.logs.live') : t('common.status.disconnected')}
          </Tag>
          <Input.Search
            allowClear
            aria-label={t('deviceWorkspace.logs.searchAria')}
            placeholder={t('deviceWorkspace.logs.searchPlaceholder')}
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
          />
          <Select
            aria-label={t('deviceWorkspace.logs.filterAria')}
            value={eventFilter ?? allEventFilter}
            options={eventFilters.map((filter) => ({ ...filter, label: t(filter.labelKey) }))}
            onChange={(value) => setEventFilter(value === allEventFilter ? undefined : value)}
          />
          <Select
            aria-label={t('deviceWorkspace.logs.limitAria')}
            value={historyLimit}
            options={[30, 60, 100, 200].map((value) => ({ label: t('deviceWorkspace.logs.countOption', { count: value }), value }))}
            onChange={setHistoryLimit}
          />
          <Button
            icon={<ReloadOutlined />}
            loading={loading}
            disabled={waitingForConnection}
            onClick={() => void loadHistory()}
          >
            {t('common.actions.refresh')}
          </Button>
        </Space>
      </div>

      {!gatewayConnected && (
        <Alert banner type="warning" message={t('deviceWorkspace.logs.disconnectedNotice')} />
      )}
      {queryError && (
        <Alert
          showIcon
          type="error"
          message={t('deviceWorkspace.logs.loadFailed')}
          description={queryError}
          action={<Button size="small" onClick={() => void loadHistory()}>{t('common.actions.retry')}</Button>}
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
              description={waitingForConnection ? t('deviceWorkspace.logs.waitingConnection') : t('deviceWorkspace.logs.empty')}
            />
          ),
        }}
        onRow={(event) => ({ onDoubleClick: () => setSelectedEvent(event) })}
      />

      <Drawer
        title={t('deviceWorkspace.logs.drawer.title')}
        placement="right"
        width="min(680px, 100vw)"
        open={Boolean(selectedEvent)}
        onClose={() => setSelectedEvent(undefined)}
        rootClassName="workspace-log-drawer"
      >
        {selectedEvent ? (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label={t('deviceWorkspace.logs.columns.time')}>{dateTime(selectedEvent.occurredAt)}</Descriptions.Item>
              <Descriptions.Item label={t('deviceWorkspace.logs.columns.type')}>{t(typeLabelKeys[selectedEvent.type])}</Descriptions.Item>
              <Descriptions.Item label={t('deviceWorkspace.logs.drawer.action')}>{selectedEvent.action || '—'}</Descriptions.Item>
              <Descriptions.Item label={t('deviceWorkspace.logs.columns.user')}>{selectedEvent.user || t('common.status.systemEvent')}</Descriptions.Item>
              <Descriptions.Item label={t('deviceWorkspace.logs.columns.ip')}>{selectedEvent.ip || '—'}</Descriptions.Item>
              <Descriptions.Item label={t('deviceWorkspace.logs.columns.content')}>
                {formatEventMessage(selectedEvent, deviceList, [])}
              </Descriptions.Item>
            </Descriptions>
            <section>
              <Typography.Title level={5}>{t('deviceWorkspace.logs.drawer.rawTitle')}</Typography.Title>
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