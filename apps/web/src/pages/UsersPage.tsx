import {
  DeleteOutlined,
  EditOutlined,
  LockOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  UnlockOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  isFullAdministrator,
  type ManagedUser,
  type UserCreateOptions,
  type UserSessionCounts,
} from '@meshcentral/control-client';
import {
  Alert,
  Button,
  Empty,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  message,
  type TableColumnsType,
} from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserCreateModal } from '../components/users/UserCreateModal';
import { filterManagedUsers, type UserFilter } from '../features/users/userFilters';
import { isCurrentUser, isLastActiveAdministrator } from '../features/users/userProtection';
import { useGatewayData } from '../features/gateway/useGatewayData';
import '../assets/styles/users.css';

function formatDateTime(value?: string, missing = '未提供') {
  if (!value) return missing;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return missing;
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '未知错误';
}

function findLatestUser(users: ManagedUser[], userId: string): ManagedUser {
  const user = users.find((item) => item.id === userId);
  if (!user) throw new Error('目标用户已不存在，请刷新列表。');
  return user;
}

export function UsersPage() {
  const navigate = useNavigate();
  const { client, status, userInfo } = useGatewayData();
  const [messageApi, messageContextHolder] = message.useMessage();
  const [modal, modalContextHolder] = Modal.useModal();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [sessionCounts, setSessionCounts] = useState<UserSessionCounts>({});
  const [sessionsKnown, setSessionsKnown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string>();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<UserFilter>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingUser, setDeletingUser] = useState<ManagedUser>();
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const requestSequence = useRef(0);
  const connected = Boolean(client && status === 'connected');

  const loadUsers = useCallback(async (): Promise<ManagedUser[] | undefined> => {
    if (!client || status !== 'connected') return undefined;
    const sequence = ++requestSequence.current;
    setLoading(true);
    setListError(undefined);
    try {
      const [result, sessionResult] = await Promise.all([
        client.users.list(),
        client.users.listSessionCounts().catch(() => undefined),
      ]);
      if (sequence === requestSequence.current) {
        setUsers(result);
        setSessionCounts(sessionResult ?? {});
        setSessionsKnown(sessionResult !== undefined);
      }
      return result;
    } catch (error) {
      if (sequence === requestSequence.current) setListError(errorMessage(error));
      return undefined;
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [client, status]);

  useEffect(() => {
    if (status === 'connected') void loadUsers();
    return () => {
      requestSequence.current += 1;
    };
  }, [loadUsers, status]);

  const filteredUsers = useMemo(
    () => filterManagedUsers(users, query, filter),
    [filter, query, users],
  );

  const refreshAfterMutation = async (successMessage: string, uncertainMessage?: string) => {
    const refreshed = await loadUsers();
    if (!refreshed) {
      void messageApi.warning(uncertainMessage ?? `${successMessage}，但列表刷新失败。`);
      return false;
    }
    void messageApi.success(successMessage);
    return true;
  };

  const createUser = async (values: UserCreateOptions) => {
    if (!client || status !== 'connected') return;
    setSubmitting(true);
    try {
      await client.users.create(values);
      const refreshed = await refreshAfterMutation(
        `已创建用户「${values.username}」`,
        '用户可能已创建，但列表刷新失败。请先刷新列表，不要重复提交。',
      );
      if (refreshed) setCreateOpen(false);
    } catch (error) {
      void messageApi.error(`创建用户失败：${errorMessage(error)}`);
      throw error;
    } finally {
      setSubmitting(false);
    }
  };

  const confirmLockChange = (target: ManagedUser) => {
    if (!client || status !== 'connected') return;
    const locking = !target.locked;
    modal.confirm({
      title: locking ? '禁用用户' : '启用用户',
      content: locking
        ? `确定要禁用用户「${target.name}」吗？当前版本尚未确认禁用是否会立即终止已有会话。`
        : `确定要启用用户「${target.name}」吗？`,
      okText: locking ? '禁用用户' : '启用用户',
      cancelText: '取消',
      okButtonProps: { danger: locking },
      onOk: async () => {
        const latestUsers = await client.users.list();
        const latest = findLatestUser(latestUsers, target.id);
        if (isCurrentUser(latest, userInfo?.id)) throw new Error('不能禁用或启用当前登录用户。');
        if (locking && isLastActiveAdministrator(latest, latestUsers)) {
          throw new Error('不能禁用最后一个可登录的全站管理员。');
        }
        try {
          await client.users.setLocked(latest.id, locking, latest.siteRights);
          await refreshAfterMutation(
            locking ? `账户「${latest.name}」已禁用` : `账户「${latest.name}」已启用`,
            locking ? '账户禁用请求已成功，但列表刷新失败，活动会话状态也尚未确认。' : undefined,
          );
        } catch (error) {
          void messageApi.error(`${locking ? '禁用' : '启用'}用户失败：${errorMessage(error)}`);
          throw error;
        }
      },
    });
  };

  const openDelete = (target: ManagedUser) => {
    if (isCurrentUser(target, userInfo?.id)) {
      void messageApi.error('不能删除当前登录用户。');
      return;
    }
    if (isLastActiveAdministrator(target, users)) {
      void messageApi.error('不能删除最后一个可登录的全站管理员。');
      return;
    }
    setDeleteConfirmation('');
    setDeletingUser(target);
  };

  const deleteUser = async () => {
    if (!client || status !== 'connected' || !deletingUser) return;
    setSubmitting(true);
    try {
      const latestUsers = await client.users.list();
      const latest = findLatestUser(latestUsers, deletingUser.id);
      if (isCurrentUser(latest, userInfo?.id)) throw new Error('不能删除当前登录用户。');
      if (isLastActiveAdministrator(latest, latestUsers)) {
        throw new Error('不能删除最后一个可登录的全站管理员。');
      }
      await client.users.remove(latest.id, latest.name);
      const refreshed = await refreshAfterMutation(`已删除用户「${latest.name}」`);
      if (refreshed) setDeletingUser(undefined);
    } catch (error) {
      void messageApi.error(`删除用户失败：${errorMessage(error)}`);
    } finally {
      setSubmitting(false);
    }
  };

  const columns: TableColumnsType<ManagedUser> = [
    {
      title: '用户',
      key: 'user',
      fixed: 'left',
      width: 250,
      render: (_, user) => (
        <button className="user-identity" onClick={() => navigate(`/admin/users/${encodeURIComponent(user.id)}`)}>
          <span className="user-identity-icon">
            <UserOutlined />
          </span>
          <span>
            <strong>{user.name}</strong>
            <small>{user.realName || user.email || user.id}</small>
          </span>
        </button>
      ),
    },
    {
      title: '状态',
      key: 'status',
      width: 190,
      render: (_, user) => (
        <Space size={[4, 4]} wrap>
          <Tag color={user.locked ? 'error' : 'success'}>{user.locked ? '已锁定' : '正常'}</Tag>
          {user.resetNextLogin ? <Tag color="warning">待修改密码</Tag> : null}
        </Space>
      ),
    },
    {
      title: '账户类型',
      key: 'type',
      width: 130,
      render: (_, user) =>
        isFullAdministrator(user.siteRights) ? <Tag color="blue">全站管理员</Tag> : '普通用户',
    },
    {
      title: '当前在线',
      key: 'online',
      width: 140,
      render: (_, user) => {
        if (!sessionsKnown) return <Tag>未知</Tag>;
        const count = sessionCounts[user.id] ?? 0;
        return count > 0 ? <Tag color="success">在线 · {count}</Tag> : <Tag>离线</Tag>;
      },
    },
    {
      title: '最近登录',
      dataIndex: 'lastLoginAt',
      width: 180,
      render: (value?: string) => formatDateTime(value, '从未登录'),
    },
    {
      title: '最近访问',
      dataIndex: 'lastAccessAt',
      width: 180,
      render: (value?: string) => formatDateTime(value),
    },
    {
      title: '操作',
      key: 'actions',
      fixed: 'right',
      width: 275,
      render: (_, user) => {
        const current = isCurrentUser(user, userInfo?.id);
        const protectsAdmin = isLastActiveAdministrator(user, users);
        return (
          <Space size="small">
            <Button type="link" size="small" onClick={() => navigate(`/admin/users/${encodeURIComponent(user.id)}`)}>
              查看
            </Button>
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              disabled={!connected}
              onClick={() => navigate(`/admin/users/${encodeURIComponent(user.id)}`)}
            >
              编辑
            </Button>
            <Button
              type="link"
              size="small"
              danger={!user.locked}
              icon={user.locked ? <UnlockOutlined /> : <LockOutlined />}
              disabled={!connected || current || (!user.locked && protectsAdmin)}
              onClick={() => confirmLockChange(user)}
            >
              {user.locked ? '启用' : '禁用'}
            </Button>
            <Button
              type="link"
              danger
              size="small"
              icon={<DeleteOutlined />}
              disabled={!connected || current || protectsAdmin}
              onClick={() => openDelete(user)}
            >
              删除
            </Button>
          </Space>
        );
      },
    },
  ];

  return (
    <div className="page-stack users-page">
      {messageContextHolder}
      {modalContextHolder}
      <div className="page-heading">
        <div>
          <h1>用户管理</h1>
          <p>管理 MeshCentral 本地用户及账户锁定状态</p>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          disabled={!connected}
          onClick={() => setCreateOpen(true)}
        >
          创建用户
        </Button>
      </div>

      {!connected ? (
        <Alert
          type="warning"
          showIcon
          message="业务网关未连接"
          description="当前保留最近一次加载的数据供查看，所有写操作已禁用。重新连接后将自动刷新。"
        />
      ) : null}
      {listError ? (
        <Alert
          type="error"
          showIcon
          message="用户列表加载失败"
          description={listError}
          action={
            <Button size="small" onClick={() => void loadUsers()}>
              重新加载
            </Button>
          }
        />
      ) : null}

      <section className="console-card devices-table-card">
        <div className="table-toolbar users-toolbar">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            prefix={<SearchOutlined />}
            placeholder="搜索用户名、真实姓名或邮箱"
            allowClear
          />
          <Select<UserFilter>
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: '全部用户' },
              { value: 'active', label: '正常' },
              { value: 'locked', label: '锁定' },
              { value: 'administrator', label: '全站管理员' },
              { value: 'reset-required', label: '待修改密码' },
            ]}
          />
          <div className="toolbar-spacer" />
          <Tag>
            {filteredUsers.length} / {users.length} 个用户
          </Tag>
          <Button
            icon={<ReloadOutlined />}
            disabled={!connected}
            loading={loading}
            onClick={() => void loadUsers()}
          >
            刷新
          </Button>
        </div>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredUsers}
          loading={loading && users.length === 0}
          pagination={{
            defaultPageSize: 20,
            showSizeChanger: true,
            pageSizeOptions: [20, 50, 100],
            showTotal: (total) => `共 ${total} 个用户`,
          }}
          scroll={{ x: 1345 }}
          locale={{
            emptyText: (
              <Empty description={users.length ? '没有符合筛选条件的用户' : '暂无用户数据'} />
            ),
          }}
        />
      </section>

      <UserCreateModal
        open={createOpen}
        submitting={submitting}
        onCancel={() => setCreateOpen(false)}
        onSubmit={createUser}
      />
      <Modal
        title="删除用户"
        open={Boolean(deletingUser)}
        onCancel={() => setDeletingUser(undefined)}
        onOk={() => void deleteUser()}
        okText="永久删除"
        cancelText="取消"
        okButtonProps={{
          danger: true,
          disabled: deleteConfirmation !== deletingUser?.name,
        }}
        confirmLoading={submitting}
        destroyOnHidden
      >
        <p>
          用户「{deletingUser?.name}」将被永久删除，此操作无法通过前端撤销。最近登录：
          {formatDateTime(deletingUser?.lastLoginAt, '从未登录')}。
        </p>
        <p>请输入用户名以确认删除：</p>
        <Input
          value={deleteConfirmation}
          onChange={(event) => setDeleteConfirmation(event.target.value)}
          placeholder={deletingUser?.name}
          autoComplete="off"
        />
      </Modal>
    </div>
  );
}
