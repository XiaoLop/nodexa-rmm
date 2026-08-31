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
  Progress,
  Table,
  Tag,
  theme,
  type TableColumnsType,
} from 'antd';
import { useMemo, useState } from 'react';
import { useGatewayData } from '../features/gateway/useGatewayData';

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

function compareGroupName(a: DeviceGroup, b: DeviceGroup) {
  const categoryDifference = nameCategory(a.name) - nameCategory(b.name);
  return categoryDifference || naturalNameCollator.compare(a.name, b.name);
}

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
  const { token } = theme.useToken();
  const { groups, devices, client, status } = useGatewayData();
  const [query, setQuery] = useState('');

  const deviceStatsByGroup = useMemo(() => {
    const stats = new Map<string, { total: number; online: number; offline: number }>();
    devices.forEach((device) => {
      if (!device.groupId) return;
      const current = stats.get(device.groupId) ?? { total: 0, online: 0, offline: 0 };
      current.total += 1;
      if (device.online) current.online += 1;
      else current.offline += 1;
      stats.set(device.groupId, current);
    });
    return stats;
  }, [devices]);

  const filteredGroups = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return groups
      .filter((group) => {
        const matchesQuery =
          !normalized ||
          [
            group.name,
            group.id,
            group.description,
          ].some((value) => value?.toLowerCase().includes(normalized));
        return matchesQuery;
      })
      .sort(compareGroupName);
  }, [groups, query]);

  const columns: TableColumnsType<DeviceGroup> = [
    {
      title: '分组名称',
      dataIndex: 'name',
      fixed: 'left',
      width: 200,
      defaultSortOrder: 'ascend',
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
        const count = deviceStatsByGroup.get(group.id)?.total ?? 0;
        return <Tag color="blue">{count} 台设备</Tag>;
      },
      sorter: (a, b) => {
        const countA = deviceStatsByGroup.get(a.id)?.total ?? 0;
        const countB = deviceStatsByGroup.get(b.id)?.total ?? 0;
        return countA - countB;
      },
    },
    {
      title: '设备统计',
      key: 'deviceStats',
      width: 260,
      render: (_, group) => {
        const stats = deviceStatsByGroup.get(group.id) ?? {
          total: 0,
          online: 0,
          offline: 0,
        };
        const onlinePercent = stats.total ? (stats.online / stats.total) * 100 : 0;
        return (
          <Progress
            percent={onlinePercent}
            strokeColor={token.colorPrimary}
            format={() => (
              <span style={{ color: token.colorPrimary }}>
                {stats.online} / {stats.offline}
              </span>
            )}
          />
        );
      },
      sorter: (a, b) => {
        const onlineA = deviceStatsByGroup.get(a.id)?.online ?? 0;
        const onlineB = deviceStatsByGroup.get(b.id)?.online ?? 0;
        return onlineA - onlineB;
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
          pagination={false}
          scroll={{ x: 1260 }}
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
