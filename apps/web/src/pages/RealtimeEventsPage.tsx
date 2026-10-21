import type {
  MeshCentralEvent,
  HistoricalEventFilter,
} from '@meshcentral/control-client';
import { getEventTargetName } from '@meshcentral/shared-state';
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
import { useTranslation } from 'react-i18next';
import {
  eventActionLabel,
  eventEntityTypeLabel,
  eventMessage,
  historicalEventMatches,
} from '../features/events/eventPresentation';
import { useMeshCentralControlData } from '../features/gateway';
import { useFormatters } from '../i18n';
import { FilterBar, PageHeader, Panel } from '../components/ui';
import '../assets/styles/realtime-events.css';

const allEventFilter = 'all' as const;

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

function rawValue(event: MeshCentralEvent, field: string) {
  const raw = event.raw;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const value = (raw as Record<string, unknown>)[field];
  return value === undefined || value === null ? undefined : String(value);
}

function EventDetailsDrawer({
  event,
  onClose,
  devices,
}: {
  event?: MeshCentralEvent;
  onClose: () => void;
  devices: ReturnType<typeof useMeshCentralControlData>['devices'];
}) {
  const { t } = useTranslation();
  const formatters = useFormatters();
  const target = event ? getEventTargetName(event, devices) : undefined;
  const relayDetails = event?.type === 'relayLog';
  const agentDetails = event?.type === 'agentLog';

  const terminalRelayLabel = useMemo(() => {
    if (!event || event.type !== 'relayLog' || rawValue(event, 'protocol') !== '1') return undefined;
    const messageId = rawValue(event, 'msgid');
    if (messageId === '14') return t('events.terminalRelay.sessionStart');
    if (messageId === '10') return t('events.terminalRelay.sessionEnd');
    return undefined;
  }, [event, t]);

  return (
    <Drawer
      title={t('events.drawer.title')}
      placement="right"
      size="min(720px, 100vw)"
      open={Boolean(event)}
      onClose={onClose}
      rootClassName="realtime-event-drawer"
    >
      {event ? (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label={t('events.drawer.time')}>
              {formatters.dateTime(event.occurredAt)}
            </Descriptions.Item>
            <Descriptions.Item label={t('events.drawer.type')}>
              {eventEntityTypeLabel(event, t)}
            </Descriptions.Item>
            <Descriptions.Item label={t('events.drawer.action')}>
              {eventActionLabel(event, t)}
            </Descriptions.Item>
            <Descriptions.Item label={t('events.drawer.device')}>
              {target || event.deviceId || t('common.status.systemEvent')}
            </Descriptions.Item>
            <Descriptions.Item label={t('events.drawer.user')}>{event.user || '—'}</Descriptions.Item>
            <Descriptions.Item label={t('events.drawer.ip')}>{event.ip || '—'}</Descriptions.Item>
            <Descriptions.Item label={t('events.drawer.content')}>
              {eventMessage(event, t)}
            </Descriptions.Item>
          </Descriptions>
          {(relayDetails || agentDetails) && (
            <section>
              <Typography.Title level={5}>
                {relayDetails ? t('events.drawer.relayFields') : t('events.drawer.agentFields')}
              </Typography.Title>
              <Descriptions column={1} size="small" bordered>
                {terminalRelayLabel && (
                  <Descriptions.Item label={t('events.drawer.terminalAudit')}>
                    {terminalRelayLabel}
                  </Descriptions.Item>
                )}
                {relayDetails && (
                  <Descriptions.Item label={t('events.drawer.protocol')}>
                    {rawValue(event, 'protocol') || '—'}
                  </Descriptions.Item>
                )}
                {relayDetails && (
                  <Descriptions.Item label={t('events.drawer.bytesIn')}>
                    {rawValue(event, 'bytesin') || '—'}
                  </Descriptions.Item>
                )}
                {relayDetails && (
                  <Descriptions.Item label={t('events.drawer.bytesOut')}>
                    {rawValue(event, 'bytesout') || '—'}
                  </Descriptions.Item>
                )}
                {terminalRelayLabel === t('events.terminalRelay.sessionEnd') && (
                  <Descriptions.Item label={t('events.drawer.endReason')}>
                    {t('common.status.unknown')}
                  </Descriptions.Item>
                )}
                {agentDetails && (
                  <Descriptions.Item label={t('events.drawer.msgId')}>
                    {rawValue(event, 'msgid') || '—'}
                  </Descriptions.Item>
                )}
                {agentDetails && (
                  <Descriptions.Item label={t('events.drawer.msgArgs')}>
                    {rawValue(event, 'msgArgs') || '—'}
                  </Descriptions.Item>
                )}
                {agentDetails && (
                  <Descriptions.Item label={t('events.drawer.sessionId')}>
                    {rawValue(event, 'sessionid') || '—'}
                  </Descriptions.Item>
                )}
                {agentDetails && (
                  <Descriptions.Item label={t('events.drawer.remoteAddr')}>
                    {rawValue(event, 'remoteaddr') || event.ip || '—'}
                  </Descriptions.Item>
                )}
              </Descriptions>
            </section>
          )}
          <section>
            <Typography.Title level={5}>{t('events.drawer.rawTitle')}</Typography.Title>
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
  const { t } = useTranslation();
  const formatters = useFormatters();
  const data = useMeshCentralControlData();
  const [historyEvents, setHistoryEvents] = useState<MeshCentralEvent[]>([]);
  const [eventFilter, setEventFilter] = useState<HistoricalEventFilter | undefined>();
  const [historyLimit, setHistoryLimit] = useState(60);
  const [loading, setLoading] = useState(false);
  const [queryError, setQueryError] = useState<string>();
  const [selectedEvent, setSelectedEvent] = useState<MeshCentralEvent>();
  const requestNumber = useRef(0);

  const eventFilters = useMemo(
    () => [
      { label: t('events.filters.all'), value: allEventFilter },
      { label: t('events.filters.agentlog'), value: 'agentlog' as const },
      { label: t('events.filters.relaylog'), value: 'relaylog' as const },
      { label: t('events.filters.manual'), value: 'manual' as const },
      { label: t('events.filters.runcommands'), value: 'runcommands' as const },
      { label: t('events.filters.batchupload'), value: 'batchupload' as const },
      { label: t('events.filters.changenode'), value: 'changenode' as const },
      { label: t('events.filters.removenode'), value: 'removenode' as const },
    ],
    [t],
  );

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
        setQueryError(
          error instanceof Error ? error.message : t('events.loadFailedDefault'),
        );
      }
    } finally {
      if (request === requestNumber.current) setLoading(false);
    }
  }, [data.client, data.status, eventFilter, historyLimit, t]);

  useEffect(() => {
    void loadHistory();
    return () => {
      requestNumber.current += 1;
    };
  }, [loadHistory]);

  const events = useMemo(() => {
    return historyEvents
      .filter((event) => historicalEventMatches(event, eventFilter))
      .sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt));
  }, [eventFilter, historyEvents]);
  const waitingForConnection = !data.client || data.status !== 'connected';
  const tableLoading = loading || (waitingForConnection && events.length === 0);
  const devicesById = useMemo(
    () => new Map(data.devices.map((device) => [device.id, device])),
    [data.devices],
  );
  const groupNamesById = useMemo(
    () => new Map(data.groups.map((group) => [group.id, group.name])),
    [data.groups],
  );

  const columns = [
    {
      title: t('events.columns.time'),
      dataIndex: 'occurredAt',
      width: 175,
      render: (value: string) => formatters.dateTime(value),
    },
    {
      title: t('events.columns.type'),
      width: 112,
      render: (_: unknown, event: MeshCentralEvent) => (
        <Tag>{eventEntityTypeLabel(event, t)}</Tag>
      ),
    },
    {
      title: t('events.columns.action'),
      width: 140,
      render: (_: unknown, event: MeshCentralEvent) => eventActionLabel(event, t),
    },
    {
      title: t('events.columns.device'),
      width: 150,
      render: (_: unknown, event: MeshCentralEvent) => {
        const deviceName = getEventTargetName(event, data.devices);
        if (!deviceName) return event.deviceId || t('common.status.systemEvent');

        const device = event.deviceId ? devicesById.get(event.deviceId) : undefined;
        const groupName = device?.groupName ?? groupNamesById.get(device?.groupId ?? '');
        return groupName ? `${groupName}/${deviceName}` : deviceName;
      },
    },
    { title: t('events.columns.user'), dataIndex: 'user', width: 125, render: (value?: string) => value || '—' },
    { title: t('events.columns.ip'), dataIndex: 'ip', width: 135, render: (value?: string) => value || '—' },
    {
      title: t('events.columns.content'),
      render: (_: unknown, event: MeshCentralEvent) =>
        eventMessage(event, t, { devices: data.devices }),
    },
    {
      title: t('events.columns.actions'),
      width: 88,
      fixed: 'right' as const,
      render: (_: unknown, event: MeshCentralEvent) => (
        <Button type="link" onClick={() => setSelectedEvent(event)}>
          {t('common.actions.details')}
        </Button>
      ),
    },
  ];

  return (
    <div className="page-stack realtime-events-page">
      <PageHeader
        title={t('events.title')}
        description={t('events.subtitle')}
        status={
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
              ? t('common.status.connected')
              : data.status === 'connecting'
                ? t('common.status.connecting')
                : data.status === 'reconnecting'
                  ? t('common.status.reconnecting')
                  : t('common.status.disconnected')}
          </Tag>
        }
      />

      <Panel>
        <FilterBar className="realtime-events-toolbar">
          <Select
            aria-label={t('events.columns.action')}
            value={eventFilter ?? allEventFilter}
            options={eventFilters}
            style={{ width: 140 }}
            onChange={(value) =>
              setEventFilter(value === allEventFilter ? undefined : value)
            }
          />
          <Select
            aria-label={t('events.countOption', { count: historyLimit })}
            value={historyLimit}
            options={[30, 60, 100, 200].map((value) => ({
              label: t('events.countOption', { count: value }),
              value,
            }))}
            style={{ width: 110 }}
            onChange={(value) => setHistoryLimit(value)}
          />
          <div className="toolbar-spacer" />
          <Button
            disabled={waitingForConnection}
            loading={loading}
            onClick={() => void loadHistory()}
          >
            {t('common.actions.refresh')}
          </Button>
        </FilterBar>
        {data.status !== 'connected' && (
          <Alert banner type="warning" title={t('events.disconnectedWarning')} />
        )}
        {queryError && (
          <Alert
            showIcon
            type="error"
            title={t('events.loadFailed')}
            description={queryError}
            action={
              <Button
                size="small"
                onClick={() => void loadHistory()}
                disabled={waitingForConnection}
                loading={loading}
              >
                {t('common.actions.retry')}
              </Button>
            }
          />
        )}
        <Table<MeshCentralEvent>
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
                    ? t('events.empty.loading')
                    : waitingForConnection
                      ? t('events.empty.waitingConnection')
                      : t('events.empty.empty')
                }
              />
            ),
          }}
          pagination={false}
          scroll={{ x: 1200 }}
          onRow={(event) => ({ onClick: () => setSelectedEvent(event) })}
        />
      </Panel>
      <EventDetailsDrawer
        event={selectedEvent}
        onClose={() => setSelectedEvent(undefined)}
        devices={data.devices}
      />
    </div>
  );
}
