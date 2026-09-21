import {
  AppstoreOutlined,
  ReloadOutlined,
  SearchOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import type { GatewayClient } from '@meshcentral/control-client';
import type { Device } from '@meshcentral/shared-state';
import { Alert, Button, Empty, Input, Select, Space, Statistic, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  parseProcessMessage,
  parseServicesMessage,
  type DeviceProcess,
  type DeviceService,
} from '../../features/device-workspace/systemManagement';
import { useFormatters } from '../../i18n/formatters';

const requestTimeoutMs = 15_000;

type SystemListError = { code: 'parse' | 'disconnected' | 'timeout' | 'send'; raw?: string };

function errorMessage(error: unknown, code: SystemListError['code']): SystemListError {
  return error instanceof Error && error.message ? { code, raw: error.message } : { code };
}

function useDeviceSystemList<T>({
  deviceId,
  gatewayClient,
  gatewayConnected,
  deviceOnline,
  type,
  parse,
}: {
  deviceId: string;
  gatewayClient?: GatewayClient;
  gatewayConnected: boolean;
  deviceOnline: boolean;
  type: 'ps' | 'services';
  parse: (message: unknown, deviceId: string) => T[] | undefined;
}) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<SystemListError>();
  const [updatedAt, setUpdatedAt] = useState<Date>();
  const requestNumber = useRef(0);

  const load = useCallback(() => {
    if (!gatewayClient || !gatewayConnected || !deviceOnline) return;
    const request = ++requestNumber.current;
    setLoading(true);
    setError(undefined);

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      unsubscribeMessage();
      unsubscribeConnection();
    };
    const fail = (message: SystemListError) => {
      finish();
      if (request !== requestNumber.current) return;
      setError(message);
      setLoading(false);
    };
    const unsubscribeMessage = gatewayClient.on('message', (message) => {
      try {
        const result = parse(message, deviceId);
        if (!result) return;
        finish();
        if (request !== requestNumber.current) return;
        setItems(result);
        setUpdatedAt(new Date());
        setLoading(false);
      } catch (caught) {
        fail(errorMessage(caught, 'parse'));
      }
    });
    const unsubscribeConnection = gatewayClient.on('connection', (change) => {
      if (change.current === 'disconnected' || change.current === 'error') {
        fail({ code: 'disconnected' });
      }
    });
    const timeout = setTimeout(() => fail({ code: 'timeout' }), requestTimeoutMs);

    try {
      gatewayClient.send({ action: 'msg', type, nodeid: deviceId });
    } catch (caught) {
      fail(errorMessage(caught, 'send'));
    }
  }, [deviceId, deviceOnline, gatewayClient, gatewayConnected, parse, type]);

  useEffect(() => {
    setItems([]);
    setUpdatedAt(undefined);
    setError(undefined);
    if (gatewayConnected && deviceOnline) load();
    return () => {
      requestNumber.current += 1;
    };
  }, [deviceId, deviceOnline, gatewayConnected, load]);

  return { items, loading, error, updatedAt, load };
}

function PanelAlerts({
  gatewayConnected,
  deviceOnline,
  error,
  onRetry,
}: {
  gatewayConnected: boolean;
  deviceOnline: boolean;
  error?: SystemListError;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  const errorText = error?.raw ?? (error ? t(`deviceWorkspace.systemManagement.errors.${error.code}`) : undefined);
  return (
    <>
      {!deviceOnline ? (
        <Alert banner type="warning" message={t('deviceWorkspace.systemManagement.deviceOffline')} />
      ) : !gatewayConnected ? (
        <Alert banner type="warning" message={t('deviceWorkspace.systemManagement.gatewayDisconnected')} />
      ) : null}
      {error && gatewayConnected && deviceOnline && (
        <Alert
          showIcon
          type="error"
          message={t('deviceWorkspace.systemManagement.loadFailed')}
          description={errorText}
          action={<Button size="small" onClick={onRetry}>{t('common.actions.retry')}</Button>}
        />
      )}
    </>
  );
}

export function DeviceProcessesPanel({
  device,
  gatewayClient,
  gatewayConnected,
  deviceOnline,
}: {
  device: Device;
  gatewayClient?: GatewayClient;
  gatewayConnected: boolean;
  deviceOnline: boolean;
}) {
  const { t } = useTranslation();
  const { time } = useFormatters();
  const [searchText, setSearchText] = useState('');
  const { items, loading, error, updatedAt, load } = useDeviceSystemList({
    deviceId: device.id,
    gatewayClient,
    gatewayConnected,
    deviceOnline,
    type: 'ps',
    parse: parseProcessMessage,
  });
  const filteredItems = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) => [item.command, item.path, item.user, String(item.pid)]
      .some((value) => value?.toLowerCase().includes(query)));
  }, [items, searchText]);
  const userCount = useMemo(() => new Set(items.map((item) => item.user).filter(Boolean)).size, [items]);
  const columns: ColumnsType<DeviceProcess> = [
    { title: 'PID', dataIndex: 'pid', width: 95, sorter: (left, right) => left.pid - right.pid },
    { title: t('deviceWorkspace.systemManagement.processColumns.name'), dataIndex: 'command', width: 210, sorter: (left, right) => left.command.localeCompare(right.command) },
    { title: t('deviceWorkspace.systemManagement.processColumns.user'), dataIndex: 'user', width: 150, render: (value?: string) => value || '—' },
    { title: t('deviceWorkspace.systemManagement.processColumns.path'), dataIndex: 'path', render: (value?: string) => value || '—' },
  ];

  return (
    <section className="console-card workspace-system-panel">
      <div className="card-header workspace-system-toolbar">
        <div>
          <h2><AppstoreOutlined /> {t('deviceWorkspace.systemManagement.processTitle')}</h2>
          <span>{t('deviceWorkspace.systemManagement.processDescription')}</span>
        </div>
        <Space wrap>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            aria-label={t('deviceWorkspace.systemManagement.processSearchAria')}
            placeholder={t('deviceWorkspace.systemManagement.processSearchPlaceholder')}
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
          />
          <Button
            icon={<ReloadOutlined />}
            loading={loading}
            disabled={!gatewayClient || !gatewayConnected || !deviceOnline}
            onClick={load}
          >
            {t('common.actions.refresh')}
          </Button>
        </Space>
      </div>
      <div className="workspace-system-summary">
        <Statistic title={t('deviceWorkspace.systemManagement.processCount')} value={items.length} />
        <Statistic title={t('deviceWorkspace.systemManagement.userCount')} value={userCount} />
        <Statistic title={t('deviceWorkspace.systemManagement.currentResults')} value={filteredItems.length} />
        <div><span>{t('deviceWorkspace.systemManagement.lastUpdated')}</span><strong>{updatedAt ? time(updatedAt) : t('deviceWorkspace.systemManagement.notUpdated')}</strong></div>
      </div>
      <PanelAlerts
        gatewayConnected={gatewayConnected}
        deviceOnline={deviceOnline}
        error={error}
        onRetry={load}
      />
      <Table<DeviceProcess>
        rowKey="key"
        className="workspace-system-table"
        columns={columns}
        dataSource={filteredItems}
        loading={loading && items.length === 0}
        pagination={{ defaultPageSize: 25, showSizeChanger: true, pageSizeOptions: [25, 50, 100] }}
        scroll={{ x: 760 }}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={!deviceOnline ? t('deviceWorkspace.systemManagement.emptyOffline') : gatewayConnected ? t('deviceWorkspace.systemManagement.emptyProcesses') : t('deviceWorkspace.systemManagement.waitingGateway')} /> }}
      />
    </section>
  );
}

function serviceStateColor(state: string) {
  if (state === 'RUNNING') return 'success';
  if (state === 'STOPPED') return 'default';
  if (state.endsWith('_PENDING')) return 'processing';
  if (state === 'PAUSED') return 'warning';
  return 'default';
}

export function DeviceServicesPanel({
  device,
  gatewayClient,
  gatewayConnected,
  deviceOnline,
}: {
  device: Device;
  gatewayClient?: GatewayClient;
  gatewayConnected: boolean;
  deviceOnline: boolean;
}) {
  const { t } = useTranslation();
  const { time } = useFormatters();
  const [searchText, setSearchText] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const { items, loading, error, updatedAt, load } = useDeviceSystemList({
    deviceId: device.id,
    gatewayClient,
    gatewayConnected,
    deviceOnline,
    type: 'services',
    parse: parseServicesMessage,
  });
  const filteredItems = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return items.filter((item) => {
      if (stateFilter !== 'all' && item.status.state !== stateFilter) return false;
      return !query || [item.name, item.displayName, String(item.status.pid ?? '')]
        .some((value) => value.toLowerCase().includes(query));
    });
  }, [items, searchText, stateFilter]);
  const runningCount = items.filter((item) => item.status.state === 'RUNNING').length;
  const stoppedCount = items.filter((item) => item.status.state === 'STOPPED').length;
  const stateOptions = useMemo(() => [
    { label: t('deviceWorkspace.systemManagement.allStates'), value: 'all' },
    ...Array.from(new Set(items.map((item) => item.status.state))).sort().map((state) => ({
      label: t(`deviceWorkspace.systemManagement.serviceStates.${state}`, { defaultValue: state }),
      value: state,
    })),
  ], [items]);
  const columns: ColumnsType<DeviceService> = [
    { title: t('deviceWorkspace.systemManagement.serviceColumns.name'), dataIndex: 'name', width: 190, sorter: (left, right) => left.name.localeCompare(right.name) },
    { title: t('deviceWorkspace.systemManagement.serviceColumns.displayName'), dataIndex: 'displayName' },
    {
      title: t('deviceWorkspace.systemManagement.serviceColumns.status'),
      width: 115,
      render: (_, item) => <Tag color={serviceStateColor(item.status.state)}>{t(`deviceWorkspace.systemManagement.serviceStates.${item.status.state}`, { defaultValue: item.status.state })}</Tag>,
    },
    { title: 'PID', width: 95, render: (_, item) => item.status.pid || '—' },
    {
      title: t('deviceWorkspace.systemManagement.serviceColumns.controls'),
      width: 220,
      render: (_, item) => item.status.controlsAccepted.length
        ? item.status.controlsAccepted.map((control) => control.replace('SERVICE_CONTROL_', '')).join('、')
          : '—',
    },
  ];

  return (
    <section className="console-card workspace-system-panel">
      <div className="card-header workspace-system-toolbar">
        <div>
          <h2><SettingOutlined /> {t('deviceWorkspace.systemManagement.serviceTitle')}</h2>
          <span>{t('deviceWorkspace.systemManagement.serviceDescription')}</span>
        </div>
        <Space wrap>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            aria-label={t('deviceWorkspace.systemManagement.serviceSearchAria')}
            placeholder={t('deviceWorkspace.systemManagement.serviceSearchPlaceholder')}
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
          />
          <Select aria-label={t('deviceWorkspace.systemManagement.serviceFilterAria')} value={stateFilter} options={stateOptions} onChange={setStateFilter} />
          <Button
            icon={<ReloadOutlined />}
            loading={loading}
            disabled={!gatewayClient || !gatewayConnected || !deviceOnline}
            onClick={load}
          >
            {t('common.actions.refresh')}
          </Button>
        </Space>
      </div>
      <div className="workspace-system-summary">
        <Statistic title={t('deviceWorkspace.systemManagement.serviceCount')} value={items.length} />
        <Statistic title={t('deviceWorkspace.systemManagement.runningCount')} value={runningCount} />
        <Statistic title={t('deviceWorkspace.systemManagement.stoppedCount')} value={stoppedCount} />
        <div><span>{t('deviceWorkspace.systemManagement.lastUpdated')}</span><strong>{updatedAt ? time(updatedAt) : t('deviceWorkspace.systemManagement.notUpdated')}</strong></div>
      </div>
      <PanelAlerts
        gatewayConnected={gatewayConnected}
        deviceOnline={deviceOnline}
        error={error}
        onRetry={load}
      />
      <Table<DeviceService>
        rowKey="name"
        className="workspace-system-table"
        columns={columns}
        dataSource={filteredItems}
        loading={loading && items.length === 0}
        pagination={{ defaultPageSize: 25, showSizeChanger: true, pageSizeOptions: [25, 50, 100] }}
        scroll={{ x: 900 }}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={!deviceOnline ? t('deviceWorkspace.systemManagement.emptyOffline') : gatewayConnected ? t('deviceWorkspace.systemManagement.emptyServices') : t('deviceWorkspace.systemManagement.waitingGateway')} /> }}
      />
    </section>
  );
}