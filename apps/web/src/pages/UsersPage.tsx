import {
  DeleteOutlined,
  LockOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  UnlockOutlined,
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
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { UserCreateModal } from '../components/users/UserCreateModal';
import { UserAvatar } from '../components/users/UserAvatar';
import { filterManagedUsers, type UserFilter } from '../features/users/userFilters';
import { isCurrentUser, isLastActiveAdministrator } from '../features/users/userProtection';
import { useGatewayData } from '../features/gateway/useGatewayData';
import { useFormatters } from '../i18n';
import '../assets/styles/users.css';

export function UsersPage() {
  const { t } = useTranslation();
  const formatters = useFormatters();
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

  const formatDateTime = useCallback(
    (value?: string, missing?: string) => {
      if (!value) return missing ?? '—';
      return formatters.dateTime(value) || (missing ?? '—');
    },
    [formatters],
  );

  const findLatestUser = useCallback(
    (userList: ManagedUser[], userId: string): ManagedUser => {
      const user = userList.find((item) => item.id === userId);
      if (!user) throw new Error(t('users.messages.targetUserNotFound'));
      return user;
    },
    [t],
  );

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
      if (sequence === requestSequence.current) {
        setListError(error instanceof Error ? error.message : t('common.status.unknown'));
      }
      return undefined;
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [client, status, t]);

  useEffect(() => {
    if (status === 'connected') void loadUsers();
    return () => {
      requestSequence.current += 1;
    };
  }, [loadUsers, status]);

  const filteredUsers = useMemo(
    () => filterManagedUsers(users, query, filter, formatters.language),
    [filter, formatters.language, query, users],
  );

  const refreshAfterMutation = async (successMessage: string, uncertainMessage?: string) => {
    const refreshed = await loadUsers();
    if (!refreshed) {
      void messageApi.warning(uncertainMessage ?? t('userDetails.partialRefreshFailed', { successMessage }));
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
        t('users.messages.createSuccess', { username: values.username }),
        t('users.messages.createUncertain'),
      );
      if (refreshed) setCreateOpen(false);
    } catch (error) {
      const detail = error instanceof Error ? error.message : t('common.status.unknown');
      void messageApi.error(t('users.messages.createFailed', { detail }));
      throw error;
    } finally {
      setSubmitting(false);
    }
  };

  const confirmLockChange = (target: ManagedUser) => {
    if (!client || status !== 'connected') return;
    const locking = !target.locked;
    modal.confirm({
      title: locking ? t('users.confirm.lockTitle') : t('users.confirm.unlockTitle'),
      content: locking
        ? t('users.confirm.lockContent', { name: target.name })
        : t('users.confirm.unlockContent', { name: target.name }),
      okText: locking ? t('common.actions.disable') : t('common.actions.enable'),
      cancelText: t('common.actions.cancel'),
      okButtonProps: { danger: locking },
      onOk: async () => {
        const latestUsers = await client.users.list();
        const latest = findLatestUser(latestUsers, target.id);
        if (isCurrentUser(latest, userInfo?.id)) {
          throw new Error(t('users.messages.cannotModifySelf'));
        }
        if (locking && isLastActiveAdministrator(latest, latestUsers)) {
          throw new Error(t('users.messages.cannotLockLastAdmin'));
        }
        try {
          await client.users.setLocked(latest.id, locking, latest.siteRights);
          await refreshAfterMutation(
            locking
              ? t('users.messages.lockSuccess', { name: latest.name })
              : t('users.messages.unlockSuccess', { name: latest.name }),
            locking ? t('users.messages.lockUncertain') : undefined,
          );
        } catch (error) {
          const detail = error instanceof Error ? error.message : t('common.status.unknown');
          void messageApi.error(
            t('users.messages.lockFailed', {
              action: locking ? t('common.actions.disable') : t('common.actions.enable'),
              detail,
            }),
          );
          throw error;
        }
      },
    });
  };

  const openDelete = (target: ManagedUser) => {
    if (isCurrentUser(target, userInfo?.id)) {
      void messageApi.error(t('users.messages.cannotDeleteSelf'));
      return;
    }
    if (isLastActiveAdministrator(target, users)) {
      void messageApi.error(t('users.messages.cannotDeleteLastAdmin'));
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
      if (isCurrentUser(latest, userInfo?.id)) {
        throw new Error(t('users.messages.cannotDeleteSelf'));
      }
      if (isLastActiveAdministrator(latest, latestUsers)) {
        throw new Error(t('users.messages.cannotDeleteLastAdmin'));
      }
      await client.users.remove(latest.id, latest.name);
      const refreshed = await refreshAfterMutation(
        t('users.messages.deleteSuccess', { name: latest.name }),
      );
      if (refreshed) setDeletingUser(undefined);
    } catch (error) {
      const detail = error instanceof Error ? error.message : t('common.status.unknown');
      void messageApi.error(t('users.messages.deleteFailed', { detail }));
    } finally {
      setSubmitting(false);
    }
  };

  const openUserDetails = (user: ManagedUser) => {
    navigate(`/admin/users/${encodeURIComponent(user.id)}`);
  };

  const isInteractiveTarget = (target: EventTarget | null) =>
    target instanceof Element && Boolean(target.closest('button, a, input, select, textarea, [role="button"]'));

  const columns: TableColumnsType<ManagedUser> = [
    {
      title: t('users.columns.user'),
      key: 'user',
      fixed: 'left',
      width: 250,
      render: (_, user) => (
        <div className="user-identity">
          <UserAvatar
            className="user-identity-icon"
            username={user.name}
            src={user.image}
            hasImage={Boolean(user.image || user.hasImage)}
          />
          <span>
            <strong>{user.name}</strong>
            <small>{user.realName || user.email || user.id}</small>
          </span>
        </div>
      ),
    },
    {
      title: t('users.columns.status'),
      key: 'status',
      width: 190,
      render: (_, user) => (
        <Space size={[4, 4]} wrap>
          <Tag color={user.locked ? 'error' : 'success'}>
            {user.locked ? t('users.status.locked') : t('users.status.active')}
          </Tag>
          {user.resetNextLogin ? <Tag color="warning">{t('users.status.resetRequired')}</Tag> : null}
        </Space>
      ),
    },
    {
      title: t('users.columns.type'),
      key: 'type',
      width: 130,
      render: (_, user) =>
        isFullAdministrator(user.siteRights) ? (
          <Tag color="blue">{t('users.status.siteAdmin')}</Tag>
        ) : (
          t('users.status.standardUser')
        ),
    },
    {
      title: t('users.columns.online'),
      key: 'online',
      width: 140,
      render: (_, user) => {
        if (!sessionsKnown) return <Tag>{t('users.status.unknown')}</Tag>;
        const count = sessionCounts[user.id] ?? 0;
        return count > 0 ? (
          <Tag color="success">{t('users.status.onlineWithCount', { count })}</Tag>
        ) : (
          <Tag>{t('common.status.offline')}</Tag>
        );
      },
    },
    {
      title: t('users.columns.lastLoginAt'),
      dataIndex: 'lastLoginAt',
      width: 180,
      render: (value?: string) => formatDateTime(value, t('users.status.neverLoggedIn')),
    },
    {
      title: t('users.columns.lastAccessAt'),
      dataIndex: 'lastAccessAt',
      width: 180,
      render: (value?: string) => formatDateTime(value),
    },
    {
      title: t('users.columns.actions'),
      key: 'actions',
      fixed: 'right',
      width: 190,
      render: (_, user) => {
        const current = isCurrentUser(user, userInfo?.id);
        const protectsAdmin = isLastActiveAdministrator(user, users);
        return (
          <Space size="small">
            <Button
              type="link"
              size="small"
              danger={!user.locked}
              icon={user.locked ? <UnlockOutlined /> : <LockOutlined />}
              disabled={!connected || current || (!user.locked && protectsAdmin)}
              onClick={() => confirmLockChange(user)}
            >
              {user.locked ? t('common.actions.enable') : t('common.actions.disable')}
            </Button>
            <Button
              type="link"
              danger
              size="small"
              icon={<DeleteOutlined />}
              disabled={!connected || current || protectsAdmin}
              onClick={() => openDelete(user)}
            >
              {t('common.actions.delete')}
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
          <h1>{t('users.title')}</h1>
          <p>{t('users.subtitle')}</p>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          disabled={!connected}
          onClick={() => setCreateOpen(true)}
        >
          {t('users.createUser')}
        </Button>
      </div>

      {!connected ? (
        <Alert
          type="warning"
          showIcon
          title={t('header.gatewayDisconnected')}
          description={t('users.gatewayDisconnectedNotice')}
        />
      ) : null}
      {listError ? (
        <Alert
          type="error"
          showIcon
          title={t('users.loadFailed')}
          description={listError}
          action={
            <Button size="small" onClick={() => void loadUsers()}>
              {t('users.reload')}
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
            placeholder={t('users.searchPlaceholder')}
            allowClear
          />
          <Select<UserFilter>
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: t('users.filters.all') },
              { value: 'active', label: t('users.filters.active') },
              { value: 'locked', label: t('users.filters.locked') },
              { value: 'administrator', label: t('users.filters.administrator') },
              { value: 'reset-required', label: t('users.filters.resetRequired') },
            ]}
          />
          <div className="toolbar-spacer" />
          <Tag>
            {t('users.countTag', { filtered: filteredUsers.length, total: users.length })}
          </Tag>
          <Button
            icon={<ReloadOutlined />}
            disabled={!connected}
            loading={loading}
            onClick={() => void loadUsers()}
          >
            {t('common.actions.refresh')}
          </Button>
        </div>
        <Table
          className="users-table"
          rowKey="id"
          columns={columns}
          dataSource={filteredUsers}
          onRow={(user) => ({
            tabIndex: 0,
            onClick: (event) => {
              if (!isInteractiveTarget(event.target)) openUserDetails(user);
            },
            onKeyDown: (event) => {
              if (!isInteractiveTarget(event.target) && (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault();
                openUserDetails(user);
              }
            },
          })}
          loading={loading && users.length === 0}
          pagination={{
            defaultPageSize: 20,
            showSizeChanger: true,
            pageSizeOptions: [20, 50, 100],
            showTotal: (total) => t('users.totalCount', { count: total }),
          }}
          scroll={{ x: 1260 }}
          locale={{
            emptyText: (
              <Empty description={users.length ? t('users.empty.filtered') : t('users.empty.waiting')} />
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
        title={t('users.confirm.deleteTitle')}
        open={Boolean(deletingUser)}
        onCancel={() => setDeletingUser(undefined)}
        onOk={() => void deleteUser()}
        okText={t('users.confirm.deleteOk')}
        cancelText={t('common.actions.cancel')}
        okButtonProps={{
          danger: true,
          disabled: deleteConfirmation !== deletingUser?.name,
        }}
        confirmLoading={submitting}
        destroyOnHidden
      >
        <p>
          {t('users.confirm.deleteNotice', {
            name: deletingUser?.name,
            lastLogin: formatDateTime(deletingUser?.lastLoginAt, t('users.status.neverLoggedIn')),
          })}
        </p>
        <p>{t('users.confirm.deleteInputTip')}</p>
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
