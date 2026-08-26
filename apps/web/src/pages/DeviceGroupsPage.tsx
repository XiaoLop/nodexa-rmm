import {
  ApartmentOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import type { DeviceGroup } from '@meshcentral/shared-state';
import {
  Button,
  Empty,
  Input,
  Table,
  Tag,
  type TableColumnsType,
} from 'antd';
import { useMemo, useState } from 'react';
import { useGatewayData } from '../features/gateway/useGatewayData';

function formatDateTime(value?: number) {
  if (!value) return '—';
  // If value is less than 10000000000, it's likely in seconds
  const date = new Date(value < 10000000000 ? value * 1000 : value);
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

export function DeviceGroupsPage() {
  const { groups, devices, client, status } = useGatewayData();
  const [query, setQuery] = useState('');

  const filteredGroups = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return groups.filter((group) => {
      const matchesQuery =
        !normalized ||
        [
          group.name,
          group.id,
          group.description,
        ].some((value) => value?.toLowerCase().includes(normalized));
      return matchesQuery;
    });
  }, [groups, query]);

  const columns: TableColumnsType<DeviceGroup> = [
    {
      title: '分组名称',
      dataIndex: 'name',
      fixed: 'left',
      width: 200,
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (value) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ApartmentOutlined style={{ color: '#177ddc' }} />
          <span style={{ fontWeight: 600, color: '#e0e0e0' }}>{value}</span>
        </div>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      width: 250,
      render: (value) => value || '—',
    },
    {
      title: '设备数量',
      key: 'deviceCount',
      width: 120,
      render: (_, group) => {
        const count = devices.filter((d) => d.groupId === group.id).length;
        return <Tag color="blue">{count} 台设备</Tag>;
      },
      sorter: (a, b) => {
        const countA = devices.filter((d) => d.groupId === a.id).length;
        const countB = devices.filter((d) => d.groupId === b.id).length;
        return countA - countB;
      },
    },
    {
      title: '创建时间',
      key: 'creation',
      width: 170,
      render: (_, group) => {
        const raw = group.raw as Record<string, unknown> | undefined;
        const creation = raw?.creation as number | undefined;
        // MeshCentral usually uses seconds for creation time
        return creation ? formatDateTime(creation) : '—';
      },
      sorter: (a, b) => {
        const rawA = a.raw as Record<string, unknown> | undefined;
        const rawB = b.raw as Record<string, unknown> | undefined;
        const creationA = (rawA?.creation as number) || 0;
        const creationB = (rawB?.creation as number) || 0;
        return creationA - creationB;
      },
    },
    {
      title: '创建者',
      key: 'creator',
      width: 150,
      render: (_, group) => {
        const raw = group.raw as Record<string, unknown> | undefined;
        return (raw?.creatorname as string) || '—';
      },
    },
  ];

  return (
    <div className="page-stack devices-page">
      <div className="page-heading">
        <div>
          <h1>设备分组</h1>
          <p>管理设备分组，查看各分组下的设备数量</p>
        </div>
      </div>
      <section className="console-card devices-table-card">
        <div className="table-toolbar devices-toolbar">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            prefix={<SearchOutlined />}
            placeholder="搜索分组名称、描述..."
            allowClear
          />
          <div className="toolbar-spacer" />
          <Tag>
            {filteredGroups.length} / {groups.length} 个分组
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
          dataSource={filteredGroups}
          pagination={{
            pageSize: 12,
            showSizeChanger: true,
            pageSizeOptions: [12, 20, 50],
            showTotal: (total) => `共 ${total} 条`,
          }}
          scroll={{ x: 1000 }}
          locale={{
            emptyText: (
              <Empty
                description={groups.length ? '没有符合筛选条件的分组' : '等待网关同步分组'}
              />
            ),
          }}
        />
      </section>
    </div>
  );
}
