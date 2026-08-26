import { EllipsisOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import type { Device } from '@meshcentral/shared-state';
import { Button, Empty, Input, Select, Table, Tag, type TableColumnsType } from 'antd';
import { useMemo, useState } from 'react';
import { deviceIcon } from '../components/ConsoleUi';
import { useGatewayData } from '../features/gateway/useGatewayData';

function rawString(device: Device, key: string) {
  const raw = device.raw as Record<string, unknown> | undefined;
  const value = raw?.[key];
  return typeof value === 'string' ? value : undefined;
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
  const { devices, groups, client, status } = useGatewayData();
  const [query, setQuery] = useState('');
  const [groupId, setGroupId] = useState('all');
  const [online, setOnline] = useState('all');
  const [platform, setPlatform] = useState('all');

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
      title: '设备名称',
      dataIndex: 'name',
      fixed: 'left',
      width: 190,
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (value, device) => (
        <span className="device-name">
          {deviceIcon(device.platform)}
          <b>{value}</b>
        </span>
      ),
    },
    { title: '设备 ID', dataIndex: 'id', width: 210, ellipsis: true },
    {
      title: 'IP / 主机',
      key: 'ip',
      width: 150,
      render: (_, device) => rawString(device, 'ip') || rawString(device, 'host') || '—',
    },
    { title: '分组', dataIndex: 'groupName', width: 130, render: (value) => value || '未分组' },
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
    { title: '平台', dataIndex: 'platform', width: 130, render: (value) => value || '未知' },
    { title: 'Agent 版本', dataIndex: 'agentVersion', width: 120, render: (value) => value || '—' },
    {
      title: '最后在线',
      dataIndex: 'lastSeenAt',
      width: 170,
      render: formatDateTime,
      sorter: (a, b) => (a.lastSeenAt || '').localeCompare(b.lastSeenAt || ''),
    },
    {
      title: '操作',
      key: 'actions',
      fixed: 'right',
      width: 70,
      render: () => <Button type="text" icon={<EllipsisOutlined />} disabled />,
    },
  ];

  return (
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
              <Empty description={devices.length ? '没有符合筛选条件的设备' : '等待网关同步设备'} />
            ),
          }}
        />
      </section>
    </div>
  );
}
