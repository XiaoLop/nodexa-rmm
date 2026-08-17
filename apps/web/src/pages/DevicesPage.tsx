import { ReloadOutlined } from '@ant-design/icons';
import { Button, Card, Space, Table, Tag, Typography, type TableColumnsType } from 'antd';
import type { Device } from '@meshcentral/shared-state';
import { useGatewayData } from '../features/gateway/useGatewayData';

const columns: TableColumnsType<Device> = [
  {
    title: '设备名称',
    dataIndex: 'name',
    key: 'name',
    sorter: (a, b) => a.name.localeCompare(b.name),
  },
  { title: '设备 ID', dataIndex: 'id', key: 'id', ellipsis: true },
  { title: '分组', dataIndex: 'groupName', key: 'groupName', render: (value) => value || '未分组' },
  { title: '平台', dataIndex: 'platform', key: 'platform', render: (value) => value || '未知' },
  {
    title: '状态',
    dataIndex: 'online',
    key: 'online',
    filters: [
      { text: '在线', value: true },
      { text: '离线', value: false },
    ],
    onFilter: (value, record) => record.online === value,
    render: (online) => (
      <Tag color={online ? 'success' : 'default'}>{online ? '在线' : '离线'}</Tag>
    ),
  },
];

export function DevicesPage() {
  const { devices, client, configured, status } = useGatewayData();
  return (
    <Space orientation="vertical" size={24} className="page-stack">
      <div className="page-heading">
        <div>
          <Typography.Title level={2}>设备管理</Typography.Title>
          <Typography.Text type="secondary">查看网关同步的设备与实时在线状态</Typography.Text>
        </div>
        <Button
          icon={<ReloadOutlined />}
          disabled={!configured || status !== 'connected'}
          onClick={() => client?.requestSnapshot()}
        >
          刷新快照
        </Button>
      </div>
      <Card>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={devices}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 800 }}
        />
      </Card>
    </Space>
  );
}
