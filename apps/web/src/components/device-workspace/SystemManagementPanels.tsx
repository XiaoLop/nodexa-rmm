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
import {
  parseProcessMessage,
  parseServicesMessage,
  type DeviceProcess,
  type DeviceService,
} from '../../features/device-workspace/systemManagement';

const requestTimeoutMs = 15_000;

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function useDeviceSystemList<T>({
  deviceId,
  gatewayClient,
  gatewayConnected,
  type,
  parse,
}: {
  deviceId: string;
  gatewayClient?: GatewayClient;
  gatewayConnected: boolean;
  type: 'ps' | 'services';
  parse: (message: unknown, deviceId: string) => T[] | undefined;
}) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [updatedAt, setUpdatedAt] = useState<Date>();
  const requestNumber = useRef(0);

  const load = useCallback(() => {
    if (!gatewayClient || !gatewayConnected) return;
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
    const fail = (message: string) => {
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
        fail(errorMessage(caught, '设备返回的数据无法解析。'));
      }
    });
    const unsubscribeConnection = gatewayClient.on('connection', (change) => {
      if (change.current === 'disconnected' || change.current === 'error') {
        fail('网关连接已断开，请恢复连接后重试。');
      }
    });
    const timeout = setTimeout(() => fail('等待设备响应超时，请确认设备在线后重试。'), requestTimeoutMs);

    try {
      gatewayClient.send({ action: 'msg', type, nodeid: deviceId });
    } catch (caught) {
      fail(errorMessage(caught, '请求发送失败。'));
    }
  }, [deviceId, gatewayClient, gatewayConnected, parse, type]);

  useEffect(() => {
    setItems([]);
    setUpdatedAt(undefined);
    setError(undefined);
    if (gatewayConnected) load();
    return () => {
      requestNumber.current += 1;
    };
  }, [deviceId, gatewayConnected, load]);

  return { items, loading, error, updatedAt, load };
}

function updatedAtText(value?: Date) {
  return value
    ? new Intl.DateTimeFormat('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(value)
    : '尚未更新';
}

function PanelAlerts({
  gatewayConnected,
  error,
  onRetry,
}: {
  gatewayConnected: boolean;
  error?: string;
  onRetry: () => void;
}) {
  return (
    <>
      {!gatewayConnected && (
        <Alert banner type="warning" message="网关连接已断开，暂时无法读取设备数据。" />
      )}
      {error && gatewayConnected && (
        <Alert
          showIcon
          type="error"
          message="数据加载失败"
          description={error}
          action={<Button size="small" onClick={onRetry}>重试</Button>}
        />
      )}
    </>
  );
}

export function DeviceProcessesPanel({
  device,
  gatewayClient,
  gatewayConnected,
}: {
  device: Device;
  gatewayClient?: GatewayClient;
  gatewayConnected: boolean;
}) {
  const [searchText, setSearchText] = useState('');
  const { items, loading, error, updatedAt, load } = useDeviceSystemList({
    deviceId: device.id,
    gatewayClient,
    gatewayConnected,
    type: 'ps',
    parse: parseProcessMessage,
  });
  const filteredItems = useMemo(() => {
    const query = searchText.trim().toLocaleLowerCase('zh-CN');
    if (!query) return items;
    return items.filter((item) => [item.command, item.path, item.user, String(item.pid)]
      .some((value) => value?.toLocaleLowerCase('zh-CN').includes(query)));
  }, [items, searchText]);
  const userCount = useMemo(() => new Set(items.map((item) => item.user).filter(Boolean)).size, [items]);
  const columns: ColumnsType<DeviceProcess> = [
    { title: 'PID', dataIndex: 'pid', width: 95, sorter: (left, right) => left.pid - right.pid },
    { title: '进程名称', dataIndex: 'command', width: 210, sorter: (left, right) => left.command.localeCompare(right.command) },
    { title: '用户', dataIndex: 'user', width: 150, render: (value?: string) => value || '—' },
    { title: '可执行文件路径', dataIndex: 'path', render: (value?: string) => value || '—' },
  ];

  return (
    <section className="console-card workspace-system-panel">
      <div className="card-header workspace-system-toolbar">
        <div>
          <h2><AppstoreOutlined /> 进程管理</h2>
          <span>查看设备当前运行的进程、所属用户与可执行文件位置。</span>
        </div>
        <Space wrap>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            aria-label="搜索进程"
            placeholder="搜索名称、PID、用户或路径"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
          />
          <Button
            icon={<ReloadOutlined />}
            loading={loading}
            disabled={!gatewayClient || !gatewayConnected}
            onClick={load}
          >
            刷新
          </Button>
        </Space>
      </div>
      <div className="workspace-system-summary">
        <Statistic title="进程总数" value={items.length} />
        <Statistic title="用户数" value={userCount} />
        <Statistic title="当前结果" value={filteredItems.length} />
        <div><span>最近更新</span><strong>{updatedAtText(updatedAt)}</strong></div>
      </div>
      <PanelAlerts gatewayConnected={gatewayConnected} error={error} onRetry={load} />
      <Table<DeviceProcess>
        rowKey="key"
        className="workspace-system-table"
        columns={columns}
        dataSource={filteredItems}
        loading={loading && items.length === 0}
        pagination={{ defaultPageSize: 25, showSizeChanger: true, pageSizeOptions: [25, 50, 100] }}
        scroll={{ x: 760 }}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={gatewayConnected ? '暂无匹配的进程' : '正在等待网关连接'} /> }}
      />
    </section>
  );
}

const serviceStateLabels: Record<string, string> = {
  RUNNING: '运行中',
  STOPPED: '已停止',
  PAUSED: '已暂停',
  START_PENDING: '正在启动',
  STOP_PENDING: '正在停止',
  CONTINUE_PENDING: '正在继续',
  PAUSE_PENDING: '正在暂停',
  UNKNOWN: '未知',
};

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
}: {
  device: Device;
  gatewayClient?: GatewayClient;
  gatewayConnected: boolean;
}) {
  const [searchText, setSearchText] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const { items, loading, error, updatedAt, load } = useDeviceSystemList({
    deviceId: device.id,
    gatewayClient,
    gatewayConnected,
    type: 'services',
    parse: parseServicesMessage,
  });
  const filteredItems = useMemo(() => {
    const query = searchText.trim().toLocaleLowerCase('zh-CN');
    return items.filter((item) => {
      if (stateFilter !== 'all' && item.status.state !== stateFilter) return false;
      return !query || [item.name, item.displayName, String(item.status.pid ?? '')]
        .some((value) => value.toLocaleLowerCase('zh-CN').includes(query));
    });
  }, [items, searchText, stateFilter]);
  const runningCount = items.filter((item) => item.status.state === 'RUNNING').length;
  const stoppedCount = items.filter((item) => item.status.state === 'STOPPED').length;
  const stateOptions = useMemo(() => [
    { label: '全部状态', value: 'all' },
    ...Array.from(new Set(items.map((item) => item.status.state))).sort().map((state) => ({
      label: serviceStateLabels[state] ?? state,
      value: state,
    })),
  ], [items]);
  const columns: ColumnsType<DeviceService> = [
    { title: '服务名称', dataIndex: 'name', width: 190, sorter: (left, right) => left.name.localeCompare(right.name) },
    { title: '显示名称', dataIndex: 'displayName' },
    {
      title: '状态',
      width: 115,
      render: (_, item) => <Tag color={serviceStateColor(item.status.state)}>{serviceStateLabels[item.status.state] ?? item.status.state}</Tag>,
    },
    { title: 'PID', width: 95, render: (_, item) => item.status.pid || '—' },
    {
      title: '可接受控制',
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
          <h2><SettingOutlined /> 系统服务</h2>
          <span>查看设备服务状态、关联进程和 Agent 报告的可接受控制。</span>
        </div>
        <Space wrap>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            aria-label="搜索服务"
            placeholder="搜索服务名称、显示名称或 PID"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
          />
          <Select aria-label="服务状态" value={stateFilter} options={stateOptions} onChange={setStateFilter} />
          <Button
            icon={<ReloadOutlined />}
            loading={loading}
            disabled={!gatewayClient || !gatewayConnected}
            onClick={load}
          >
            刷新
          </Button>
        </Space>
      </div>
      <div className="workspace-system-summary">
        <Statistic title="服务总数" value={items.length} />
        <Statistic title="运行中" value={runningCount} />
        <Statistic title="已停止" value={stoppedCount} />
        <div><span>最近更新</span><strong>{updatedAtText(updatedAt)}</strong></div>
      </div>
      <PanelAlerts gatewayConnected={gatewayConnected} error={error} onRetry={load} />
      <Table<DeviceService>
        rowKey="name"
        className="workspace-system-table"
        columns={columns}
        dataSource={filteredItems}
        loading={loading && items.length === 0}
        pagination={{ defaultPageSize: 25, showSizeChanger: true, pageSizeOptions: [25, 50, 100] }}
        scroll={{ x: 900 }}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={gatewayConnected ? '暂无匹配的服务' : '正在等待网关连接'} /> }}
      />
    </section>
  );
}