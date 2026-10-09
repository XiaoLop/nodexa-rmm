import {
  ApartmentOutlined,
  ApiOutlined,
  AuditOutlined,
  ClockCircleFilled,
  DeleteOutlined,
  DesktopOutlined,
  EditOutlined,
  IdcardOutlined,
  KeyOutlined,
  LaptopOutlined,
  LockOutlined,
  MailOutlined,
  PlusOutlined,
  SafetyCertificateFilled,
  SafetyCertificateOutlined,
  SettingOutlined,
  TeamOutlined,
  UnlockOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  isFullAdministrator,
  type Device,
  type MeshCentralEvent,
  type ManagedUser,
  type UserGroup,
  type UserLink,
} from '@meshcentral/control-client';
import { getEventTargetName } from '@meshcentral/shared-state';
import { Alert, Button, Empty, Modal, Space, Tag, Tooltip, message } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { eventMessage } from '../features/events/eventPresentation';
import { DeviceGroupPermissionModal } from '../components/users/DeviceGroupPermissionModal';
import { DevicePermissionModal } from '../components/users/DevicePermissionModal';
import { SitePermissionModal } from '../components/users/SitePermissionModal';
import { UserFeatureRestrictionModal } from '../components/users/UserFeatureRestrictionModal';
import { UserAvatar } from '../components/users/UserAvatar';
import {
  UserEditDrawer,
  type UserEditSubmission,
} from '../components/users/UserEditDrawer';
import { useMeshCentralControlData } from '../features/gateway/useMeshCentralControlData';
import { useFormatters } from '../i18n/formatters';
import { summarizeMeshRights } from '../features/users/meshPermissions';
import { preserveLatestAccountLock, summarizeSiteRights } from '../features/users/sitePermissions';
import {
  canChangeSiteRights,
  isCurrentUser,
  isLastActiveAdministrator,
} from '../features/users/userProtection';
import '../assets/styles/user-details.css';

type DetailTab = 'overview' | 'device-groups' | 'user-groups' | 'shared-devices' | 'logs';

type AccessRow = {
  id: string;
  name: string;
  permission: string;
  rights: number;
};

const tabs: Array<{ key: DetailTab; labelKey: string; icon: ReactNode }> = [
  { key: 'overview', labelKey: 'userDetails.tabs.overview', icon: <LaptopOutlined /> },
  { key: 'device-groups', labelKey: 'userDetails.tabs.deviceGroups', icon: <ApartmentOutlined /> },
  { key: 'user-groups', labelKey: 'userDetails.tabs.userGroups', icon: <TeamOutlined /> },
  { key: 'shared-devices', labelKey: 'userDetails.tabs.sharedDevices', icon: <DesktopOutlined /> },
  { key: 'logs', labelKey: 'userDetails.tabs.logs', icon: <AuditOutlined /> },
];

const eventTypeKeys: Record<MeshCentralEvent['type'], string> = {
  deviceOnline: 'userDetails.events.types.deviceOnline',
  deviceOffline: 'userDetails.events.types.deviceOffline',
  deviceChanged: 'userDetails.events.types.deviceChanged',
  deviceRemoved: 'userDetails.events.types.deviceRemoved',
  relayLog: 'userDetails.events.types.relayLog',
  agentLog: 'userDetails.events.types.agentLog',
  manualOperation: 'userDetails.events.types.manualOperation',
  commandExecution: 'userDetails.events.types.commandExecution',
  batchUpload: 'userDetails.events.types.batchUpload',
  userSessionCount: 'userDetails.events.types.userSessionCount',
  unknown: 'userDetails.events.types.unknown',
};

function errorMessage(error: unknown, t: (key: string, options?: Record<string, unknown>) => string): string {
  if (!(error instanceof Error)) return t('userDetails.errors.unknown');
  const serverMessages: Record<string, string> = {
    'Invalid rights': 'userDetails.errors.invalidRights',
    'Access denied': 'userDetails.errors.accessDenied',
    'Invalid user': 'userDetails.errors.invalidUser',
    'Invalid device': 'userDetails.errors.invalidDevice',
  };
  const key = serverMessages[error.message];
  return key ? t(key) : error.message;
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
  disabledReason,
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
  disabledReason?: string;
}) {
  const { t } = useTranslation();
  const resolvedDisabledReason = disabledReason ?? t('userDetails.actions.unavailable');
  return (
    <article className={`user-detail-access-card${constrained ? ' constrained' : ''}`}>
      <header>
        <h2><span className={tone}>{icon}</span>{title}</h2>
        {editable ? <Button type="link" size="small" icon={<PlusOutlined />} disabled={addDisabled} onClick={onAdd}>{t('userDetails.actions.add')}</Button> : <span>{t('userDetails.itemsCount', { count: rows.length })}</span>}
      </header>
      <div className={`user-detail-access-head${editable ? ' editable' : ''}`}><span>{t('userDetails.columns.name')}</span><span>{t('userDetails.columns.permission')}</span>{editable ? <span>{t('userDetails.columns.actions')}</span> : null}</div>
      <div className="user-detail-access-body">
        {rows.length ? rows.map((row) => (
          <div className={`user-detail-access-row${editable ? ' editable' : ''}`} key={row.id}>
            <span>{row.name}</span><span>{row.permission}</span>
            {editable ? (
              <Space size={0}>
                <Tooltip title={editDisabled ? resolvedDisabledReason : undefined}>
                  <Button type="link" size="small" icon={<EditOutlined />} disabled={editDisabled} onClick={() => onEdit?.(row)}>{t('common.actions.edit')}</Button>
                </Tooltip>
                <Tooltip title={editDisabled ? resolvedDisabledReason : undefined}>
                  <Button type="link" danger size="small" icon={<DeleteOutlined />} disabled={editDisabled} onClick={() => onRemove?.(row)}>{t('userDetails.actions.remove')}</Button>
                </Tooltip>
              </Space>
            ) : null}
          </div>
        )) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('userDetails.empty.access', { title })} />}
      </div>
    </article>
  );
}

function EventTable({ events, devices }: { events: MeshCentralEvent[]; devices: Device[] }) {
  const { t } = useTranslation();
  const { dateTime } = useFormatters();
  return (
    <section className="user-detail-log-card">
      <h2><ClockCircleFilled /> {t('userDetails.events.title')}</h2>
      {events.length ? (
        <div className="user-detail-log-table">
          <div className="user-detail-log-head"><span>{t('userDetails.events.time')}</span><span>{t('userDetails.events.type')}</span><span>{t('userDetails.events.content')}</span><span>{t('userDetails.events.resource')}</span><span>{t('userDetails.events.ip')}</span></div>
          {events.map((event) => (
            <div className="user-detail-log-row" key={event.id}>
              <span>{event.occurredAt ? dateTime(event.occurredAt, { second: undefined }) : t('userDetails.missing')}</span>
              <span><Tag>{t(eventTypeKeys[event.type])}</Tag></span>
              <span>{eventMessage(event)}</span>
              <span>{getEventTargetName(event, devices) || event.deviceId || '—'}</span>
              <span>{event.ip || '—'}</span>
            </div>
          ))}
        </div>
      ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('userDetails.events.empty')} />}
    </section>
  );
}

export function UserDetailsPage() {
  const { t } = useTranslation();
  const { dateTime } = useFormatters();
  const navigate = useNavigate();
  const { userId } = useParams<{ userId: string }>();
  const { client, status, devices, groups: gatewayGroups, userInfo } = useMeshCentralControlData();
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [user, setUser] = useState<ManagedUser>();
  const [avatarRefreshKey, setAvatarRefreshKey] = useState(() => Date.now());
  const [userGroups, setUserGroups] = useState<UserGroup[]>([]);
  const [events, setEvents] = useState<MeshCentralEvent[]>([]);
  const [sessionCount, setSessionCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string>();
  const [permissionEditor, setPermissionEditor] = useState<{ groupId: string; rights: number } | 'new'>();
  const [devicePermissionEditor, setDevicePermissionEditor] = useState<
    { deviceId: string; rights: number } | 'new'
  >();
  const [editingProfile, setEditingProfile] = useState(false);
  const [sitePermissionOpen, setSitePermissionOpen] = useState(false);
  const [featureRestrictionOpen, setFeatureRestrictionOpen] = useState(false);
  const [userMutationSubmitting, setUserMutationSubmitting] = useState(false);
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
      if (!selectedUser) throw new Error(t('userDetails.errors.userDeleted'));
      setUser(selectedUser);
      setUserGroups(availableUserGroups);
      setSessionCount(sessionCounts[userId] ?? 0);
      setEvents(userEvents);
    } catch (error) {
      if (sequence === requestSequence.current) setLoadError(errorMessage(error, t));
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [client, status, t, userId]);

  useEffect(() => {
    if (status === 'connected') void loadDetails();
    return () => {
      requestSequence.current += 1;
    };
  }, [loadDetails, status]);

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
    if (isViewingCurrentUser) {
      setPermissionEditor(undefined);
      setDevicePermissionEditor(undefined);
      setSitePermissionOpen(false);
      setFeatureRestrictionOpen(false);
    }
  }, [isViewingCurrentUser]);

  const findLatestUser = async () => {
    if (!client || !user) throw new Error(t('userDetails.errors.dataNotLoaded'));
    const users = await client.users.list();
    const latest = users.find((item) => item.id === user.id);
    if (!latest) throw new Error(t('userDetails.errors.userDeletedReturn'));
    return { latest, users };
  };

  const updateUser = async ({ updates, image }: UserEditSubmission) => {
    if (!client || !user) return;
    if (!Object.keys(updates).length && !image) {
      void messageApi.info(t('userDetails.messages.profileUnchanged'));
      return;
    }
    setUserMutationSubmitting(true);
    try {
      const { latest } = await findLatestUser();
      if (Object.keys(updates).length) await client.users.update(latest.id, updates);
      if (image) client.users.updateImage(latest.id, image);
      await loadDetails();
      if (image) {
        setAvatarRefreshKey(Date.now());
      }
      setEditingProfile(false);
      void messageApi.success(t('userDetails.messages.userUpdated', { name: latest.name }));
    } catch (error) {
      void messageApi.error(t('userDetails.messages.userUpdateFailed', { detail: errorMessage(error, t) }));
      throw error;
    } finally {
      setUserMutationSubmitting(false);
    }
  };

  const saveSitePermissions = async (proposedRights: number) => {
    if (!client || !user) return;
    setUserMutationSubmitting(true);
    try {
      const { latest, users } = await findLatestUser();
      const nextRights = preserveLatestAccountLock(proposedRights, latest.siteRights);
      if (!canChangeSiteRights(latest, users, userInfo?.id, nextRights)) {
        throw new Error(
          isCurrentUser(latest, userInfo?.id)
            ? t('userDetails.errors.cannotEditCurrentPermissions')
            : t('userDetails.errors.cannotRemoveLastAdmin'),
        );
      }
      await client.users.setSiteRights(latest.id, nextRights);
      await loadDetails();
      setSitePermissionOpen(false);
      void messageApi.success(t('userDetails.messages.siteRightsUpdated', { name: latest.name }));
    } catch (error) {
      void messageApi.error(t('userDetails.messages.siteRightsFailed', { detail: errorMessage(error, t) }));
    } finally {
      setUserMutationSubmitting(false);
    }
  };

  const saveFeatureRestrictions = async (removeRights: number) => {
    if (!client || !user) return;
    setUserMutationSubmitting(true);
    try {
      const { latest } = await findLatestUser();
      if (isCurrentUser(latest, userInfo?.id)) {
        throw new Error(t('userDetails.errors.cannotEditCurrentPermissions'));
      }
      await client.users.setRemoveRights(latest.id, removeRights);
      await loadDetails();
      setFeatureRestrictionOpen(false);
      void messageApi.success(t('userDetails.messages.featureRestrictionsUpdated', { name: latest.name }));
    } catch (error) {
      void messageApi.error(t('userDetails.messages.featureRestrictionsFailed', { detail: errorMessage(error, t) }));
    } finally {
      setUserMutationSubmitting(false);
    }
  };

  const confirmLockChange = () => {
    if (!client || !user) return;
    const locking = !user.locked;
    modalApi.confirm({
      title: locking ? t('userDetails.confirm.disableTitle') : t('userDetails.confirm.enableTitle'),
      content: t(locking ? 'userDetails.confirm.disableContent' : 'userDetails.confirm.enableContent', { name: user.name }),
      okText: locking ? t('common.actions.disable') : t('common.actions.enable'),
      cancelText: t('common.actions.cancel'),
      okButtonProps: { danger: locking },
      onOk: async () => {
        const { latest, users } = await findLatestUser();
        if (isCurrentUser(latest, userInfo?.id)) throw new Error(t('userDetails.errors.cannotChangeCurrentStatus'));
        if (locking && isLastActiveAdministrator(latest, users)) {
          throw new Error(t('userDetails.errors.cannotDisableLastAdmin'));
        }
        await client.users.setLocked(latest.id, locking, latest.siteRights);
        await loadDetails();
        void messageApi.success(t(locking ? 'userDetails.messages.userDisabled' : 'userDetails.messages.userEnabled', { name: latest.name }));
      },
    });
  };

  const confirmDeleteUser = () => {
    if (!client || !user) return;
    modalApi.confirm({
      title: t('userDetails.confirm.deleteTitle'),
      content: t('userDetails.confirm.deleteContent', { name: user.name }),
      okText: t('userDetails.confirm.deleteOk'),
      cancelText: t('common.actions.cancel'),
      okButtonProps: { danger: true },
      onOk: async () => {
        const { latest, users } = await findLatestUser();
        if (isCurrentUser(latest, userInfo?.id)) throw new Error(t('userDetails.errors.cannotDeleteCurrent'));
        if (isLastActiveAdministrator(latest, users)) {
          throw new Error(t('userDetails.errors.cannotDeleteLastAdmin'));
        }
        await client.users.remove(latest.id, latest.name);
        void messageApi.success(t('userDetails.messages.userDeleted', { name: latest.name }));
        navigate('/admin/users');
      },
    });
  };

  const saveDeviceGroupPermission = async ({ groupId, rights }: { groupId: string; rights: number }) => {
    if (!client || !user) return;
    if (isCurrentUser(user, userInfo?.id)) {
      setPermissionEditor(undefined);
      void messageApi.error(t('userDetails.errors.cannotEditCurrentDeviceGroups'));
      return;
    }
    const group = availableGroups.find((item) => item.id === groupId);
    if (!group) {
      void messageApi.error(t('userDetails.errors.groupDeleted'));
      return;
    }
    setPermissionSubmitting(true);
    try {
      await client.groups.setUserRights(group.id, group.name, user.id, rights);
      await loadDetails();
      void messageApi.success(t(permissionEditor === 'new' ? 'userDetails.messages.groupAdded' : 'userDetails.messages.groupUpdated', { name: group.name }));
      setPermissionEditor(undefined);
    } catch (error) {
      void messageApi.error(t('userDetails.messages.groupSaveFailed', { detail: errorMessage(error, t) }));
    } finally {
      setPermissionSubmitting(false);
    }
  };

  const confirmDeviceGroupRemoval = (row: AccessRow) => {
    if (!client || !user) return;
    if (isCurrentUser(user, userInfo?.id)) {
      setPermissionEditor(undefined);
      void messageApi.error(t('userDetails.errors.cannotEditCurrentDeviceGroups'));
      return;
    }
    modalApi.confirm({
      title: t('userDetails.confirm.removeGroupTitle'),
      content: t('userDetails.confirm.removeGroupContent', { user: user.name, name: row.name }),
      okText: t('userDetails.actions.confirmRemove'),
      cancelText: t('common.actions.cancel'),
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await client.groups.removeUser(row.id, user.id);
          await loadDetails();
          void messageApi.success(t('userDetails.messages.groupRemoved', { name: row.name }));
        } catch (error) {
          void messageApi.error(t('userDetails.messages.groupRemoveFailed', { detail: errorMessage(error, t) }));
          throw error;
        }
      },
    });
  };

  const saveDevicePermission = async ({ deviceId, rights }: { deviceId: string; rights: number }) => {
    if (!client || !user) return;
    if (isCurrentUser(user, userInfo?.id)) {
      setDevicePermissionEditor(undefined);
      void messageApi.error(t('userDetails.errors.cannotEditCurrentDevices'));
      return;
    }
    const device = devices.find((item) => item.id === deviceId);
    if (!device) {
      void messageApi.error(t('userDetails.errors.deviceDeleted'));
      return;
    }
    setPermissionSubmitting(true);
    try {
      const { latest } = await findLatestUser();
      if (isCurrentUser(latest, userInfo?.id)) throw new Error(t('userDetails.errors.cannotEditCurrentDevices'));
      await client.devices.setUserRights(device.id, latest.name, rights);
      await loadDetails();
      void messageApi.success(
        devicePermissionEditor === 'new'
          ? t('userDetails.messages.deviceAdded', { name: device.name })
          : t('userDetails.messages.deviceUpdated', { name: device.name }),
      );
      setDevicePermissionEditor(undefined);
    } catch (error) {
      void messageApi.error(t('userDetails.messages.deviceSaveFailed', { detail: errorMessage(error, t) }));
    } finally {
      setPermissionSubmitting(false);
    }
  };

  const confirmDevicePermissionRemoval = (row: AccessRow) => {
    if (!client || !user) return;
    modalApi.confirm({
      title: t('userDetails.confirm.removeDeviceTitle'),
      content: t('userDetails.confirm.removeDeviceContent', { user: user.name, name: row.name }),
      okText: t('userDetails.actions.confirmRemove'),
      cancelText: t('common.actions.cancel'),
      okButtonProps: { danger: true },
      onOk: async () => {
        const { latest } = await findLatestUser();
        if (isCurrentUser(latest, userInfo?.id)) throw new Error(t('userDetails.errors.cannotEditCurrentDevices'));
        await client.devices.removeUser(row.id, latest.name);
        await loadDetails();
        void messageApi.success(t('userDetails.messages.deviceRemoved', { name: row.name }));
      },
    });
  };

  const isInitialLoading = !user && (loading || status !== 'connected');
  if (isInitialLoading) {
    return (
      <main
        className="page-stack user-details-page user-group-loading"
        aria-busy="true"
        aria-label={t('userDetails.loading')}
      >
        <nav className="user-detail-breadcrumb user-group-loading-breadcrumb" aria-hidden="true">
          <span className="user-group-loading-line is-breadcrumb" />
          <span>›</span>
          <span className="user-group-loading-line is-breadcrumb-current" />
        </nav>

        <section className="user-detail-hero user-group-loading-hero" aria-hidden="true">
          <div className="user-detail-profile">
            <span className="user-group-loading-avatar">
              <UserOutlined />
            </span>
            <div className="user-group-loading-profile-copy">
              <span className="user-group-loading-line is-title" />
              <span className="user-group-loading-line is-description" />
              <span className="user-group-loading-line is-id" />
              <div className="user-group-loading-actions">
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>

          <div className="user-detail-meta-container">
            <div className="user-detail-meta-grid">
              {Array.from({ length: 6 }, (_, index) => (
                <div className="user-detail-meta-item user-group-loading-meta" key={index}>
                  <span className="user-group-loading-line is-meta-label" />
                  <span className="user-group-loading-line is-meta-value" />
                </div>
              ))}
            </div>
          </div>

          <div className="user-detail-sessions">
            <div className="user-detail-sessions-card user-group-loading-status">
              <span className="user-group-loading-status-icon">
                <ApiOutlined />
              </span>
              <div>
                <span className="user-group-loading-line is-status-label" />
                <span className="user-group-loading-line is-status-value" />
                <span className="user-group-loading-line is-status-note" />
              </div>
            </div>
          </div>
        </section>

        <section className="user-group-loading-content" aria-hidden="true">
          <div className="user-group-loading-tabs">
            <span className="is-active" />
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="user-group-loading-body">
            <div className="user-group-loading-heading">
              <span className="user-group-loading-line is-section-title" />
              <span className="user-group-loading-line is-section-action" />
            </div>
            {Array.from({ length: 4 }, (_, index) => (
              <div className="user-group-loading-row" key={index}>
                <span className="user-group-loading-row-icon" />
                <span className="user-group-loading-line is-row-primary" />
                <span className="user-group-loading-line is-row-secondary" />
                <span className="user-group-loading-line is-row-tag" />
              </div>
            ))}
          </div>
        </section>

        <span className="user-group-loading-announcement">{t('userDetails.loading')}...</span>
      </main>
    );
  }

  if (loadError && !user) {
    return (
      <main className="user-details-page page-stack">
        <nav className="user-detail-breadcrumb" aria-label={t('userDetails.breadcrumb')}>
          <button onClick={() => navigate('/admin/users')}>{t('navigation.userManagement')}</button>
          <span>›</span>
          <strong>{t('userDetails.loadFailed')}</strong>
        </nav>
        <Alert
          showIcon
          type="error"
          title={t('userDetails.loadFailed')}
          description={loadError}
          action={
            <Button onClick={() => void loadDetails()} disabled={status !== 'connected'}>
              {t('common.actions.retry')}
            </Button>
          }
        />
      </main>
    );
  }

  if (!user) {
    return (
      <main className="user-details-page page-stack">
        <nav className="user-detail-breadcrumb" aria-label={t('userDetails.breadcrumb')}>
          <button onClick={() => navigate('/admin/users')}>{t('navigation.userManagement')}</button>
          <span>›</span>
          <strong>{t('userDetails.errors.userDeleted')}</strong>
        </nav>
        <Empty description={t('userDetails.errors.userDeleted')} style={{ marginTop: 60 }}>
          <Button type="primary" onClick={() => navigate('/admin/users')}>
            {t('userDetails.actions.backToList')}
          </Button>
        </Empty>
      </main>
    );
  }

  const activeTitle = tabs.find((tab) => tab.key === activeTab)?.labelKey;

  return (
    <main className="user-details-page page-stack">
      {messageContextHolder}
      {modalContextHolder}
      <nav className="user-detail-breadcrumb" aria-label={t('userDetails.breadcrumb')}>
        <button onClick={() => navigate('/admin/users')}>{t('navigation.userManagement')}</button><span>›</span><strong>{user.name}</strong>
      </nav>

      {loadError ? <Alert showIcon type="warning" title={t('userDetails.partialRefreshFailed')} description={loadError} /> : null}

      <section className="user-detail-hero">
        <div className="user-detail-profile">
          <div className="user-detail-avatar-wrapper">
            <UserAvatar
              className={`user-detail-avatar ${user.locked ? 'is-locked' : online ? 'is-online' : 'is-offline'}`}
              username={user.name}
              refreshKey={avatarRefreshKey}
              src={user.image}
              hasImage={Boolean(user.image || user.hasImage)}
            />
            <span
              className={`user-detail-status-indicator ${user.locked ? 'status-locked' : online ? 'status-online' : 'status-offline'}`}
              title={user.locked ? t('userDetails.status.locked') : online ? t('common.status.online') : t('common.status.offline')}
            />
          </div>
          <div className="user-detail-name">
            <div className="user-detail-title-row">
              <h1>{user.name}</h1>
              <Tag
                className={`user-status-tag ${user.locked ? 'tag-locked' : online ? 'tag-online' : 'tag-offline'}`}
                color={user.locked ? 'error' : online ? 'success' : 'default'}
              >
                <span className="user-status-dot" />
                {user.locked ? t('userDetails.status.locked') : online ? t('common.status.online') : t('common.status.offline')}
              </Tag>
              {isFullAdministrator(user.siteRights) ? (
                <Tag color="blue" className="user-role-tag">{t('permissions.summary.siteAdmin')}</Tag>
              ) : null}
            </div>
            <div className="user-detail-subinfo">
              <span className="user-detail-realname">{user.realName || t('userDetails.missingRealName')}</span>
              <span className="user-detail-divider">•</span>
              <span className="user-detail-email">
                <MailOutlined /> {user.email || t('userDetails.missingEmail')}
              </span>
            </div>
            <div className="user-detail-actions">
              <Button size="small" icon={<EditOutlined />} onClick={() => setEditingProfile(true)}>
                {t('userDetails.actions.editProfile')}
              </Button>
              <Tooltip title={isViewingCurrentUser ? t('userDetails.errors.cannotEditCurrentPermissions') : undefined}>
                <Button
                  size="small"
                  icon={<SafetyCertificateOutlined />}
                  disabled={status !== 'connected' || isViewingCurrentUser}
                  onClick={() => setSitePermissionOpen(true)}
                >
                  {t('userDetails.actions.setPermissions')}
                </Button>
              </Tooltip>
              <Tooltip title={isViewingCurrentUser ? t('userDetails.errors.cannotEditCurrentPermissions') : undefined}>
                <Button
                  size="small"
                  icon={<SettingOutlined />}
                  disabled={status !== 'connected' || isViewingCurrentUser}
                  onClick={() => setFeatureRestrictionOpen(true)}
                >
                  {t('userDetails.actions.setFeatures')}
                </Button>
              </Tooltip>
              <Button
                size="small"
                danger={!user.locked}
                icon={user.locked ? <UnlockOutlined /> : <LockOutlined />}
                disabled={status !== 'connected' || isViewingCurrentUser}
                onClick={confirmLockChange}
              >
                {user.locked ? t('common.actions.enable') : t('common.actions.disable')}
              </Button>
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                disabled={status !== 'connected' || isViewingCurrentUser}
                onClick={confirmDeleteUser}
              >
                {t('common.actions.delete')}
              </Button>
            </div>
          </div>
        </div>

        <div className="user-detail-meta-container">
          <div className="user-detail-meta-grid">
            <div className="user-detail-meta-item">
              <dt><IdcardOutlined /> {t('userDetails.fields.userId')}</dt>
              <dd>
                <Tooltip title={user.id}>
                  <span className="user-detail-meta-value mono">{user.id}</span>
                </Tooltip>
              </dd>
            </div>
            <div className="user-detail-meta-item">
              <dt><ClockCircleFilled /> {t('userDetails.fields.createdAt')}</dt>
              <dd>
                <span className="user-detail-meta-value">{user.createdAt ? dateTime(user.createdAt, { second: undefined }) : t('userDetails.missing')}</span>
              </dd>
            </div>
            <div className="user-detail-meta-item">
              <dt><ClockCircleFilled /> {t('userDetails.fields.lastLoginAt')}</dt>
              <dd>
                <span className="user-detail-meta-value">{user.lastLoginAt ? dateTime(user.lastLoginAt, { second: undefined }) : t('userDetails.neverLoggedIn')}</span>
              </dd>
            </div>
            <div className="user-detail-meta-item">
              <dt><ClockCircleFilled /> {t('userDetails.fields.lastAccessAt')}</dt>
              <dd>
                <span className="user-detail-meta-value">{user.lastAccessAt ? dateTime(user.lastAccessAt, { second: undefined }) : t('userDetails.missing')}</span>
              </dd>
            </div>
            <div className="user-detail-meta-item">
              <dt><KeyOutlined /> {t('userDetails.fields.passwordChangedAt')}</dt>
              <dd>
                <span className="user-detail-meta-value">{user.passwordChangedAt ? dateTime(user.passwordChangedAt, { second: undefined }) : t('userDetails.missing')}</span>
              </dd>
            </div>
            <div className="user-detail-meta-item">
              <dt><SafetyCertificateFilled /> {t('userDetails.fields.sitePermissions')}</dt>
              <dd>
                <Tooltip title={summarizeSiteRights(user.siteRights, t)}>
                  <span className="user-detail-meta-value">{summarizeSiteRights(user.siteRights, t)}</span>
                </Tooltip>
              </dd>
            </div>
          </div>
        </div>

        <div className="user-detail-sessions">
          <div className={`user-detail-sessions-card ${online ? 'is-online' : ''}`}>
            <span className="user-detail-sessions-icon">
              <ApiOutlined />
            </span>
            <div className="user-detail-sessions-body">
              <div className="user-detail-sessions-count">
                <strong>{sessionCount}</strong>
                <span className="user-detail-sessions-unit">{t('userDetails.activeSessions')}</span>
              </div>
              <div className="user-detail-sessions-status">
                <span className={`user-detail-pulse-dot ${online ? 'online' : 'offline'}`} />
                <small>{online ? t('userDetails.status.userOnline') : t('userDetails.status.userOffline')}</small>
              </div>
            </div>
          </div>
        </div>
      </section>

      <nav className="user-detail-tabs">
        {tabs.map((tab) => (
          <button key={tab.key} className={activeTab === tab.key ? 'active' : ''} onClick={() => setActiveTab(tab.key)}>
            {tab.icon}<span>{t(tab.labelKey)}</span>
          </button>
        ))}
      </nav>

      {activeTab === 'overview' ? (
        <>
          <section className="user-detail-summary-grid">
            <SummaryCard icon={<ApartmentOutlined />} title={t('userDetails.tabs.deviceGroups')} value={deviceGroupRows.length} tone="blue" />
            <SummaryCard icon={<TeamOutlined />} title={t('userDetails.tabs.userGroups')} value={userGroupRows.length} tone="purple" />
            <SummaryCard icon={<DesktopOutlined />} title={t('userDetails.tabs.sharedDevices')} value={sharedDeviceRows.length} tone="green" />
          </section>
          <section className="user-detail-access-grid">
            <AccessCard constrained icon={<ApartmentOutlined />} title={t('userDetails.tabs.deviceGroups')} rows={deviceGroupRows} tone="blue-text" />
            <AccessCard constrained icon={<TeamOutlined />} title={t('userDetails.tabs.userGroups')} rows={userGroupRows} tone="purple-text" />
            <AccessCard constrained icon={<DesktopOutlined />} title={t('userDetails.tabs.sharedDevices')} rows={sharedDeviceRows} tone="blue-text" />
          </section>
          <EventTable events={events.slice(0, 10)} devices={devices} />
        </>
      ) : activeTab === 'logs' ? (
        <EventTable events={events} devices={devices} />
      ) : activeTab === 'device-groups' ? (
        <AccessCard
          editable
          icon={<ApartmentOutlined />}
          title={t(activeTitle ?? 'userDetails.tabs.deviceGroups')}
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
        <AccessCard icon={<TeamOutlined />} title={t(activeTitle ?? 'userDetails.tabs.userGroups')} rows={userGroupRows} tone="purple-text" />
      ) : (
        <AccessCard
          editable
          icon={<DesktopOutlined />}
          title={t(activeTitle ?? 'userDetails.tabs.sharedDevices')}
          rows={sharedDeviceRows}
          tone="blue-text"
          addDisabled={deviceGroupManagementDisabled}
          editDisabled={deviceGroupManagementDisabled}
          disabledReason={t('userDetails.errors.cannotEditCurrentDevices')}
          onAdd={() => {
            if (!deviceGroupManagementDisabled) setDevicePermissionEditor('new');
          }}
          onEdit={(row) => {
            if (!deviceGroupManagementDisabled) setDevicePermissionEditor({ deviceId: row.id, rights: row.rights });
          }}
          onRemove={confirmDevicePermissionRemoval}
        />
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
      <DevicePermissionModal
        subjectType="user"
        open={Boolean(devicePermissionEditor) && !deviceGroupManagementDisabled}
        groups={availableGroups}
        devices={devices}
        currentDeviceIds={sharedDeviceRows.map((row) => row.id)}
        editing={devicePermissionEditor && devicePermissionEditor !== 'new' ? devicePermissionEditor : undefined}
        submitting={permissionSubmitting}
        onCancel={() => setDevicePermissionEditor(undefined)}
        onSubmit={saveDevicePermission}
      />
      <SitePermissionModal
        open={sitePermissionOpen && !isViewingCurrentUser}
        user={user}
        submitting={userMutationSubmitting}
        onCancel={() => setSitePermissionOpen(false)}
        onSubmit={saveSitePermissions}
      />
      <UserFeatureRestrictionModal
        open={featureRestrictionOpen && !isViewingCurrentUser}
        user={user}
        submitting={userMutationSubmitting}
        onCancel={() => setFeatureRestrictionOpen(false)}
        onSubmit={saveFeatureRestrictions}
      />
      <UserEditDrawer
        user={editingProfile ? user : undefined}
        submitting={userMutationSubmitting}
        onClose={() => setEditingProfile(false)}
        onSubmit={updateUser}
      />
    </main>
  );
}
