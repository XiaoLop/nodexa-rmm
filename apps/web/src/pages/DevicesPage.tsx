import {
  EllipsisOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  WindowsOutlined,
  AppleOutlined,
  LinuxOutlined,
  AndroidOutlined,
  QuestionOutlined,
  CloudServerOutlined,
  DesktopOutlined,
  MobileOutlined,
  RedoOutlined,
  ThunderboltOutlined,
  MoonOutlined,
  PoweroffOutlined,
  InfoCircleOutlined,
  ToolOutlined,
  FolderOpenOutlined,
  ExperimentOutlined,
  CloudUploadOutlined,
  DeleteOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { gatewaySelectors, useGatewayStore, type Device } from '@meshcentral/shared-state';
import {
  Button,
  Dropdown,
  Empty,
  Input,
  Modal,
  Select,
  Table,
  Tag,
  message,
  type TableColumnsType,
  theme,
  Space,
  Tooltip,
} from 'antd';
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Key,
} from 'react';
import { useSearchParams } from 'react-router-dom';
import { useGateway } from '../features/gateway/GatewayProvider';
import { DeviceDetailsDrawer } from '../components/DeviceDetailsDrawer';
import { DeviceEditModal } from '../components/DeviceEditModal';
import { DeviceInviteModal } from '../components/DeviceInviteModal'; // Agent 安装引导弹窗
import { RelayValidationModal } from '../components/RelayValidationModal';
import { FileUploadModal } from '../components/FileUploadModal';
import { BatchFileUploadModal } from '../components/BatchFileUploadModal';
import { BatchDeviceOperationsModal } from '../components/BatchDeviceOperationsModal';
import { BatchUploadManager } from '../features/batch-upload/BatchUploadManager';
import { snapshotDevice, type BatchUploadDeviceSnapshot } from '../features/batch-upload/types';
import { GATEWAY_RELAY_URL, MESH_AGENTS_URL } from '../config/gateway';

type PowerAction = 'wake' | 'reset' | 'poweroff' | 'sleep';

const powerActionLabels: Record<PowerAction, string> = {
  wake: '唤醒',
  reset: '重启',
  sleep: '休眠',
  poweroff: '关机',
};

function rawString(device: Device, key: string) {
  const raw = device.raw as Record<string, unknown> | undefined;
  const value = raw?.[key];
  return typeof value === 'string' ? value : undefined;
}

function rawNumber(device: Device, key: string) {
  const raw = device.raw as Record<string, unknown> | undefined;
  const value = raw?.[key];
  return typeof value === 'number' ? value : undefined;
}

function deviceCreationTime(device: Device) {
  return rawNumber(device, 'creation') ?? rawNumber(device, 'firstconnect') ?? 0;
}

const naturalNameCollator = new Intl.Collator('zh-CN', {
  numeric: true,
  sensitivity: 'base',
});

function nameCategory(name: string) {
  const firstChar = name.trim().charAt(0);
  if (/^\d$/.test(firstChar)) return 0;
  if (/^[a-z]$/.test(firstChar)) return 1;
  if (/^[A-Z]$/.test(firstChar)) return 3;
  return 2;
}

function compareDeviceName(a: Device, b: Device) {
  const categoryDifference = nameCategory(a.name) - nameCategory(b.name);
  return categoryDifference || naturalNameCollator.compare(a.name, b.name);
}

function compareNames(a: string, b: string) {
  const categoryDifference = nameCategory(a) - nameCategory(b);
  return categoryDifference || naturalNameCollator.compare(a, b);
}

const sortedDevicesCache = new WeakMap<Device[], Device[]>();

function sortDevicesByName(devices: Device[]) {
  const cached = sortedDevicesCache.get(devices);
  if (cached) return cached;

  const sorted = [...devices].sort(compareDeviceName);
  sortedDevicesCache.set(devices, sorted);
  return sorted;
}

function osIcon(platform?: string) {
  const value = platform?.toLowerCase() ?? '';
  if (value.includes('windows')) return <WindowsOutlined />;
  if (value.includes('mac') || value.includes('apple') || value.includes('ios'))
    return <AppleOutlined />;
  if (value.includes('linux')) return <LinuxOutlined />;
  if (value.includes('android')) return <AndroidOutlined />;
  return <QuestionOutlined />;
}

function deviceTypeIcon(platform?: string) {
  const value = platform?.toLowerCase() ?? '';
  if (value.includes('server') || value.includes('linux')) return <CloudServerOutlined />;
  if (value.includes('mobile') || value.includes('android') || value.includes('ios')) {
    return <MobileOutlined />;
  }
  return <DesktopOutlined />;
}

const dateTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function formatDateTime(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return dateTimeFormatter.format(date);
}

const meshAgentsUrl = new URL(MESH_AGENTS_URL);
const deviceInviteServerInfo = {
  name: meshAgentsUrl.hostname,
  port: Number(meshAgentsUrl.port) || (meshAgentsUrl.protocol === 'https:' ? 443 : 80),
  https: meshAgentsUrl.protocol === 'https:',
  magenturl: MESH_AGENTS_URL,
};

export function DevicesPage() {
  const { token } = theme.useToken();
  const gateway = useGateway();
  const devices = useGatewayStore(gateway.store, gatewaySelectors.devices);
  const groups = useGatewayStore(gateway.store, gatewaySelectors.groups);
  const status = useGatewayStore(gateway.store, gatewaySelectors.status);
  const deferredDevices = useDeferredValue(devices, []);
  const { client, refreshSnapshot } = gateway;
  const [messageApi, messageContextHolder] = message.useMessage();
  const [modal, modalContextHolder] = Modal.useModal();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get('query') ?? '');
  const [groupId, setGroupId] = useState(() => searchParams.get('groupId') ?? '');
  const [online, setOnline] = useState(() => searchParams.get('status') ?? 'all');
  const [platform, setPlatform] = useState(() => searchParams.get('platform') ?? 'all');
  const [currentPage, setCurrentPage] = useState(() => Number(searchParams.get('page')) || 1);
  const [pageSize, setPageSize] = useState(() => Number(searchParams.get('pageSize')) || 20);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [relayDevice, setRelayDevice] = useState<Device | null>(null);
  const [uploadDevice, setUploadDevice] = useState<Device | null>(null);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<Key[]>([]);
  const [batchUploadOpen, setBatchUploadOpen] = useState(false);
  const [batchMoveOpen, setBatchMoveOpen] = useState(false);
  const [batchDevices, setBatchDevices] = useState<BatchUploadDeviceSnapshot[]>([]);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const batchUploadManagerRef = useRef<BatchUploadManager | null>(null);
  if (!batchUploadManagerRef.current) batchUploadManagerRef.current = new BatchUploadManager();
  const batchUploadManager = batchUploadManagerRef.current;

  useEffect(() => {
    // React StrictMode 在开发环境会执行一次 setup → cleanup → setup。
    // 重新激活管理器，避免第一次 cleanup 后调度器永久处于 disposed 状态。
    batchUploadManager.activate();
    return () => batchUploadManager.dispose();
  }, [batchUploadManager]);

  useEffect(() => {
    if (status !== 'connected') batchUploadManager.handleGatewayDisconnected();
  }, [batchUploadManager, status]);

  const sortedGroups = useMemo(
    () => [...groups].sort((a, b) => compareNames(a.name, b.name)),
    [groups],
  );
  const groupNameById = useMemo(
    () => new Map(groups.map((group) => [group.id, group.name])),
    [groups],
  );

  useEffect(() => {
    const next = new URLSearchParams();
    if (query.trim()) next.set('query', query.trim());
    if (groupId) next.set('groupId', groupId);
    if (online !== 'all') next.set('status', online);
    if (platform !== 'all') next.set('platform', platform);
    if (currentPage > 1) next.set('page', String(currentPage));
    if (pageSize !== 20) next.set('pageSize', String(pageSize));
    setSearchParams(next, { replace: true });
  }, [currentPage, groupId, online, pageSize, platform, query, setSearchParams]);

  const updateFilters = <T,>(setter: (value: T) => void, value: T) => {
    setter(value);
    setCurrentPage(1);
  };

  const runPowerAction = useCallback(
    (device: Device, action: PowerAction) => {
      if (!client || status !== 'connected') {
        void messageApi.error('网关未连接，无法发送设备指令');
        return;
      }

      const label = powerActionLabels[action];
      modal.confirm({
        title: `${label}设备`,
        content: `确定要对「${device.name}」执行${label}操作吗？`,
        okText: `确认${label}`,
        cancelText: '取消',
        okButtonProps: action === 'poweroff' ? { danger: true } : undefined,
        onOk: () => {
          try {
            client.sendPowerAction(device.id, action);
            void messageApi.success(`已向「${device.name}」发送${label}指令`);
          } catch (error) {
            const detail = error instanceof Error ? error.message : '未知错误';
            void messageApi.error(`${label}指令发送失败：${detail}`);
          }
        },
      });
    },
    [client, messageApi, modal, status],
  );

  const platforms = useMemo(
    () =>
      [
        ...new Set(
          deferredDevices
            .map((device) => device.platform)
            .filter((value): value is string => Boolean(value)),
        ),
      ].sort(),
    [deferredDevices],
  );

  const filteredDevices = useMemo(() => {
    const sortedDevices = sortDevicesByName(deferredDevices);
    const normalized = query.trim().toLowerCase();
    if (!normalized && !groupId && online === 'all' && platform === 'all') {
      return sortedDevices;
    }

    return sortedDevices.filter((device) => {
        const matchesQuery =
          !normalized ||
          [
            device.name,
            device.id,
            device.platform,
            device.groupName,
            rawString(device, 'ip'),
            rawString(device, 'host'),
          ].some((value) => value?.toLowerCase().includes(normalized));
        const matchesGroup = !groupId || device.groupId === groupId;
        const matchesOnline = online === 'all' || device.online === (online === 'online');
        const matchesPlatform = platform === 'all' || device.platform === platform;
        return matchesQuery && matchesGroup && matchesOnline && matchesPlatform;
      });
  }, [deferredDevices, groupId, online, platform, query]);

  const openDeviceEditor = useCallback((device: Device) => {
    setEditingDevice(device);
  }, []);

  const confirmDeviceDeletion = useCallback(
    (device: Device) => {
      if (!client) return;
      modal.confirm({
        title: '删除设备',
        content: (
          <div>
            <p>确定要删除设备「{device.name}」吗？此操作不可撤销。</p>
            <p>设备 ID：{device.id}</p>
            <p>
              分组：{groupNameById.get(device.groupId ?? '') ?? '未分组'}；状态：
              {device.online ? '在线' : '离线'}
            </p>
          </div>
        ),
        okText: '删除设备',
        cancelText: '取消',
        okButtonProps: { danger: true },
        onOk: async () => {
          try {
            await client.devices.remove(device.id);
            setSelectedDeviceIds((ids) => ids.filter((id) => String(id) !== device.id));
            if (selectedDevice?.id === device.id) setDrawerOpen(false);
            await refreshSnapshot();
            void messageApi.success(`已删除「${device.name}」`);
          } catch (error) {
            const detail = error instanceof Error ? error.message : '未知错误';
            void messageApi.error(`删除设备失败：${detail}`);
            throw error;
          }
        },
      });
    },
    [client, groupNameById, messageApi, modal, refreshSnapshot, selectedDevice?.id],
  );

  const openInviteModal = () => {
    setInviteOpen(true);
  };

  const openBatchUpload = () => {
    const existingSnapshot = batchUploadManager.getSnapshot();
    if (existingSnapshot.status === 'running' || existingSnapshot.status === 'cancelling') {
      setBatchDevices(existingSnapshot.tasks.map((task) => task.device));
      setBatchUploadOpen(true);
      return;
    }
    const selected = new Set(selectedDeviceIds.map(String));
    const snapshots = devices.filter((device) => selected.has(device.id)).map(snapshotDevice);
    if (!snapshots.length) return;
    batchUploadManager.reset();
    batchUploadManager.configure(snapshots);
    setBatchDevices(snapshots);
    setBatchUploadOpen(true);
  };

  const selectedDevices = useMemo(() => {
    const selected = new Set(selectedDeviceIds.map(String));
    return devices.filter((device) => selected.has(device.id));
  }, [devices, selectedDeviceIds]);

  const handleBatchOperationCompleted = (successfulDeviceIds: string[]) => {
    const successful = new Set(successfulDeviceIds);
    setSelectedDeviceIds((ids) => ids.filter((id) => !successful.has(String(id))));
    void refreshSnapshot().catch((error: unknown) => {
      const detail = error instanceof Error ? error.message : '未知错误';
      void messageApi.warning(`操作已提交，但刷新设备快照失败：${detail}。当前数据可能已过期。`);
    });
  };

  const confirmBatchPowerAction = (action: PowerAction) => {
    if (!client || status !== 'connected' || !selectedDevices.length) return;
    const targets = action === 'wake' ? selectedDevices : selectedDevices.filter((device) => device.online);
    const offlineCount = selectedDevices.length - targets.length;
    const label = powerActionLabels[action];
    modal.confirm({
      title: `批量${label}`,
      content: (
        <div>
          <p>确定要对 {targets.length} 台设备执行{label}操作吗？</p>
          {offlineCount > 0 && <p>{offlineCount} 台离线设备将跳过。</p>}
          <p>请求提交后不代表设备端已经完成操作。</p>
        </div>
      ),
      okText: `确认${label}`,
      cancelText: '取消',
      okButtonProps: action === 'poweroff' ? { danger: true } : undefined,
      onOk: async () => {
        if (!targets.length) {
          void messageApi.warning('没有符合条件的设备可执行此操作。');
          return;
        }
        try {
          const result = await client.devices.powerMany(
            targets.map((device) => ({ id: device.id, name: device.name })),
            action,
          );
          const successful = result.results.filter(
            (item) => item.status === 'submitted' || item.status === 'succeeded',
          );
          const failed = result.results.filter((item) => item.status === 'failed');
          handleBatchOperationCompleted(successful.map((item) => item.deviceId));
          if (failed.length) {
            void messageApi.warning(`${label}请求已提交 ${successful.length} 台，失败 ${failed.length} 台。`);
          } else {
            void messageApi.success(`已向 ${successful.length} 台设备提交${label}请求。`);
          }
        } catch (error) {
          const detail = error instanceof Error ? error.message : '未知错误';
          void messageApi.error(`${label}请求提交失败：${detail}`);
          throw error;
        }
      },
    });
  };

  const columns = useMemo<TableColumnsType<Device>>(() => [
    {
      title: '设备类型',
      key: 'type',
      width: 100,
      render: (_, device) => (
        <div
          style={{
            display: 'flex',
            gap: 8,
            fontSize: 18,
            color: device.online ? token.colorPrimary : token.colorTextSecondary,
          }}
        >
          {osIcon(device.platform)}
          {deviceTypeIcon(device.platform)}
        </div>
      ),
    },
    {
      title: '设备名称',
      dataIndex: 'name',
      fixed: 'left',
      width: 170,
      sorter: compareDeviceName,
      render: (value, device) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontWeight: 600, color: '#e0e0e0' }}>{value}</span>
          <span style={{ fontSize: 12, color: '#8c8c8c' }}>
            {rawString(device, 'rname') || '—'}
          </span>
        </div>
      ),
    },
    {
      title: '分组名称',
      key: 'groupName',
      width: 130,
      render: (_, device) =>
        groupNameById.get(device.groupId ?? '') || device.groupName || '未分组',
    },
    {
      title: 'IP',
      key: 'ip',
      width: 150,
      render: (_, device) => rawString(device, 'ip') || '-',
    },
    {
      title: '描述',
      key: 'desc',
      width: 150,
      render: (_, device) => rawString(device, 'desc') || '-',
    },
    {
      title: '状态',
      dataIndex: 'online',
      width: 100,
      filters: [
        { text: '在线', value: true },
        { text: '离线', value: false },
      ],
      onFilter: (value, record) => record.online === value,
      render: (value) => (
        <span className={`status-text ${value ? 'online' : 'offline'}`}>
          <i />
          {value ? '在线' : '离线'}
        </span>
      ),
    },
    {
      title: '最后在线时间',
      dataIndex: 'lastSeenAt',
      width: 170,
      render: formatDateTime,
      sorter: (a, b) => (a.lastSeenAt || '').localeCompare(b.lastSeenAt || ''),
    },
    {
      title: '创建时间',
      key: 'creation',
      width: 170,
      render: (_, device) => {
        const creation = deviceCreationTime(device);
        if (!creation) return '—';
        return formatDateTime(
          new Date(creation < 10000000000 ? creation * 1000 : creation).toISOString(),
        );
      },
      sorter: (a, b) => deviceCreationTime(a) - deviceCreationTime(b),
    },
    {
      title: '上次启动时间',
      key: 'lastbootuptime',
      width: 170,
      render: (_, device) => {
        const bootTime = rawNumber(device, 'lastbootuptime');
        if (!bootTime) return '—';
        return formatDateTime(new Date(bootTime).toISOString());
      },
      sorter: (a, b) => {
        const aBoot = rawNumber(a, 'lastbootuptime') || 0;
        const bBoot = rawNumber(b, 'lastbootuptime') || 0;
        return aBoot - bBoot;
      },
    },
    {
      title: '操作',
      key: 'actions',
      fixed: 'right',
      width: 160,
      render: (_, device) => {
        const unavailable = !client || status !== 'connected';
        const isOffline = !device.online;
        return (
          <Space size="small">
            {/* <Tooltip title="远程桌面">
              <Button
                type="text"
                icon={<DesktopOutlined />}
                disabled={unavailable || isOffline}
                onClick={() => messageApi.info('远程桌面功能开发中')}
              />
            </Tooltip>
            <Tooltip title="远程终端">
              <Button
                type="text"
                icon={<CodeOutlined />}
                disabled={unavailable || isOffline}
                onClick={() => messageApi.info('远程终端功能开发中')}
              />
            </Tooltip> */}
            <Tooltip title="上传文件">
              <Button
                type="text"
                icon={<FolderOpenOutlined />}
                disabled={unavailable || isOffline}
                onClick={() => setUploadDevice(device)}
              />
            </Tooltip>
            <Tooltip title="测试中继连接">
              <Button
                type="text"
                icon={<ExperimentOutlined />}
                disabled={unavailable || isOffline}
                onClick={() => setRelayDevice(device)}
              />
            </Tooltip>
            <Dropdown
              trigger={['click']}
              menu={{
                items: [
                  {
                    key: 'info',
                    icon: <InfoCircleOutlined />,
                    label: '设备信息',
                  },
                  {
                    key: 'command',
                    icon: <ToolOutlined />,
                    label: '执行指令',
                    disabled: unavailable || isOffline,
                  },
                  {
                    key: 'edit',
                    icon: <EditOutlined />,
                    label: '编辑',
                    disabled: unavailable,
                  },
                  {
                    key: 'delete',
                    icon: <DeleteOutlined />,
                    label: '删除',
                    danger: true,
                    disabled: unavailable,
                  },
                  { type: 'divider' },
                  {
                    key: 'wake',
                    icon: <ThunderboltOutlined />,
                    label: '唤醒',
                    disabled: unavailable,
                  },
                  {
                    key: 'reset',
                    icon: <RedoOutlined />,
                    label: '重启',
                    disabled: unavailable || isOffline,
                  },
                  {
                    key: 'sleep',
                    icon: <MoonOutlined />,
                    label: '休眠',
                    disabled: unavailable || isOffline,
                  },
                  { type: 'divider' },
                  {
                    key: 'poweroff',
                    icon: <PoweroffOutlined />,
                    label: '关机',
                    danger: true,
                    disabled: unavailable || isOffline,
                  },
                ],
                onClick: ({ key }) => {
                  if (['wake', 'reset', 'sleep', 'poweroff'].includes(key)) {
                    runPowerAction(device, key as PowerAction);
                  } else if (key === 'info') {
                    setSelectedDevice(device);
                    setDrawerOpen(true);
                  } else if (key === 'edit') {
                    openDeviceEditor(device);
                  } else if (key === 'delete') {
                    confirmDeviceDeletion(device);
                  } else {
                    messageApi.info(`执行指令功能开发中`);
                  }
                },
              }}
            >
              <Button type="text" icon={<EllipsisOutlined />} aria-label={`操作 ${device.name}`} />
            </Dropdown>
          </Space>
        );
      },
    },
  ], [
    client,
    confirmDeviceDeletion,
    groupNameById,
    messageApi,
    openDeviceEditor,
    runPowerAction,
    status,
    token.colorPrimary,
    token.colorTextSecondary,
  ]);

  const rowSelection = useMemo(
    () => ({
      type: 'checkbox' as const,
      selectedRowKeys: selectedDeviceIds,
      preserveSelectedRowKeys: true,
      onChange: setSelectedDeviceIds,
    }),
    [selectedDeviceIds],
  );

  const pagination = useMemo(
    () => ({
      current: currentPage,
      pageSize,
      total: filteredDevices.length,
      showSizeChanger: true,
      pageSizeOptions: [20, 50, 100],
      showTotal: (total: number) => `共 ${total} 台设备`,
      onChange: (page: number, nextPageSize: number) => {
        setCurrentPage(page);
        if (nextPageSize !== pageSize) setPageSize(nextPageSize);
      },
    }),
    [currentPage, filteredDevices.length, pageSize],
  );

  return (
    <>
      {messageContextHolder}
      {modalContextHolder}
      <div className="page-stack devices-page">
        <div className="page-heading">
          <div>
            <h1>所有设备</h1>
            <p>查看业务网关同步的设备、分组与实时在线状态</p>
          </div>
          <Space>
            <Dropdown
              trigger={['click']}
              menu={{
                items: [
                  { key: 'move', label: '移动分组' },
                  { type: 'divider' },
                  { key: 'wake', label: '唤醒' },
                  { key: 'reset', label: '重启' },
                  { key: 'sleep', label: '休眠' },
                  { key: 'poweroff', label: '关机', danger: true },
                ],
                onClick: ({ key }) => {
                  if (key === 'move') setBatchMoveOpen(true);
                  else confirmBatchPowerAction(key as PowerAction);
                },
              }}
            >
              <Button
                disabled={!client || status !== 'connected' || !selectedDevices.length}
              >
                批量操作{selectedDeviceIds.length ? `（${selectedDevices.length}）` : ''}
              </Button>
            </Dropdown>
            <Button
              icon={<CloudUploadOutlined />}
              disabled={
                batchUploadManager.getSnapshot().tasks.length === 0 &&
                (!selectedDeviceIds.length || status !== 'connected')
              }
              onClick={openBatchUpload}
            >
              批量上传文件{selectedDeviceIds.length ? `（${selectedDeviceIds.length}）` : ''}
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              disabled={!client || status !== 'connected' || !sortedGroups.length}
              onClick={openInviteModal}
            >
              添加设备
            </Button>
          </Space>
        </div>
        <section className="console-card devices-table-card">
          <div className="table-toolbar devices-toolbar">
            <Input
              value={query}
              onChange={(event) => updateFilters(setQuery, event.target.value)}
              prefix={<SearchOutlined />}
              placeholder="搜索设备名称、ID、IP、平台..."
              allowClear
            />
            <Select
              value={groupId}
              onChange={(value) => updateFilters(setGroupId, value)}
              options={[
                { value: '', label: '全部分组' },
                ...sortedGroups.map((group) => ({ value: group.id, label: group.name })),
              ]}
            />
            <Select
              value={online}
              onChange={(value) => updateFilters(setOnline, value)}
              options={[
                { value: 'all', label: '全部状态' },
                { value: 'online', label: '在线' },
                { value: 'offline', label: '离线' },
              ]}
            />
            <Select
              value={platform}
              onChange={(value) => updateFilters(setPlatform, value)}
              options={[
                { value: 'all', label: '全部平台' },
                ...platforms.map((value) => ({ value, label: value })),
              ]}
            />
            <div className="toolbar-spacer" />
            <Tag>
              {filteredDevices.length} / {devices.length} 台
            </Tag>
            <Button
              icon={<ReloadOutlined />}
              disabled={status !== 'connected'}
              onClick={() => void refreshSnapshot()}
            >
              刷新
            </Button>
          </div>
          <Table
            rowKey="id"
            loading={deferredDevices !== devices}
            rowSelection={rowSelection}
            columns={columns}
            dataSource={filteredDevices}
            pagination={pagination}
            scroll={{ x: 1420 }}
            locale={{
              emptyText: (
                <Empty
                  description={devices.length ? '没有符合筛选条件的设备' : '等待网关同步设备'}
                />
              ),
            }}
          />
        </section>
      </div>
      {drawerOpen && selectedDevice && (
        <DeviceDetailsDrawer
          open
          onClose={() => setDrawerOpen(false)}
          device={selectedDevice}
          client={client}
          connected={status === 'connected'}
        />
      )}
      {editingDevice && (
        <DeviceEditModal
          device={editingDevice}
          groups={sortedGroups}
          client={client}
          onClose={() => setEditingDevice(null)}
          onSaved={refreshSnapshot}
        />
      )}
      {inviteOpen && (
        <DeviceInviteModal
          isOpen
          meshId={sortedGroups[0]?.id ?? ''}
          meshName={sortedGroups[0]?.name ?? '默认分组'}
          groups={sortedGroups}
          serverInfo={deviceInviteServerInfo}
          onClose={() => setInviteOpen(false)}
        />
      )}
      {relayDevice && (
        <RelayValidationModal
          open
          onClose={() => setRelayDevice(null)}
          device={relayDevice}
          gatewayClient={client}
        />
      )}
      {uploadDevice && (
        <FileUploadModal
          open
          onClose={() => setUploadDevice(null)}
          device={uploadDevice}
          gatewayClient={client}
        />
      )}
      {batchUploadOpen && (
        <BatchFileUploadModal
          open
          devices={batchDevices}
          gatewayClient={client}
          baseUrl={GATEWAY_RELAY_URL}
          connected={status === 'connected'}
          manager={batchUploadManager}
          onClose={() => setBatchUploadOpen(false)}
        />
      )}
      {batchMoveOpen && (
        <BatchDeviceOperationsModal
          open
          devices={selectedDevices}
          groups={sortedGroups}
          client={client}
          connected={status === 'connected'}
          onClose={() => setBatchMoveOpen(false)}
          onCompleted={handleBatchOperationCompleted}
        />
      )}
    </>
  );
}
