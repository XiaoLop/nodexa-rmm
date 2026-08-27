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
} from '@ant-design/icons';
import type { Device } from '@meshcentral/shared-state';
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
import { useMemo, useState } from 'react';
import { useGatewayData } from '../features/gateway/useGatewayData';
import { DeviceDetailsDrawer } from '../components/DeviceDetailsDrawer';
import { RelayValidationModal } from '../components/RelayValidationModal';

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

function osIcon(platform?: string) {
  const value = platform?.toLowerCase() ?? '';
  if (value.includes('windows')) return <WindowsOutlined />;
  if (value.includes('mac') || value.includes('apple') || value.includes('ios')) return <AppleOutlined />;
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
    hour12: false,
  }).format(date);
}

export function DevicesPage() {
  const { token } = theme.useToken();
  const { devices, groups, client, status, gatewayUrl } = useGatewayData();
  const [messageApi, messageContextHolder] = message.useMessage();
  const [modal, modalContextHolder] = Modal.useModal();
  const [query, setQuery] = useState('');
  const [groupId, setGroupId] = useState('all');
  const [online, setOnline] = useState('all');
  const [platform, setPlatform] = useState('all');
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [relayDevice, setRelayDevice] = useState<Device | null>(null);

  const runPowerAction = (device: Device, action: PowerAction) => {
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
  };

  const platforms = useMemo(
    () =>
      [
        ...new Set(
          devices
            .map((device) => device.platform)
            .filter((value): value is string => Boolean(value)),
        ),
      ].sort(),
    [devices],
  );

  const filteredDevices = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return devices.filter((device) => {
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
      const matchesGroup = groupId === 'all' || device.groupId === groupId;
      const matchesOnline = online === 'all' || device.online === (online === 'online');
      const matchesPlatform = platform === 'all' || device.platform === platform;
      return matchesQuery && matchesGroup && matchesOnline && matchesPlatform;
    });
  }, [devices, groupId, online, platform, query]);

  const columns: TableColumnsType<Device> = [
    {
      title: '设备类型',
      key: 'type',
      width: 100,
      render: (_, device) => (
        <div style={{ display: 'flex', gap: 8, fontSize: 18, color: device.online ? token.colorPrimary : token.colorTextSecondary }}>
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
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (value, device) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontWeight: 600, color: '#e0e0e0' }}>{value}</span>
          <span style={{ fontSize: 12, color: '#8c8c8c' }}>{rawString(device, 'rname') || '—'}</span>
        </div>
      ),
    },
    {
      title: '分组名称',
      key: 'groupName',
      width: 130,
      render: (_, device) => {
        const group = groups.find((g) => g.id === device.groupId);
        return group?.name || device.groupName || '未分组';
      },
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
                onClick={() => messageApi.info('文件管理功能开发中')}
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
  ];

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
          <Button type="primary" icon={<PlusOutlined />} disabled>
            添加设备
          </Button>
        </div>
        <section className="console-card devices-table-card">
          <div className="table-toolbar devices-toolbar">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              prefix={<SearchOutlined />}
              placeholder="搜索设备名称、ID、IP、平台..."
              allowClear
            />
            <Select
              value={groupId}
              onChange={setGroupId}
              options={[
                { value: 'all', label: '全部分组' },
                ...groups.map((group) => ({ value: group.id, label: group.name })),
              ]}
            />
            <Select
              value={online}
              onChange={setOnline}
              options={[
                { value: 'all', label: '全部状态' },
                { value: 'online', label: '在线' },
                { value: 'offline', label: '离线' },
              ]}
            />
            <Select
              value={platform}
              onChange={setPlatform}
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
              onClick={() => client?.requestSnapshot()}
            >
              刷新
            </Button>
          </div>
          <Table
            rowKey="id"
            rowSelection={{
              type: 'checkbox',
            }}
            columns={columns}
            dataSource={filteredDevices}
            pagination={{
              pageSize: 12,
              showSizeChanger: true,
              pageSizeOptions: [12, 20, 50],
              showTotal: (total) => `共 ${total} 条`,
            }}
            scroll={{ x: 1250 }}
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
      <DeviceDetailsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        device={selectedDevice}
        client={client}
        connected={status === 'connected'}
      />
      <RelayValidationModal
        open={Boolean(relayDevice)}
        onClose={() => setRelayDevice(null)}
        device={relayDevice}
        gatewayClient={client}
        gatewayUrl={gatewayUrl}
      />
    </>
  );
}
