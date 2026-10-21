import {
  FileSearchOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import type {
  MeshCentralClient,
  MeshCentralEvent,
  HistoricalEventFilter,
} from '@meshcentral/control-client';
import type { Device } from '@meshcentral/shared-state';
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
  Typography,
} from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  eventActionLabel,
  eventEntityTypeLabel,
  eventMessage,
  historicalEventMatches,
} from '../../features/events/eventPresentation';
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
  meshCentralClient,
  controlConnected,
}: {
  device: Device;
  meshCentralClient?: MeshCentralClient;
  controlConnected: boolean;
}) {
  const { t } = useTranslation();
  const { dateTime, compare } = useFormatters();
  const [historyEvents, setHistoryEvents] = useState<MeshCentralEvent[]>([]);
  const [eventFilter, setEventFilter] = useState<HistoricalEventFilter>();
  const [historyLimit, setHistoryLimit] = useState(100);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(false);
  const [queryError, setQueryError] = useState<string>();
  const [selectedEvent, setSelectedEvent] = useState<MeshCentralEvent>();
  const requestNumber = useRef(0);

  const loadHistory = useCallback(async () => {
    if (!meshCentralClient || !controlConnected) return;
    const request = ++requestNumber.current;
    setLoading(true);
    setQueryError(undefined);
    try {
      const result = await meshCentralClient.events.listByDevice(device.id, {
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
  }, [device.id, eventFilter, meshCentralClient, controlConnected, historyLimit]);

  useEffect(() => {
    void loadHistory();
    return () => {
      requestNumber.current += 1;
    };
  }, [loadHistory]);

  const deviceList = useMemo(() => [device], [device]);
  const filteredEvents = useMemo(() => {
    const query = searchText.trim().toLocaleLowerCase();
    return historyEvents
      .filter((event) => historicalEventMatches(event, eventFilter))
      .filter((event) => {
        if (!query) return true;
        const searchable = [
          eventEntityTypeLabel(event, t),
          eventActionLabel(event, t),
          event.action,
          event.user,
          event.ip,
          eventMessage(event, t, { devices: deviceList }),
        ];
        return searchable.some((value) => value?.toLocaleLowerCase().includes(query));
      })
        .sort((left, right) => compare(right.occurredAt, left.occurredAt));
      }, [compare, deviceList, eventFilter, historyEvents, searchText, t]);

  const columns = [
    { title: t('deviceWorkspace.logs.columns.time'), dataIndex: 'occurredAt', width: 175, render: (value?: string) => value ? dateTime(value) : '—' },
    {
      title: t('deviceWorkspace.logs.columns.action'),
      width: 140,
      render: (_: unknown, event: MeshCentralEvent) => eventActionLabel(event, t),
    },
    { title: t('deviceWorkspace.logs.columns.user'), dataIndex: 'user', width: 120, render: (value?: string) => value || t('common.status.systemEvent') },
    { title: t('deviceWorkspace.logs.columns.ip'), dataIndex: 'ip', width: 135, render: (value?: string) => value || '—' },
    {
      title: t('deviceWorkspace.logs.columns.content'),
      render: (_: unknown, event: MeshCentralEvent) =>
        eventMessage(event, t, { devices: deviceList }),
    },
    {
      title: t('deviceWorkspace.logs.columns.actions'),
      width: 76,
      fixed: 'right' as const,
      render: (_: unknown, event: MeshCentralEvent) => (
        <Button type="link" onClick={() => setSelectedEvent(event)}>{t('common.actions.details')}</Button>
      ),
    },
  ];

  const waitingForConnection = !meshCentralClient || !controlConnected;

  return (
    <section className="console-card workspace-logs-panel">
      <div className="card-header workspace-logs-toolbar">
        <div>
          <h2><FileSearchOutlined /> {t('deviceWorkspace.logs.title')}</h2>
          <span>{t('deviceWorkspace.logs.description')}</span>
        </div>
        <Space wrap>
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
            options={eventFilters.map(({ labelKey, value }) => ({
              label: t(labelKey),
              value,
            }))}
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

      {!controlConnected && (
        <Alert banner type="warning" title={t('deviceWorkspace.logs.disconnectedNotice')} />
      )}
      {queryError && (
        <Alert
          showIcon
          type="error"
          title={t('deviceWorkspace.logs.loadFailed')}
          description={queryError}
          action={<Button size="small" onClick={() => void loadHistory()}>{t('common.actions.retry')}</Button>}
        />
      )}

      <Table<MeshCentralEvent>
        rowKey="id"
        className="workspace-logs-table"
        columns={columns}
        dataSource={filteredEvents}
        loading={loading && filteredEvents.length === 0 ? { indicator: <Spin /> } : false}
        pagination={{ pageSize: 20, showSizeChanger: false, hideOnSinglePage: true }}
        scroll={{ x: 900 }}
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
        size="min(680px, 100vw)"
        open={Boolean(selectedEvent)}
        onClose={() => setSelectedEvent(undefined)}
        rootClassName="workspace-log-drawer"
      >
        {selectedEvent ? (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label={t('deviceWorkspace.logs.columns.time')}>{dateTime(selectedEvent.occurredAt)}</Descriptions.Item>
              <Descriptions.Item label={t('deviceWorkspace.logs.columns.type')}>{eventEntityTypeLabel(selectedEvent, t)}</Descriptions.Item>
              <Descriptions.Item label={t('deviceWorkspace.logs.columns.action')}>{eventActionLabel(selectedEvent, t)}</Descriptions.Item>
              <Descriptions.Item label={t('deviceWorkspace.logs.columns.user')}>{selectedEvent.user || t('common.status.systemEvent')}</Descriptions.Item>
              <Descriptions.Item label={t('deviceWorkspace.logs.columns.ip')}>{selectedEvent.ip || '—'}</Descriptions.Item>
              <Descriptions.Item label={t('deviceWorkspace.logs.columns.content')}>
                {eventMessage(selectedEvent, t, { devices: deviceList })}
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