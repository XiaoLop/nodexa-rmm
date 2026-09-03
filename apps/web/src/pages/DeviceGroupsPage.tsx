import {
  ApartmentOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import type { DeviceGroup } from '@meshcentral/shared-state';
import {
  Button,
  Empty,
  Form,
  Input,
  Modal,
  Progress,
  Space,
  Table,
  Tag,
  message,
  theme,
  type TableColumnsType,
} from 'antd';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const { groups, devices, client, status, refreshSnapshot } = useGatewayData();
  const navigate = useNavigate();
  const [messageApi, messageContextHolder] = message.useMessage();
  const [modal, modalContextHolder] = Modal.useModal();
  const [query, setQuery] = useState('');
  const [editingGroup, setEditingGroup] = useState<DeviceGroup | null | 'new'>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<{ name: string; description?: string }>();

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
          [group.name, group.id, group.description].some((value) =>
            value?.toLowerCase().includes(normalized),
          );
        return matchesQuery;
      })
      .sort(compareGroupName);
  }, [groups, query]);

  const openGroupEditor = (group?: DeviceGroup) => {
    form.setFieldsValue({ name: group?.name ?? '', description: group?.description ?? '' });
    setEditingGroup(group ?? 'new');
  };

  const submitGroup = async () => {
    if (!client || !editingGroup) return;
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      if (editingGroup === 'new') {
        await client.groups.create(values.name.trim(), { description: values.description?.trim() });
      } else {
        await client.groups.update(editingGroup.id, {
          name: values.name.trim(),
          description: values.description?.trim() ?? '',
        });
      }
      await refreshSnapshot();
      void messageApi.success(editingGroup === 'new' ? '已创建设备分组' : '已更新设备分组');
      setEditingGroup(null);
    } catch (error) {
      const detail = error instanceof Error ? error.message : '未知错误';
      void messageApi.error(`保存分组失败：${detail}`);
    } finally {
      setSubmitting(false);
    }
  };

  const confirmGroupDeletion = (group: DeviceGroup) => {
    if (!client) return;
    const count = deviceStatsByGroup.get(group.id)?.total ?? 0;
    modal.confirm({
      title: '删除设备分组',
      content: `确定要删除分组「${group.name}」吗？该分组当前包含 ${count} 台设备。设备迁移或删除策略将由服务端决定。`,
      okText: '删除分组',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await client.groups.remove(group.id);
          await refreshSnapshot();
          void messageApi.success(`已删除分组「${group.name}」`);
        } catch (error) {
          const detail = error instanceof Error ? error.message : '未知错误';
          void messageApi.error(`删除分组失败：${detail}`);
          throw error;
        }
      },
    });
  };

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
    {
      title: '操作',
      key: 'actions',
      fixed: 'right',
      width: 230,
      render: (_, group) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => navigate(`/devices?groupId=${encodeURIComponent(group.id)}`)}>
            查看设备
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            disabled={!client || status !== 'connected'}
            onClick={() => openGroupEditor(group)}
          >
            编辑
          </Button>
          <Button
            type="link"
            danger
            size="small"
            icon={<DeleteOutlined />}
            disabled={!client || status !== 'connected'}
            onClick={() => confirmGroupDeletion(group)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="page-stack devices-page">
      {messageContextHolder}
      {modalContextHolder}
      <div className="page-heading">
        <div>
          <h1>设备分组</h1>
          <p>管理设备分组，查看各分组下的设备数量</p>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          disabled={!client || status !== 'connected'}
          onClick={() => openGroupEditor()}
        >
          新建分组
        </Button>
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
            onClick={() => void refreshSnapshot()}
          >
            刷新
          </Button>
        </div>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredGroups}
          pagination={{
            defaultPageSize: 20,
            showSizeChanger: true,
            pageSizeOptions: [20, 50, 100],
            showTotal: (total) => `共 ${total} 个分组`,
          }}
          scroll={{ x: 1490 }}
          locale={{
            emptyText: (
              <Empty description={groups.length ? '没有符合筛选条件的分组' : '等待网关同步分组'} />
            ),
          }}
        />
      </section>
      <Modal
        title={editingGroup === 'new' ? '新建设备分组' : '编辑设备分组'}
        open={Boolean(editingGroup)}
        onCancel={() => setEditingGroup(null)}
        onOk={() => void submitGroup()}
        okText={editingGroup === 'new' ? '创建分组' : '保存修改'}
        cancelText="取消"
        confirmLoading={submitting}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item name="name" label="分组名称" rules={[{ required: true, whitespace: true, message: '请输入分组名称' }]}>
            <Input maxLength={128} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} maxLength={500} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
