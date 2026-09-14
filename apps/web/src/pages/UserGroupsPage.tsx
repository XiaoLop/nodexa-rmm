import {
  ApartmentOutlined,
  CopyOutlined,
  DeleteOutlined,
  DesktopOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import {
  SiteRight,
  hasSiteRight,
  isSiteAdministrator,
  type UserGroup,
  type UserGroupCreateOptions,
} from '@meshcentral/control-client';
import {
  Alert,
  Button,
  Empty,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  message,
  type TableColumnsType,
} from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGatewayData } from '../features/gateway/useGatewayData';

type EditorMode = 'create' | 'edit' | 'clone';
type GroupFilter = 'all' | 'with-members' | 'no-members' | 'with-permissions' | 'no-permissions';

interface EditorState {
  mode: EditorMode;
  group?: UserGroup;
}

interface EditorValues {
  name: string;
  description?: string;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '未知错误';
}

function countLinks(group: UserGroup, type: UserGroup['links'][number]['type']): number {
  return group.links.filter((link) => link.type === type).length;
}

export function UserGroupsPage() {
  const navigate = useNavigate();
  const { client, status, userInfo } = useGatewayData();
  const [form] = Form.useForm<EditorValues>();
  const [messageApi, messageContextHolder] = message.useMessage();
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [listError, setListError] = useState<string>();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<GroupFilter>('all');
  const [editor, setEditor] = useState<EditorState>();
  const [deletingGroup, setDeletingGroup] = useState<UserGroup>();
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const requestSequence = useRef(0);
  const connected = Boolean(client && status === 'connected');
  const canManage = Boolean(
    userInfo &&
      (isSiteAdministrator(userInfo.siteadmin ?? 0) ||
        hasSiteRight(userInfo.siteadmin ?? 0, SiteRight.ManageUserGroups)),
  );
  const canWrite = connected && canManage;

  const loadGroups = useCallback(async (): Promise<UserGroup[] | undefined> => {
    if (!client || status !== 'connected') return undefined;
    const sequence = ++requestSequence.current;
    setLoading(true);
    setListError(undefined);
    try {
      const result = await client.userGroups.list();
      if (sequence === requestSequence.current) setGroups(result);
      return result;
    } catch (error) {
      if (sequence === requestSequence.current) setListError(errorMessage(error));
      return undefined;
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [client, status]);

  useEffect(() => {
    if (status === 'connected') void loadGroups();
    return () => {
      requestSequence.current += 1;
    };
  }, [loadGroups, status]);

  const filteredGroups = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return [...groups]
      .filter((group) => {
        if (normalized) {
          const match =
            group.name.toLocaleLowerCase().includes(normalized) ||
            group.description?.toLocaleLowerCase().includes(normalized) ||
            group.id.toLocaleLowerCase().includes(normalized);
          if (!match) return false;
        }

        const memberCount = countLinks(group, 'user');
        const permCount = countLinks(group, 'device-group') + countLinks(group, 'device');

        switch (filter) {
          case 'with-members':
            return memberCount > 0;
          case 'no-members':
            return memberCount === 0;
          case 'with-permissions':
            return permCount > 0;
          case 'no-permissions':
            return permCount === 0;
          default:
            return true;
        }
      })
      .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'));
  }, [filter, groups, query]);

  const openEditor = (mode: EditorMode, group?: UserGroup) => {
    setEditor({ mode, group });
    form.setFieldsValue({
      name: mode === 'clone' ? `${group?.name ?? ''} (副本)` : group?.name ?? '',
      description: group?.description ?? '',
    });
  };

  const submitEditor = async () => {
    if (!client || !canWrite || !editor) return;
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      if (editor.mode === 'edit' && editor.group) {
        await client.userGroups.update(editor.group.id, values);
      } else {
        const options: UserGroupCreateOptions = {
          name: values.name,
          description: values.description,
          cloneUserGroupId: editor.mode === 'clone' ? editor.group?.id : undefined,
        };
        await client.userGroups.create(options);
      }
      const refreshed = await loadGroups();
      if (!refreshed) {
        void messageApi.warning('操作可能已成功，但列表刷新失败，请勿重复提交。');
        return;
      }
      void messageApi.success(
        editor.mode === 'edit' ? '用户组已更新' : editor.mode === 'clone' ? '用户组已成功复制' : '用户组已成功创建',
      );
      setEditor(undefined);
      form.resetFields();
    } catch (error) {
      void messageApi.error(`保存用户组失败：${errorMessage(error)}`);
    } finally {
      setSubmitting(false);
    }
  };

  const deleteGroup = async () => {
    if (!client || !canWrite || !deletingGroup) return;
    setSubmitting(true);
    try {
      const latest = (await client.userGroups.list()).find((group) => group.id === deletingGroup.id);
      if (!latest) throw new Error('目标用户组已不存在，请刷新列表。');
      await client.userGroups.remove(latest.id);
      const refreshed = await loadGroups();
      if (!refreshed) {
        void messageApi.warning('删除可能已成功，但列表刷新失败。');
        return;
      }
      void messageApi.success(`已删除用户组「${latest.name}」`);
      setDeletingGroup(undefined);
      setDeleteConfirmation('');
    } catch (error) {
      void messageApi.error(`删除用户组失败：${errorMessage(error)}`);
    } finally {
      setSubmitting(false);
    }
  };

  const columns: TableColumnsType<UserGroup> = [
    {
      title: '用户组',
      key: 'group',
      fixed: 'left',
      width: 290,
      render: (_, group) => (
        <button
          className="user-identity"
          onClick={() => navigate(`/admin/roles/${encodeURIComponent(group.id)}`)}
          title="点击进入用户组详情"
        >
          <span className="user-group-identity-icon"><TeamOutlined /></span>
          <span>
            <strong>{group.name}</strong>
            <small>{group.description || group.id}</small>
          </span>
        </button>
      ),
    },
    {
      title: '成员规模',
      width: 130,
      sorter: (a, b) => countLinks(a, 'user') - countLinks(b, 'user'),
      render: (_, group) => {
        const count = countLinks(group, 'user');
        return count > 0 ? (
          <Tag color="purple" icon={<TeamOutlined />}>
            {count} 人
          </Tag>
        ) : (
          <Tag style={{ opacity: 0.65 }}>0 人</Tag>
        );
      },
    },
    {
      title: '设备组授权',
      width: 140,
      sorter: (a, b) => countLinks(a, 'device-group') - countLinks(b, 'device-group'),
      render: (_, group) => {
        const count = countLinks(group, 'device-group');
        return count > 0 ? (
          <Tag color="green" icon={<ApartmentOutlined />}>
            {count} 个设备组
          </Tag>
        ) : (
          <Tag style={{ opacity: 0.65 }}>0 个</Tag>
        );
      },
    },
    {
      title: '单设备授权',
      width: 140,
      sorter: (a, b) => countLinks(a, 'device') - countLinks(b, 'device'),
      render: (_, group) => {
        const count = countLinks(group, 'device');
        return count > 0 ? (
          <Tag color="blue" icon={<DesktopOutlined />}>
            {count} 台设备
          </Tag>
        ) : (
          <Tag style={{ opacity: 0.65 }}>0 台</Tag>
        );
      },
    },
    {
      title: '域与属性',
      width: 170,
      render: (_, group) => (
        <Space size={4} wrap>
          {group.domain ? <Tag color="geekblue">{group.domain}</Tag> : <Tag>默认域</Tag>}
          {group.flags === 0 ? null : <Tag color="cyan">标志 {group.flags}</Tag>}
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      fixed: 'right',
      width: 260,
      render: (_, group) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            onClick={() => navigate(`/admin/roles/${encodeURIComponent(group.id)}`)}
          >
            查看详情
          </Button>
          <Tooltip title={!canWrite ? '无管理权限' : undefined}>
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              disabled={!canWrite}
              onClick={() => openEditor('edit', group)}
            >
              编辑
            </Button>
          </Tooltip>
          <Tooltip title={!canWrite ? '无管理权限' : undefined}>
            <Button
              type="link"
              size="small"
              icon={<CopyOutlined />}
              disabled={!canWrite}
              onClick={() => openEditor('clone', group)}
            >
              复制
            </Button>
          </Tooltip>
          <Tooltip title={!canWrite ? '无管理权限' : undefined}>
            <Button
              type="link"
              danger
              size="small"
              icon={<DeleteOutlined />}
              disabled={!canWrite}
              onClick={() => {
                setDeletingGroup(group);
                setDeleteConfirmation('');
              }}
            >
              删除
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className="page-stack users-page">
      {messageContextHolder}
      <div className="page-heading">
        <div>
          <h1>用户组管理</h1>
          <p>集中配置用户角色与权限模板，向组内成员批量继承设备组和单台设备的控制权限</p>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          disabled={!canWrite}
          onClick={() => openEditor('create')}
        >
          创建用户组
        </Button>
      </div>

      {!connected ? (
        <Alert
          type="warning"
          showIcon
          message="业务网关未连接"
          description="当前保留最近一次加载的数据供查看，所有写操作已禁用。"
        />
      ) : null}
      {connected && !canManage ? (
        <Alert
          type="info"
          showIcon
          message="当前为只读模式"
          description="当前账户没有管理用户组权限，可以查看列表和详情，但不能执行修改操作。"
        />
      ) : null}
      {listError ? (
        <Alert
          type="error"
          showIcon
          message="用户组列表加载失败"
          description={listError}
          action={
            <Button size="small" onClick={() => void loadGroups()}>
              重新加载
            </Button>
          }
        />
      ) : null}

      {/* 用户组主列表卡片 */}
      <section className="console-card devices-table-card">
        <div className="table-toolbar users-toolbar">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            prefix={<SearchOutlined />}
            placeholder="搜索用户组名称、描述或 ID"
            allowClear
          />
          <Select<GroupFilter>
            className="user-group-filter-select"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: '全部用户组' },
              { value: 'with-members', label: '已分配成员' },
              { value: 'no-members', label: '未分配成员' },
              { value: 'with-permissions', label: '有资源授权' },
              { value: 'no-permissions', label: '未配置授权' },
            ]}
          />
          <div className="toolbar-spacer" />
          <Tag color="default">
            {filteredGroups.length} / {groups.length} 个用户组
          </Tag>
          <Button
            icon={<ReloadOutlined />}
            disabled={!connected}
            loading={loading}
            onClick={() => void loadGroups()}
          >
            刷新
          </Button>
        </div>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredGroups}
          loading={loading && groups.length === 0}
          pagination={{
            defaultPageSize: 20,
            showSizeChanger: true,
            pageSizeOptions: [20, 50, 100],
            showTotal: (total) => `共 ${total} 个用户组`,
          }}
          scroll={{ x: 1100 }}
          locale={{
            emptyText: (
              <Empty
                description={
                  groups.length === 0
                    ? '暂无用户组，点击右上角创建首个用户组'
                    : '没有找到符合条件的用户组'
                }
              />
            ),
          }}
        />
      </section>

      {/* 创建 / 编辑 / 复制 Modal */}
      <Modal
        title={
          editor?.mode === 'edit'
            ? '编辑用户组'
            : editor?.mode === 'clone'
            ? '复制用户组'
            : '创建用户组'
        }
        open={Boolean(editor)}
        onCancel={() => {
          setEditor(undefined);
          form.resetFields();
        }}
        onOk={() => void submitEditor()}
        confirmLoading={submitting}
        okText={editor?.mode === 'edit' ? '保存' : editor?.mode === 'clone' ? '确认复制' : '立即创建'}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" preserve={false}>
          {editor?.mode === 'clone' ? (
            <Alert
              style={{ marginBottom: 16 }}
              type="info"
              showIcon
              message="复制模式"
              description={`正在复制「${editor.group?.name}」。新用户组将继承原组的全部设备组和单设备继承权限配置，方便快速衍生新角色。`}
            />
          ) : (
            <Alert
              style={{ marginBottom: 16 }}
              type="info"
              showIcon
              message="权限继承说明"
              description="用户组是权限分发的核心工具。在用户组中配置的设备组和设备权限将自动下发给组内所有用户，简化多人授权管理。"
            />
          )}

          <Form.Item
            label="用户组名称"
            name="name"
            rules={[
              { required: true, whitespace: true, message: '请输入用户组名称' },
              { max: 128, message: '名称不能超过 128 个字符' },
            ]}
          >
            <Input autoFocus placeholder="例如：运维一组、外部技术支持、研发观察员" showCount maxLength={128} />
          </Form.Item>

          <Form.Item
            label="描述信息"
            name="description"
            rules={[{ max: 1024, message: '描述不能超过 1024 个字符' }]}
          >
            <Input.TextArea
              rows={4}
              placeholder="请输入该用户组的职责范围、适用场景或授权说明（选填）"
              showCount
              maxLength={1024}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 删除确认 Modal */}
      <Modal
        title={
          <Space>
            <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
            <span>删除用户组确认</span>
          </Space>
        }
        open={Boolean(deletingGroup)}
        onCancel={() => setDeletingGroup(undefined)}
        onOk={() => void deleteGroup()}
        okText="永久删除"
        cancelText="取消"
        confirmLoading={submitting}
        okButtonProps={{ danger: true, disabled: deleteConfirmation !== deletingGroup?.name }}
        destroyOnHidden
      >
        {deletingGroup ? (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Alert
              type="warning"
              showIcon
              message="此操作不可逆"
              description={
                <div>
                  删除后，以下关联将被永久移除：
                  <ul style={{ margin: '4px 0 0 0', paddingLeft: 20 }}>
                    <li><strong>{countLinks(deletingGroup, 'user')}</strong> 名成员将失去通过此组获得的继承权限</li>
                    <li><strong>{countLinks(deletingGroup, 'device-group')}</strong> 个设备组继承授权配置将被清除</li>
                    <li><strong>{countLinks(deletingGroup, 'device')}</strong> 台单设备继承授权配置将被清除</li>
                  </ul>
                </div>
              }
            />
            <p>
              请输入用户组名称 <strong>「{deletingGroup.name}」</strong> 以确认删除：
            </p>
            <Input
              value={deleteConfirmation}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
              placeholder={deletingGroup.name}
              autoComplete="off"
            />
          </Space>
        ) : null}
      </Modal>
    </div>
  );
}
