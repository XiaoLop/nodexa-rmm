import {
  ApartmentOutlined,
  AuditOutlined,
  ClockCircleFilled,
  DeleteOutlined,
  DesktopOutlined,
  EditOutlined,
  PlusOutlined,
  LaptopOutlined,
  MailOutlined,
  SafetyCertificateFilled,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type {
  Device,
  DeviceGroup,
  GatewayEvent,
  ManagedUser,
  UserGroup,
  UserLink,
} from '@meshcentral/control-client';
import { formatEventMessage, getEventTargetName } from '@meshcentral/shared-state';
import { Alert, Button, Empty, Modal, Space, Spin, Tag, Tooltip, message } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DeviceGroupPermissionModal } from '../components/users/DeviceGroupPermissionModal';
import { useGatewayData } from '../features/gateway/useGatewayData';
import { summarizeMeshRights } from '../features/users/meshPermissions';
import { isCurrentUser } from '../features/users/userProtection';

type DetailTab = 'overview' | 'device-groups' | 'user-groups' | 'shared-devices' | 'logs';

type AccessRow = {
  id: string;
  name: string;
  permission: string;
  rights: number;
};

const tabs: Array<{ key: DetailTab; label: string; icon: ReactNode }> = [
  { key: 'overview', label: '概览', icon: <LaptopOutlined /> },
  { key: 'device-groups', label: '设备组', icon: <ApartmentOutlined /> },
  { key: 'user-groups', label: '用户组', icon: <TeamOutlined /> },
  { key: 'shared-devices', label: '共用设备', icon: <DesktopOutlined /> },
  { key: 'logs', label: '操作日志', icon: <AuditOutlined /> },
];

const eventTypeLabels: Record<GatewayEvent['type'], string> = {
  deviceOnline: '设备上线',
  deviceOffline: '设备离线',
  deviceChanged: '设备变更',
  deviceRemoved: '设备移除',
  relayLog: '远程连接',
  agentLog: '代理日志',
  manualOperation: '手动操作',
  commandExecution: '命令执行',
  batchUpload: '批量上传',
  userSessionCount: '会话变更',
  unknown: '其他',
};

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

function permissionLabel(rights: number): string {
  return summarizeMeshRights(rights);
}

function resolveAccessRows<T extends { id: string; name: string }>(
  links: UserLink[],
  type: UserLink['type'],
  resources: T[],
): AccessRow[] {
  const names = new Map(resources.map((resource) => [resource.id, resource.name]));
  return links
    .filter((link) => link.type === type)
    .map((link) => ({
      id: link.id,
      name: names.get(link.id) ?? link.id,
      permission: permissionLabel(link.rights),
      rights: link.rights,
    }));
}

function SummaryCard({ icon, title, value, tone }: { icon: ReactNode; title: string; value: number; tone: string }) {
  return (
    <article className="user-detail-summary-card">
      <span className={`user-detail-summary-icon ${tone}`}>{icon}</span>
      <span><small>{title}</small><strong>{value}</strong></span>
    </article>
  );
}

function AccessCard({
  icon,
  title,
  rows,
  tone,
  constrained = false,
  editable = false,
  onAdd,
  onEdit,
  onRemove,
  addDisabled = false,
  editDisabled = false,
}: {
  icon: ReactNode;
  title: string;
  rows: AccessRow[];
  tone: string;
  constrained?: boolean;
  editable?: boolean;
  onAdd?: () => void;
  onEdit?: (row: AccessRow) => void;
  onRemove?: (row: AccessRow) => void;
  addDisabled?: boolean;
  editDisabled?: boolean;
}) {
  return (
    <article className={`user-detail-access-card${constrained ? ' constrained' : ''}`}>
      <header>
        <h2><span className={tone}>{icon}</span>{title}</h2>
        {editable ? <Button type="link" size="small" icon={<PlusOutlined />} disabled={addDisabled} onClick={onAdd}>添加</Button> : <span>{rows.length} 项</span>}
      </header>
      <div className={`user-detail-access-head${editable ? ' editable' : ''}`}><span>名称</span><span>权限</span>{editable ? <span>操作</span> : null}</div>
      <div className="user-detail-access-body">
        {rows.length ? rows.map((row) => (
          <div className={`user-detail-access-row${editable ? ' editable' : ''}`} key={row.id}>
            <span>{row.name}</span><span>{row.permission}</span>
            {editable ? (
              <Space size={0}>
                <Tooltip title={editDisabled ? '不能修改当前登录用户的设备组权限。' : undefined}>
                  <Button type="link" size="small" icon={<EditOutlined />} disabled={editDisabled} onClick={() => onEdit?.(row)}>编辑</Button>
                </Tooltip>
                <Tooltip title={editDisabled ? '不能移除当前登录用户的设备组。' : undefined}>
                  <Button type="link" danger size="small" icon={<DeleteOutlined />} disabled={editDisabled} onClick={() => onRemove?.(row)}>移除</Button>
                </Tooltip>
              </Space>
            ) : null}
          </div>
        )) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={`暂无${title}`} />}
      </div>
    </article>
  );
}

function EventTable({ events, devices, groups }: { events: GatewayEvent[]; devices: Device[]; groups: DeviceGroup[] }) {
  return (
    <section className="user-detail-log-card">
      <h2><ClockCircleFilled /> 最近操作日志</h2>
      {events.length ? (
        <div className="user-detail-log-table">
          <div className="user-detail-log-head"><span>时间</span><span>操作类型</span><span>操作内容</span><span>设备/资源</span><span>IP 地址</span></div>
          {events.map((event) => (
            <div className="user-detail-log-row" key={event.id}>
              <span>{formatDateTime(event.occurredAt)}</span>
              <span><Tag>{eventTypeLabels[event.type]}</Tag></span>
              <span>{formatEventMessage(event, devices, groups)}</span>
              <span>{getEventTargetName(event, devices) || event.deviceId || '—'}</span>
              <span>{event.ip || '—'}</span>
            </div>
          ))}
        </div>
      ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无操作日志" />}
    </section>
  );
}

export function UserDetailsPage() {
  const navigate = useNavigate();
  const { userId } = useParams<{ userId: string }>();
  const { client, status, devices, groups: gatewayGroups, userInfo } = useGatewayData();
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [user, setUser] = useState<ManagedUser>();
  const [userGroups, setUserGroups] = useState<UserGroup[]>([]);
  const [events, setEvents] = useState<GatewayEvent[]>([]);
  const [sessionCount, setSessionCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string>();
  const [permissionEditor, setPermissionEditor] = useState<{ groupId: string; rights: number } | 'new'>();
  const [permissionSubmitting, setPermissionSubmitting] = useState(false);
  const [messageApi, messageContextHolder] = message.useMessage();
  const [modalApi, modalContextHolder] = Modal.useModal();
  const requestSequence = useRef(0);

  const loadDetails = useCallback(async () => {
    if (!client || status !== 'connected' || !userId) return;
    const sequence = ++requestSequence.current;
    setLoading(true);
    setLoadError(undefined);
    try {
      const [users, availableUserGroups, sessionCounts, userEvents] = await Promise.all([
        client.users.list(),
        client.userGroups.list().catch(() => []),
        client.users.listSessionCounts().catch(() => ({}) as Record<string, number>),
        client.events.listByUser(userId, { limit: 60 }),
      ]);
      if (sequence !== requestSequence.current) return;
      const selectedUser = users.find((item) => item.id === userId);
      if (!selectedUser) throw new Error('目标用户不存在或已被删除。');
      setUser(selectedUser);
      setUserGroups(availableUserGroups);
      setSessionCount(sessionCounts[userId] ?? 0);
      setEvents(userEvents);
    } catch (error) {
      if (sequence === requestSequence.current) setLoadError(errorMessage(error));
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [client, status, userId]);

  useEffect(() => {
    void loadDetails();
    return () => { requestSequence.current += 1; };
  }, [loadDetails]);

  const availableGroups = gatewayGroups;
  const deviceGroupRows = useMemo(
    () => resolveAccessRows(user?.links ?? [], 'device-group', availableGroups),
    [availableGroups, user],
  );
  const userGroupRows = useMemo(
    () => resolveAccessRows(user?.links ?? [], 'user-group', userGroups),
    [user, userGroups],
  );
  const sharedDeviceRows = useMemo(
    () => resolveAccessRows(user?.links ?? [], 'device', devices),
    [devices, user],
  );
  const online = sessionCount > 0;
  const isViewingCurrentUser = Boolean(user && isCurrentUser(user, userInfo?.id));
  const deviceGroupManagementDisabled = status !== 'connected' || isViewingCurrentUser;

  useEffect(() => {
    if (isViewingCurrentUser) setPermissionEditor(undefined);
  }, [isViewingCurrentUser]);

  const saveDeviceGroupPermission = async ({ groupId, rights }: { groupId: string; rights: number }) => {
    if (!client || !user) return;
    if (isCurrentUser(user, userInfo?.id)) {
      setPermissionEditor(undefined);
      void messageApi.error('不能修改当前登录用户的设备组权限。');
      return;
    }
    const group = availableGroups.find((item) => item.id === groupId);
    if (!group) {
      void messageApi.error('目标设备组不存在或已被删除。');
      return;
    }
    setPermissionSubmitting(true);
    try {
      await client.groups.setUserRights(group.id, group.name, user.id, rights);
      await loadDetails();
      void messageApi.success(permissionEditor === 'new' ? `已添加设备组「${group.name}」` : `已更新「${group.name}」的权限`);
      setPermissionEditor(undefined);
    } catch (error) {
      void messageApi.error(`保存设备组权限失败：${errorMessage(error)}`);
    } finally {
      setPermissionSubmitting(false);
    }
  };

  const confirmDeviceGroupRemoval = (row: AccessRow) => {
    if (!client || !user) return;
    if (isCurrentUser(user, userInfo?.id)) {
      setPermissionEditor(undefined);
      void messageApi.error('不能移除当前登录用户的设备组。');
      return;
    }
    modalApi.confirm({
      title: '移除设备组权限',
      content: `确定移除用户「${user.name}」对设备组「${row.name}」的直接权限吗？用户仍可能通过用户组继承访问权限。`,
      okText: '确认移除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await client.groups.removeUser(row.id, user.id);
          await loadDetails();
          void messageApi.success(`已移除设备组「${row.name}」`);
        } catch (error) {
          void messageApi.error(`移除设备组权限失败：${errorMessage(error)}`);
          throw error;
        }
      },
    });
  };

  if (!user && loading) {
    return <main className="user-details-page user-detail-placeholder"><Spin size="large" /><p>正在加载用户详情</p></main>;
  }

  if (!user && (loadError || status !== 'connected')) {
    return (
      <main className="user-details-page page-stack">
        <nav className="user-detail-breadcrumb" aria-label="面包屑">
          <button onClick={() => navigate('/admin/users')}>用户管理</button><span>›</span><strong>用户详情</strong>
        </nav>
        <Alert
          showIcon
          type="error"
          message="用户详情加载失败"
          description={loadError ?? '网关尚未连接。'}
          action={<Button onClick={() => void loadDetails()} disabled={status !== 'connected'}>重试</Button>}
        />
      </main>
    );
  }

  if (!user) return null;

  const activeTitle = tabs.find((tab) => tab.key === activeTab)?.label;

  return (
    <main className="user-details-page page-stack">
      {messageContextHolder}
      {modalContextHolder}
      <nav className="user-detail-breadcrumb" aria-label="面包屑">
        <button onClick={() => navigate('/admin/users')}>用户管理</button><span>›</span><strong>{user.name}</strong>
      </nav>

      {loadError ? <Alert showIcon type="warning" message="部分数据刷新失败" description={loadError} /> : null}

      <section className="user-detail-hero">
        <div className="user-detail-profile">
          <span className="user-detail-avatar"><UserOutlined /></span>
          <div className="user-detail-name">
            <div><h1>{user.name}</h1><Tag color={user.locked ? 'error' : online ? 'success' : 'default'}>{user.locked ? '已锁定' : online ? '在线' : '离线'}</Tag></div>
            <p>{user.realName || '未提供真实姓名'}</p>
            <small><MailOutlined /> {user.email || '未提供邮箱'}</small>
          </div>
        </div>

        <dl className="user-detail-meta">
          <div><dt><UserOutlined /> 用户 ID</dt><dd>{user.id}</dd></div>
          <div><dt><ClockCircleFilled /> 创建时间</dt><dd>{formatDateTime(user.createdAt)}</dd></div>
          <div><dt><ClockCircleFilled /> 最近登录</dt><dd>{formatDateTime(user.lastLoginAt, '从未登录')}</dd></div>
          <div><dt><ClockCircleFilled /> 最近访问</dt><dd>{formatDateTime(user.lastAccessAt)}</dd></div>
          <div><dt><ClockCircleFilled /> 密码修改</dt><dd>{formatDateTime(user.passwordChangedAt)}</dd></div>
        </dl>

        <div className="user-detail-sessions">
          <span><SafetyCertificateFilled /></span>
          <div><strong>{sessionCount} 个活跃会话</strong><small>{online ? '该用户当前在线' : '该用户当前离线'}</small></div>
        </div>
      </section>

      <nav className="user-detail-tabs">
        {tabs.map((tab) => (
          <button key={tab.key} className={activeTab === tab.key ? 'active' : ''} onClick={() => setActiveTab(tab.key)}>
            {tab.icon}<span>{tab.label}</span>
          </button>
        ))}
      </nav>

      {activeTab === 'overview' ? (
        <>
          <section className="user-detail-summary-grid">
            <SummaryCard icon={<ApartmentOutlined />} title="设备组" value={deviceGroupRows.length} tone="blue" />
            <SummaryCard icon={<TeamOutlined />} title="用户组" value={userGroupRows.length} tone="purple" />
            <SummaryCard icon={<DesktopOutlined />} title="共用设备" value={sharedDeviceRows.length} tone="green" />
          </section>
          <section className="user-detail-access-grid">
            <AccessCard constrained icon={<ApartmentOutlined />} title="设备组" rows={deviceGroupRows} tone="blue-text" />
            <AccessCard constrained icon={<TeamOutlined />} title="用户组" rows={userGroupRows} tone="purple-text" />
            <AccessCard constrained icon={<DesktopOutlined />} title="共用设备" rows={sharedDeviceRows} tone="blue-text" />
          </section>
          <EventTable events={events.slice(0, 10)} devices={devices} groups={availableGroups} />
        </>
      ) : activeTab === 'logs' ? (
        <EventTable events={events} devices={devices} groups={availableGroups} />
      ) : activeTab === 'device-groups' ? (
        <AccessCard
          editable
          icon={<ApartmentOutlined />}
          title={activeTitle ?? '设备组'}
          rows={deviceGroupRows}
          tone="blue-text"
          addDisabled={deviceGroupManagementDisabled}
          editDisabled={deviceGroupManagementDisabled}
          onAdd={() => {
            if (!deviceGroupManagementDisabled) setPermissionEditor('new');
          }}
          onEdit={(row) => {
            if (!deviceGroupManagementDisabled) setPermissionEditor({ groupId: row.id, rights: row.rights });
          }}
          onRemove={confirmDeviceGroupRemoval}
        />
      ) : activeTab === 'user-groups' ? (
        <AccessCard icon={<TeamOutlined />} title={activeTitle ?? '用户组'} rows={userGroupRows} tone="purple-text" />
      ) : (
        <AccessCard icon={<DesktopOutlined />} title={activeTitle ?? '共用设备'} rows={sharedDeviceRows} tone="blue-text" />
      )}

      <DeviceGroupPermissionModal
        open={Boolean(permissionEditor) && !deviceGroupManagementDisabled}
        groups={availableGroups}
        currentGroupIds={deviceGroupRows.map((row) => row.id)}
        editing={permissionEditor && permissionEditor !== 'new' ? permissionEditor : undefined}
        submitting={permissionSubmitting}
        onCancel={() => setPermissionEditor(undefined)}
        onSubmit={saveDeviceGroupPermission}
      />
    </main>
  );
}
