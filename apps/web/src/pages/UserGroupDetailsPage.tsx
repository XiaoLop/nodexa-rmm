import {
  ApartmentOutlined,
  CopyOutlined,
  DeleteOutlined,
  DesktopOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  GlobalOutlined,
  IdcardOutlined,
  InfoCircleOutlined,
  LaptopOutlined,
  MailOutlined,
  PlusOutlined,
  RightOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  TeamOutlined,
  UserAddOutlined,
  UserDeleteOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  SiteRight,
  hasSiteRight,
  isFullAdministrator,
  isSiteAdministrator,
  type ManagedUser,
  type UserGroup,
  type UserGroupLink,
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
  Tabs,
  Tag,
  Tooltip,
  message,
  type TableColumnsType,
} from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { DeviceGroupPermissionModal } from '../components/users/DeviceGroupPermissionModal';
import { DevicePermissionModal } from '../components/users/DevicePermissionModal';
import { useMeshCentralControlData } from '../features/gateway';
import { summarizeMeshRights } from '../features/users/meshPermissions';
import '../assets/styles/user-details.css';

type GroupPermissionEditor = 'new' | { groupId: string; rights: number };
type DevicePermissionEditor = 'new' | { deviceId: string; rights: number };

interface EditValues {
  name: string;
  description?: string;
}

function errorMessage(error: unknown, unknownText: string): string {
  return error instanceof Error ? error.message : unknownText;
}

export function UserGroupDetailsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { userGroupId } = useParams();
  const decodedId = userGroupId ? decodeURIComponent(userGroupId) : '';
  const { client, status, userInfo, groups, devices } = useMeshCentralControlData();
  const [editForm] = Form.useForm<EditValues>();
  const [messageApi, messageContextHolder] = message.useMessage();
  const [group, setGroup] = useState<UserGroup>();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  // Tabs & Searches
  const [activeTab, setActiveTab] = useState('overview');
  const [memberSearch, setMemberSearch] = useState('');
  const [groupPermSearch, setGroupPermSearch] = useState('');
  const [devicePermSearch, setDevicePermSearch] = useState('');

  // Modals
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [selectedUsernames, setSelectedUsernames] = useState<string[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [groupPermissionEditor, setGroupPermissionEditor] = useState<GroupPermissionEditor>();
  const [devicePermissionEditor, setDevicePermissionEditor] = useState<DevicePermissionEditor>();

  const requestSequence = useRef(0);
  const connected = Boolean(client && status === 'connected');
  const canManage = Boolean(
    userInfo &&
    (isSiteAdministrator(userInfo.siteadmin ?? 0) ||
      hasSiteRight(userInfo.siteadmin ?? 0, SiteRight.ManageUserGroups)),
  );
  const canWrite = connected && canManage;

  const loadDetails = useCallback(async () => {
    if (!client || status !== 'connected' || !decodedId) return;
    const sequence = ++requestSequence.current;
    setLoading(true);
    setLoadError(undefined);
    try {
      const [availableGroups, availableUsers] = await Promise.all([
        client.userGroups.list(),
        client.users.list(),
      ]);
      if (sequence !== requestSequence.current) return;
      const targetGroup = availableGroups.find((item) => item.id === decodedId);
      setGroup(targetGroup);
      setUsers(availableUsers);
    } catch (error) {
      if (sequence === requestSequence.current) setLoadError(errorMessage(error, t('common.status.unknown')));
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [client, decodedId, status, t]);

  useEffect(() => {
    if (status === 'connected') void loadDetails();
    return () => {
      requestSequence.current += 1;
    };
  }, [loadDetails, status]);

  useEffect(() => {
    if (!editOpen || !group) return;
    editForm.setFieldsValue({ name: group.name, description: group.description });
  }, [editForm, editOpen, group]);

  const memberLinks = useMemo(
    () => group?.links.filter((link) => link.type === 'user') ?? [],
    [group],
  );
  const groupLinks = useMemo(
    () => group?.links.filter((link) => link.type === 'device-group') ?? [],
    [group],
  );
  const deviceLinks = useMemo(
    () => group?.links.filter((link) => link.type === 'device') ?? [],
    [group],
  );

  const memberIds = useMemo(() => new Set(memberLinks.map((link) => link.id)), [memberLinks]);
  const availableUsers = useMemo(
    () =>
      users
        .filter((user) => !memberIds.has(user.id))
        .sort((a, b) => a.name.localeCompare(b.name, i18n.resolvedLanguage ?? i18n.language)),
      [i18n.language, i18n.resolvedLanguage, memberIds, users],
  );

  // 搜索过滤后的成员列表
  const filteredMemberLinks = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return memberLinks;
    return memberLinks.filter((link) => {
      const user = users.find((item) => item.id === link.id);
      return (
        (user?.name ?? link.name ?? link.id).toLowerCase().includes(q) ||
        user?.realName?.toLowerCase().includes(q) ||
        user?.email?.toLowerCase().includes(q) ||
        link.id.toLowerCase().includes(q)
      );
    });
  }, [memberLinks, memberSearch, users]);

  // 搜索过滤后的设备组列表
  const filteredGroupLinks = useMemo(() => {
    const q = groupPermSearch.trim().toLowerCase();
    if (!q) return groupLinks;
    return groupLinks.filter((link) => {
      const target = groups.find((item) => item.id === link.id);
      return (
        (target?.name ?? link.name ?? link.id).toLowerCase().includes(q) ||
        link.id.toLowerCase().includes(q)
      );
    });
  }, [groupLinks, groupPermSearch, groups]);

  // 搜索过滤后的设备列表
  const filteredDeviceLinks = useMemo(() => {
    const q = devicePermSearch.trim().toLowerCase();
    if (!q) return deviceLinks;
    return deviceLinks.filter((link) => {
      const target = devices.find((item) => item.id === link.id);
      return (
        (target?.name ?? link.name ?? link.id).toLowerCase().includes(q) ||
        target?.groupName?.toLowerCase().includes(q) ||
        link.id.toLowerCase().includes(q)
      );
    });
  }, [deviceLinks, devicePermSearch, devices]);

  const mutate = async (operation: () => Promise<unknown>, success: string) => {
    setSubmitting(true);
    try {
      await operation();
      await loadDetails();
      void messageApi.success(success);
      return true;
    } catch (error) {
      void messageApi.error(`${success}: ${errorMessage(error, t('common.status.unknown'))}`);
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyId = () => {
    if (!group) return;
    navigator.clipboard
      .writeText(group.id)
      .then(() => void messageApi.success(t('common.actions.copied')))
      .catch(() => void messageApi.info(group.id));
  };

  const addMembers = async () => {
    if (!client || !group || selectedUsernames.length === 0) return;
    const succeeded = await mutate(
      () => client.userGroups.addUsers(group.id, selectedUsernames),
      t('userGroups.details.actions.addMember'),
    );
    if (succeeded) {
      setMemberModalOpen(false);
      setSelectedUsernames([]);
    }
  };

  const removeMember = (link: UserGroupLink) => {
    if (!client || !group) return;
    const user = users.find((item) => item.id === link.id);
    const targetName = user?.name ?? link.name ?? link.id;
    Modal.confirm({
      title: t('userGroups.details.confirm.removeMemberTitle'),
      icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />,
      content: (
        <div>
          <p>
            {t('userGroups.details.confirm.removeMemberContent', { group: group.name, name: targetName })}
          </p>
          <p style={{ color: '#8c9ba5', fontSize: 12 }}>
            {t('userGroups.details.confirm.removeMemberDescription')}
          </p>
        </div>
      ),
      okText: t('userGroups.details.actions.confirmRemove'),
      cancelText: t('common.actions.cancel'),
      okButtonProps: { danger: true },
      onOk: () => mutate(() => client.userGroups.removeUser(group.id, link.id), t('userGroups.details.actions.removeMember')),
    });
  };

  const saveGroupPermission = async (value: { groupId: string; rights: number }) => {
    if (!client || !group) return;
    const target = groups.find((item) => item.id === value.groupId);
    if (!target) throw new Error(t('userGroups.details.errors.groupDeleted'));
    const succeeded = await mutate(
      () => client.groups.setUserGroupRights(target.id, target.name, group.id, value.rights),
      t('userGroups.details.actions.saveGroupPermissions'),
    );
    if (succeeded) setGroupPermissionEditor(undefined);
  };

  const saveDevicePermission = async (value: { deviceId: string; rights: number }) => {
    if (!client || !group) return;
    const target = devices.find((item) => item.id === value.deviceId);
    if (!target) throw new Error(t('userGroups.details.errors.deviceDeleted'));
    const succeeded = await mutate(
      () => client.devices.setUserGroupRights(target.id, target.name, group.id, value.rights),
      t('userGroups.details.actions.saveDevicePermissions'),
    );
    if (succeeded) setDevicePermissionEditor(undefined);
  };

  // 成员表格列定义
  const memberColumns: TableColumnsType<UserGroupLink> = [
    {
      title: t('userGroups.details.memberColumns.user'),
      key: 'user',
      render: (_, link) => {
        const user = users.find((item) => item.id === link.id);
        const displayName = user?.name ?? link.name ?? link.id;
        return (
          <Space size={8}>
            <span
              className="user-identity-icon"
              style={{ width: 28, height: 28, flexBasis: 28, fontSize: 14 }}
            >
              <UserOutlined />
            </span>
            <span
              className="user-group-member-link"
              onClick={() => navigate(`/admin/users/${encodeURIComponent(link.id)}`)}
              title={t('userGroups.details.memberColumns.viewUser')}
            >
              {displayName}
            </span>
          </Space>
        );
      },
    },
    {
      title: t('userGroups.details.memberColumns.realName'),
      width: 150,
      render: (_, link) => {
        const user = users.find((item) => item.id === link.id);
        return user?.realName || <span style={{ color: '#64748b' }}>—</span>;
      },
    },
    {
      title: t('userGroups.details.memberColumns.email'),
      width: 220,
      render: (_, link) => {
        const user = users.find((item) => item.id === link.id);
        return user?.email ? (
          <Space size={4}>
            <MailOutlined style={{ color: '#38bdf8' }} />
            <span>{user.email}</span>
          </Space>
        ) : (
          <span style={{ color: '#64748b' }}>{t('userGroups.details.missing')}</span>
        );
      },
    },
    {
      title: t('userGroups.details.memberColumns.status'),
      width: 180,
      render: (_, link) => {
        const user = users.find((item) => item.id === link.id);
        if (!user) return <Tag>{t('common.status.unknown')}</Tag>;
        return (
          <Space size={4} wrap>
            <Tag color={user.locked ? 'error' : 'success'}>{user.locked ? t('users.status.locked') : t('users.status.active')}</Tag>
            {isFullAdministrator(user.siteRights) ? <Tag color="blue">{t('users.status.siteAdmin')}</Tag> : null}
          </Space>
        );
      },
    },
    {
      title: t('userGroups.details.memberColumns.actions'),
      width: 100,
      fixed: 'right',
      render: (_, link) => (
        <Tooltip title={!canWrite ? t('userGroups.details.noManagePermission') : undefined}>
          <Button
            type="link"
            danger
            size="small"
            icon={<UserDeleteOutlined />}
            disabled={!canWrite}
            onClick={() => removeMember(link)}
          >
            {t('userGroups.details.actions.remove')}
          </Button>
        </Tooltip>
      ),
    },
  ];

  // 权限列通用工厂
  const permissionColumns = (type: 'device-group' | 'device'): TableColumnsType<UserGroupLink> => [
    {
      title: type === 'device-group' ? t('userGroups.details.deviceGroup') : t('userGroups.details.device'),
      key: 'target',
      render: (_, link) => {
        const target =
          type === 'device-group'
            ? groups.find((item) => item.id === link.id)
            : devices.find((item) => item.id === link.id);
        const name = target?.name ?? link.name ?? link.id;

        return (
          <Space size={8}>
            {type === 'device-group' ? (
              <span
                className="user-group-identity-icon"
                style={{ width: 28, height: 28, flexBasis: 28, fontSize: 13 }}
              >
                <ApartmentOutlined />
              </span>
            ) : (
              <span
                className="user-identity-icon"
                style={{ width: 28, height: 28, flexBasis: 28, fontSize: 13 }}
              >
                <DesktopOutlined />
              </span>
            )}
            <div>
              <strong>{name}</strong>
              {type === 'device' && (target as any)?.groupName ? (
                <div style={{ fontSize: 11, color: '#64748b' }}>
                  {t('userGroups.details.groupLabel', { name: (target as any).groupName })}
                </div>
              ) : null}
            </div>
          </Space>
        );
      },
    },
    {
      title: t('userGroups.details.inheritedPermissions'),
      key: 'rights',
      width: 320,
      render: (_, link) => (
        <Tag color="blue" style={{ fontSize: 12, padding: '2px 8px' }}>
          <SafetyCertificateOutlined style={{ marginRight: 4 }} />
          {summarizeMeshRights(link.rights, t)}
        </Tag>
      ),
    },
    {
      title: t('userGroups.details.memberColumns.actions'),
      key: 'actions',
      width: 160,
      fixed: 'right',
      render: (_, link) => (
        <Space size="small">
          <Tooltip title={!canWrite ? t('userGroups.details.noManagePermission') : undefined}>
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              disabled={!canWrite}
              onClick={() =>
                type === 'device-group'
                  ? setGroupPermissionEditor({ groupId: link.id, rights: link.rights })
                  : setDevicePermissionEditor({ deviceId: link.id, rights: link.rights })
              }
            >
              {t('userGroups.details.actions.editPermissions')}
            </Button>
          </Tooltip>
          <Tooltip title={!canWrite ? t('userGroups.details.noManagePermission') : undefined}>
            <Button
              type="link"
              danger
              size="small"
              disabled={!canWrite}
              onClick={() => {
                if (!client || !group) return;
                Modal.confirm({
                  title: type === 'device-group' ? t('userGroups.details.confirm.removeGroupTitle') : t('userGroups.details.confirm.removeDeviceTitle'),
                  icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />,
                  content: t('userGroups.details.confirm.removeContent'),
                  okText: t('userGroups.details.actions.confirmRemove'),
                  cancelText: t('common.actions.cancel'),
                  okButtonProps: { danger: true },
                  onOk: () =>
                    type === 'device-group'
                      ? mutate(
                          () => client.groups.removeUserGroup(link.id, group.id),
                          t('userGroups.details.confirm.removeGroupTitle'),
                        )
                      : mutate(
                          () => client.devices.removeUserGroup(link.id, group.id),
                          t('userGroups.details.confirm.removeDeviceTitle'),
                        ),
                });
              }}
            >
              {t('userGroups.details.actions.remove')}
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ];

  if (loading && !group) {
    return (
      <main
        className="page-stack user-details-page user-group-loading"
        aria-busy="true"
        aria-label={t('userGroups.details.loading')}
      >
        <nav className="user-detail-breadcrumb user-group-loading-breadcrumb" aria-hidden="true">
          <span className="user-group-loading-line is-breadcrumb" />
          <span>›</span>
          <span className="user-group-loading-line is-breadcrumb-current" />
        </nav>

        <section className="user-detail-hero user-group-loading-hero" aria-hidden="true">
          <div className="user-detail-profile">
            <span className="user-group-loading-avatar">
              <TeamOutlined />
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
                <ApartmentOutlined />
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

        <span className="user-group-loading-announcement">{t('userGroups.details.loading')}...</span>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="page-stack user-details-page">
        <nav className="user-detail-breadcrumb" aria-label={t('userGroups.details.breadcrumb')}>
          <button onClick={() => navigate('/admin/roles')}>{t('navigation.userGroups')}</button>
          <span>›</span>
          <strong>{t('userGroups.details.loadFailed')}</strong>
        </nav>
        <Alert
          type="error"
          showIcon
          title={t('userGroups.details.loadFailed')}
          description={loadError}
          action={<Button onClick={() => void loadDetails()}>{t('common.actions.retry')}</Button>}
        />
      </main>
    );
  }

  if (!group) {
    return (
      <Empty description={t('userGroups.details.notFound')} style={{ marginTop: 60 }}>
        <Button type="primary" onClick={() => navigate('/admin/roles')}>
          {t('userGroups.details.backToList')}
        </Button>
      </Empty>
    );
  }

  return (
    <main className="page-stack user-details-page">
      {messageContextHolder}

      {/* 面包屑导航 */}
      <nav className="user-detail-breadcrumb" aria-label={t('userGroups.details.breadcrumb')}>
        <button onClick={() => navigate('/admin/roles')}>{t('navigation.userGroups')}</button>
        <span>›</span>
        <strong>{group.name}</strong>
      </nav>

      {!connected ? (
        <Alert
          type="warning"
          showIcon
          title={t('userGroups.details.gatewayDisconnected')}
          description={t('userGroups.details.gatewayDisconnectedDescription')}
        />
      ) : null}
      {connected && !canManage ? (
        <Alert
          type="info"
          showIcon
          title={t('userGroups.details.readOnly')}
          description={t('userGroups.details.readOnlyDescription')}
        />
      ) : null}

      {/* Hero 区域：标准三列高保真科技感设计 */}
      <section className="user-detail-hero">
        {/* 第一列：头像与基本标识 */}
        <div className="user-detail-profile">
          <div className="user-detail-avatar-wrapper">
            <span className="user-detail-avatar is-usergroup">
              <TeamOutlined />
            </span>
          </div>
          <div className="user-detail-name">
            <div className="user-detail-title-row">
              <h1>{group.name}</h1>
              <Tag color="purple">{t('userGroups.details.role')}</Tag>
              {group.domain ? <Tag color="geekblue">{group.domain}</Tag> : <Tag>{t('userGroups.details.defaultDomain')}</Tag>}
            </div>
            <div className="user-detail-subinfo">
              <span>{group.description || t('userGroups.details.noDescription')}</span>
            </div>
            <div>
              <span className="user-group-id-badge" title={t('userGroups.details.systemId')}>
                <IdcardOutlined />
                <span className="user-group-id-value">{group.id}</span>
                <Tooltip title={t('common.actions.copy')}>
                  <CopyOutlined className="user-group-id-copy" onClick={handleCopyId} />
                </Tooltip>
              </span>
            </div>
            <div className="user-detail-actions">
              <Button
                size="small"
                icon={<EditOutlined />}
                disabled={!canWrite}
                onClick={() => setEditOpen(true)}
              >
                {t('userGroups.details.actions.editProfile')}
              </Button>
              <Button
                size="small"
                icon={<UserAddOutlined />}
                disabled={!canWrite}
                onClick={() => setMemberModalOpen(true)}
              >
                {t('userGroups.details.actions.addMember')}
              </Button>
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                disabled={!canWrite}
                onClick={() => {
                  setDeleteConfirmation('');
                  setDeleteOpen(true);
                }}
              >
                {t('common.actions.delete')}
              </Button>
            </div>
          </div>
        </div>

        {/* 第二列：元数据指标网格 */}
        <div className="user-detail-meta-container">
          <div className="user-detail-meta-grid">
            <div className="user-detail-meta-item">
              <dt>
                <GlobalOutlined /> {t('userGroups.details.fields.domain')}
              </dt>
              <dd>
                <span className="user-detail-meta-value">{group.domain || t('userGroups.details.defaultDomainValue')}</span>
              </dd>
            </div>

            <div className="user-detail-meta-item">
              <dt>
                <TeamOutlined /> {t('userGroups.details.fields.members')}
              </dt>
              <dd>
                <span className="user-detail-meta-value">{t('userGroups.details.counts.members', { count: memberLinks.length })}</span>
              </dd>
            </div>

            <div className="user-detail-meta-item">
              <dt>
                <ApartmentOutlined /> {t('userGroups.details.fields.deviceGroups')}
              </dt>
              <dd>
                <span className="user-detail-meta-value">{t('userGroups.details.counts.deviceGroups', { count: groupLinks.length })}</span>
              </dd>
            </div>

            <div className="user-detail-meta-item">
              <dt>
                <DesktopOutlined /> {t('userGroups.details.fields.devices')}
              </dt>
              <dd>
                <span className="user-detail-meta-value">{t('userGroups.details.counts.devices', { count: deviceLinks.length })}</span>
              </dd>
            </div>

            <div className="user-detail-meta-item">
              <dt>
                <InfoCircleOutlined /> {t('userGroups.details.fields.flags')}
              </dt>
              <dd>
                <span className="user-detail-meta-value">
                  {group.flags === 0 ? t('userGroups.details.defaultFlags') : `Flags: ${group.flags}`}
                </span>
              </dd>
            </div>

            <div className="user-detail-meta-item">
              <dt>
                <SafetyCertificateOutlined /> {t('userGroups.details.fields.consent')}
              </dt>
              <dd>
                <span className="user-detail-meta-value">
                  {group.consent === 0 ? t('userGroups.details.unrestrictedConsent') : `Consent: ${group.consent}`}
                </span>
              </dd>
            </div>
          </div>
        </div>

        {/* 第三列：继承策略生效状态卡 */}
        <div className="user-detail-sessions">
          <div className="user-detail-sessions-card is-online">
            <div className="user-detail-sessions-icon">
              <ApartmentOutlined />
            </div>
            <div className="user-detail-sessions-body">
              <span style={{ fontSize: 11, color: '#94a3b8' }}>{t('userGroups.details.inheritedTotal')}</span>
              <div className="user-detail-sessions-count">
                <strong>{groupLinks.length + deviceLinks.length}</strong>
                <span className="user-detail-sessions-unit">{t('userGroups.details.resourceGrants')}</span>
              </div>
              <div className="user-detail-sessions-status">
                <span className="user-detail-pulse-dot online" />
                <span style={{ fontSize: 12, color: '#34d399' }}>
                  {t('userGroups.details.inheritedForMembers', { count: memberLinks.length })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tabs 切换区 */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'overview',
            label: (
              <span>
                <LaptopOutlined /> {t('userGroups.details.tabs.overview')}
              </span>
            ),
            children: (
              <div className="user-group-inheritance-panel">
                {/* 快捷指标卡片 */}
                <section className="user-detail-summary-grid">
                  <article
                    className="user-detail-summary-card"
                    style={{ cursor: 'pointer' }}
                    onClick={() => setActiveTab('members')}
                  >
                    <span className="user-detail-summary-icon purple">
                      <TeamOutlined />
                    </span>
                    <span>
                      <small>{t('userGroups.details.tabs.memberScale')}</small>
                      <strong>{t('userGroups.details.counts.people', { count: memberLinks.length })}</strong>
                    </span>
                    <RightOutlined className="user-detail-chevron" />
                  </article>

                  <article
                    className="user-detail-summary-card"
                    style={{ cursor: 'pointer' }}
                    onClick={() => setActiveTab('groups')}
                  >
                    <span className="user-detail-summary-icon green">
                      <ApartmentOutlined />
                    </span>
                    <span>
                      <small>{t('userGroups.details.tabs.inheritedGroups')}</small>
                      <strong>{t('userGroups.details.counts.groups', { count: groupLinks.length })}</strong>
                    </span>
                    <RightOutlined className="user-detail-chevron" />
                  </article>

                  <article
                    className="user-detail-summary-card"
                    style={{ cursor: 'pointer' }}
                    onClick={() => setActiveTab('devices')}
                  >
                    <span className="user-detail-summary-icon blue">
                      <DesktopOutlined />
                    </span>
                    <span>
                      <small>{t('userGroups.details.tabs.inheritedDevices')}</small>
                      <strong>{t('userGroups.details.counts.devices', { count: deviceLinks.length })}</strong>
                    </span>
                    <RightOutlined className="user-detail-chevron" />
                  </article>
                </section>

                {/* 快速成员与资源预览 */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
                    gap: 14,
                  }}
                >
                  <section className="console-card">
                    <div className="table-toolbar">
                      <strong>{t('userGroups.details.preview.members')}</strong>
                      <div className="toolbar-spacer" />
                      <Button type="link" size="small" onClick={() => setActiveTab('members')}>
                        {t('userGroups.details.viewAllCount', { count: memberLinks.length })}
                      </Button>
                    </div>
                    {memberLinks.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {memberLinks.slice(0, 5).map((link) => {
                          const user = users.find((item) => item.id === link.id);
                          return (
                            <div
                              key={link.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '8px 12px',
                                background: 'rgba(15, 23, 42, 0.4)',
                                borderRadius: 6,
                                border: '1px solid rgba(51, 65, 85, 0.3)',
                              }}
                            >
                              <Space size={8}>
                                <UserOutlined style={{ color: '#818cf8' }} />
                                <span
                                  className="user-group-member-link"
                                  onClick={() =>
                                    navigate(`/admin/users/${encodeURIComponent(link.id)}`)
                                  }
                                >
                                  {user?.name ?? link.name ?? link.id}
                                </span>
                              </Space>
                              <span style={{ fontSize: 12, color: '#94a3b8' }}>
                                {user?.email || (user?.locked ? t('users.status.locked') : t('users.status.active'))}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('userGroups.details.empty.members')} />
                    )}
                  </section>

                  <section className="console-card">
                    <div className="table-toolbar">
                      <strong>{t('userGroups.details.preview.resources')}</strong>
                      <div className="toolbar-spacer" />
                      <Button type="link" size="small" onClick={() => setActiveTab('groups')}>
                        {t('userGroups.details.viewAllCount', { count: groupLinks.length + deviceLinks.length })}
                      </Button>
                    </div>
                    {groupLinks.length + deviceLinks.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {groupLinks.slice(0, 3).map((link) => {
                          const grp = groups.find((item) => item.id === link.id);
                          return (
                            <div
                              key={link.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '8px 12px',
                                background: 'rgba(15, 23, 42, 0.4)',
                                borderRadius: 6,
                                border: '1px solid rgba(51, 65, 85, 0.3)',
                              }}
                            >
                              <Space size={8}>
                                <ApartmentOutlined style={{ color: '#34d399' }} />
                                <span>{grp?.name ?? link.name ?? link.id}</span>
                              </Space>
                              <Tag color="green">{t('userGroups.details.deviceGroup')}</Tag>
                            </div>
                          );
                        })}
                        {deviceLinks.slice(0, 2).map((link) => {
                          const dev = devices.find((item) => item.id === link.id);
                          return (
                            <div
                              key={link.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '8px 12px',
                                background: 'rgba(15, 23, 42, 0.4)',
                                borderRadius: 6,
                                border: '1px solid rgba(51, 65, 85, 0.3)',
                              }}
                            >
                              <Space size={8}>
                                <DesktopOutlined style={{ color: '#38bdf8' }} />
                                <span>{dev?.name ?? link.name ?? link.id}</span>
                              </Space>
                              <Tag color="blue">{t('userGroups.details.device')}</Tag>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('userGroups.details.empty.resources')} />
                    )}
                  </section>
                </div>
              </div>
            ),
          },
          {
            key: 'members',
            label: (
              <span>
                <TeamOutlined /> {t('userGroups.details.tabs.members', { count: memberLinks.length })}
              </span>
            ),
            children: (
              <section className="console-card">
                <div className="table-toolbar">
                  <Input
                    className="user-group-tab-search"
                    placeholder={t('userGroups.details.search.members')}
                    prefix={<SearchOutlined />}
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    allowClear
                  />
                  <div className="toolbar-spacer" />
                  <Tag color="purple">
                    {t('userGroups.details.counts.filteredMembers', { filtered: filteredMemberLinks.length, total: memberLinks.length })}
                  </Tag>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    disabled={!canWrite}
                    onClick={() => setMemberModalOpen(true)}
                  >
                    {t('userGroups.details.actions.addMember')}
                  </Button>
                </div>
                <Table
                  rowKey="id"
                  columns={memberColumns}
                  dataSource={filteredMemberLinks}
                  pagination={
                    filteredMemberLinks.length > 10
                      ? { defaultPageSize: 10, showSizeChanger: true }
                      : false
                  }
                  locale={{
                    emptyText: (
                      <Empty
                        description={
                          memberLinks.length === 0 ? t('userGroups.details.empty.noMembers') : t('userGroups.details.empty.noMatchingMembers')
                        }
                      >
                        {memberLinks.length === 0 && canWrite ? (
                          <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={() => setMemberModalOpen(true)}
                          >
                            {t('userGroups.details.actions.addMemberNow')}
                          </Button>
                        ) : null}
                      </Empty>
                    ),
                  }}
                />
              </section>
            ),
          },
          {
            key: 'groups',
            label: (
              <span>
                <ApartmentOutlined /> {t('userGroups.details.tabs.groups', { count: groupLinks.length })}
              </span>
            ),
            children: (
              <section className="console-card">
                <div className="table-toolbar">
                  <Input
                    className="user-group-tab-search"
                    placeholder={t('userGroups.details.search.groups')}
                    prefix={<SearchOutlined />}
                    value={groupPermSearch}
                    onChange={(e) => setGroupPermSearch(e.target.value)}
                    allowClear
                  />
                  <div className="toolbar-spacer" />
                  <Tag color="green">
                    {t('userGroups.details.counts.filteredGroups', { filtered: filteredGroupLinks.length, total: groupLinks.length })}
                  </Tag>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    disabled={!canWrite}
                    onClick={() => setGroupPermissionEditor('new')}
                  >
                    {t('userGroups.details.actions.addGroupGrant')}
                  </Button>
                </div>
                <Table
                  rowKey="id"
                  columns={permissionColumns('device-group')}
                  dataSource={filteredGroupLinks}
                  pagination={
                    filteredGroupLinks.length > 10
                      ? { defaultPageSize: 10, showSizeChanger: true }
                      : false
                  }
                  locale={{
                    emptyText: (
                      <Empty
                        description={
                          groupLinks.length === 0 ? t('userGroups.details.empty.noGroupGrants') : t('userGroups.details.empty.noMatchingGroups')
                        }
                      >
                        {groupLinks.length === 0 && canWrite ? (
                          <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={() => setGroupPermissionEditor('new')}
                          >
                            {t('userGroups.details.actions.addFirstGroup')}
                          </Button>
                        ) : null}
                      </Empty>
                    ),
                  }}
                />
              </section>
            ),
          },
          {
            key: 'devices',
            label: (
              <span>
                <DesktopOutlined /> {t('userGroups.details.tabs.devices', { count: deviceLinks.length })}
              </span>
            ),
            children: (
              <section className="console-card">
                <div className="table-toolbar">
                  <Input
                    className="user-group-tab-search"
                    placeholder={t('userGroups.details.search.devices')}
                    prefix={<SearchOutlined />}
                    value={devicePermSearch}
                    onChange={(e) => setDevicePermSearch(e.target.value)}
                    allowClear
                  />
                  <div className="toolbar-spacer" />
                  <Tag color="blue">
                    {t('userGroups.details.counts.filteredDevices', { filtered: filteredDeviceLinks.length, total: deviceLinks.length })}
                  </Tag>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    disabled={!canWrite}
                    onClick={() => setDevicePermissionEditor('new')}
                  >
                    {t('userGroups.details.actions.addDeviceGrant')}
                  </Button>
                </div>
                <Table
                  rowKey="id"
                  columns={permissionColumns('device')}
                  dataSource={filteredDeviceLinks}
                  pagination={
                    filteredDeviceLinks.length > 10
                      ? { defaultPageSize: 10, showSizeChanger: true }
                      : false
                  }
                  locale={{
                    emptyText: (
                      <Empty
                        description={
                          deviceLinks.length === 0 ? t('userGroups.details.empty.noDeviceGrants') : t('userGroups.details.empty.noMatchingDevices')
                        }
                      >
                        {deviceLinks.length === 0 && canWrite ? (
                          <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={() => setDevicePermissionEditor('new')}
                          >
                            {t('userGroups.details.actions.addFirstDevice')}
                          </Button>
                        ) : null}
                      </Empty>
                    ),
                  }}
                />
              </section>
            ),
          },
        ]}
      />

      {/* 添加成员 Modal */}
      <Modal
        title={
          <Space>
            <UserAddOutlined style={{ color: '#818cf8' }} />
            <span>{t('userGroups.details.modals.addMemberTitle', { name: group.name })}</span>
          </Space>
        }
        open={memberModalOpen}
        onCancel={() => setMemberModalOpen(false)}
        onOk={() => void addMembers()}
        confirmLoading={submitting}
        okText={t('userGroups.details.modals.addMemberOk', { count: selectedUsernames.length })}
        okButtonProps={{ disabled: selectedUsernames.length === 0 }}
        destroyOnHidden
        width={560}
      >
        <p style={{ color: '#94a3b8', fontSize: 13 }}>
          {t('userGroups.details.modals.addMemberDescription')}
        </p>

        <div
          style={{
            marginBottom: 12,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 12, color: '#728cad' }}>
            {t('userGroups.details.modals.availableSelected', { available: availableUsers.length, selected: selectedUsernames.length })}
          </span>
          <Space size="small">
            <Button
              size="small"
              onClick={() => setSelectedUsernames(availableUsers.map((u) => u.name))}
              disabled={availableUsers.length === 0}
            >
              {t('userGroups.details.actions.selectAll')}
            </Button>
            <Button
              size="small"
              onClick={() => setSelectedUsernames([])}
              disabled={selectedUsernames.length === 0}
            >
              {t('userGroups.details.actions.clear')}
            </Button>
          </Space>
        </div>

        <Select
          mode="multiple"
          style={{ width: '100%' }}
          showSearch
          optionFilterProp="label"
          value={selectedUsernames}
          onChange={setSelectedUsernames}
          placeholder={t('userGroups.details.search.users')}
          options={availableUsers.map((user) => {
            const extra = [user.realName, user.email].filter(Boolean).join(' · ');
            return {
              value: user.name,
              label: extra ? `${user.name} (${extra})` : user.name,
            };
          })}
        />
      </Modal>

      {/* 编辑用户组资料 Modal */}
      <Modal
        title={t('userGroups.details.modals.editTitle')}
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        onOk={() =>
          void editForm.validateFields().then(async (values) => {
            const succeeded = await mutate(
              () => client!.userGroups.update(group.id, values),
              t('userGroups.details.actions.updateGroup'),
            );
            if (succeeded) setEditOpen(false);
          })
        }
        confirmLoading={submitting}
        destroyOnHidden
      >
        <Form form={editForm} layout="vertical">
          <Form.Item
            label={t('userGroups.modal.name')}
            name="name"
            rules={[
              { required: true, whitespace: true, message: t('userGroups.modal.nameRequired') },
              { max: 128, message: t('userGroups.details.validation.nameMax') },
            ]}
          >
            <Input showCount maxLength={128} />
          </Form.Item>
          <Form.Item
            label={t('userGroups.modal.description')}
            name="description"
            rules={[{ max: 1024, message: t('userGroups.details.validation.descriptionMax') }]}
          >
            <Input.TextArea
              rows={4}
              showCount
              maxLength={1024}
              placeholder={t('userGroups.details.modals.descriptionPlaceholder')}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 删除用户组确认 Modal */}
      <Modal
        title={
          <Space>
            <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
            <span>{t('userGroups.details.modals.deleteTitle')}</span>
          </Space>
        }
        open={deleteOpen}
        onCancel={() => setDeleteOpen(false)}
        onOk={() =>
          void mutate(() => client!.userGroups.remove(group.id), t('common.actions.delete')).then((succeeded) => {
            if (succeeded) navigate('/admin/roles');
          })
        }
        confirmLoading={submitting}
        okText={t('userGroups.confirm.deleteOk')}
        okButtonProps={{ danger: true, disabled: deleteConfirmation !== group.name }}
        destroyOnHidden
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Alert
            type="warning"
            showIcon
            title={t('userGroups.details.modals.irreversible')}
            description={
              <div>
                {t('userGroups.details.modals.deleteImpactIntro')}
                <ul style={{ margin: '4px 0 0 0', paddingLeft: 20 }}>
                  <li>
                    {t('userGroups.details.modals.deleteMembersImpact', { count: memberLinks.length })}
                  </li>
                  <li>
                    {t('userGroups.details.modals.deleteGrantsImpact', { groups: groupLinks.length, devices: deviceLinks.length })}
                  </li>
                </ul>
              </div>
            }
          />
          <p>
            {t('userGroups.details.modals.deleteConfirmation', { name: group.name })}
          </p>
          <Input
            value={deleteConfirmation}
            onChange={(event) => setDeleteConfirmation(event.target.value)}
            placeholder={group.name}
            autoComplete="off"
          />
        </Space>
      </Modal>

      {/* 权限配置 Modal */}
      <DeviceGroupPermissionModal
        open={Boolean(groupPermissionEditor) && canWrite}
        groups={groups}
        currentGroupIds={groupLinks.map((link) => link.id)}
        editing={
          groupPermissionEditor && groupPermissionEditor !== 'new'
            ? groupPermissionEditor
            : undefined
        }
        submitting={submitting}
        onCancel={() => setGroupPermissionEditor(undefined)}
        onSubmit={saveGroupPermission}
      />
      <DevicePermissionModal
        subjectType="user-group"
        open={Boolean(devicePermissionEditor) && canWrite}
        groups={groups}
        devices={devices}
        currentDeviceIds={deviceLinks.map((link) => link.id)}
        editing={
          devicePermissionEditor && devicePermissionEditor !== 'new'
            ? devicePermissionEditor
            : undefined
        }
        submitting={submitting}
        onCancel={() => setDevicePermissionEditor(undefined)}
        onSubmit={saveDevicePermission}
      />
    </main>
  );
}
