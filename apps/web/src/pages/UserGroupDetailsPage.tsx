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
import { useNavigate, useParams } from 'react-router-dom';
import { DeviceGroupPermissionModal } from '../components/users/DeviceGroupPermissionModal';
import { DevicePermissionModal } from '../components/users/DevicePermissionModal';
import { useGatewayData } from '../features/gateway/useGatewayData';
import { summarizeMeshRights } from '../features/users/meshPermissions';
import '../assets/styles/user-details.css';

type GroupPermissionEditor = 'new' | { groupId: string; rights: number };
type DevicePermissionEditor = 'new' | { deviceId: string; rights: number };

interface EditValues {
  name: string;
  description?: string;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '未知错误';
}

export function UserGroupDetailsPage() {
  const navigate = useNavigate();
  const { userGroupId } = useParams();
  const decodedId = userGroupId ? decodeURIComponent(userGroupId) : '';
  const { client, status, userInfo, groups, devices } = useGatewayData();
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
      if (sequence === requestSequence.current) setLoadError(errorMessage(error));
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [client, decodedId, status]);

  useEffect(() => {
    if (status === 'connected') void loadDetails();
    return () => {
      requestSequence.current += 1;
    };
  }, [loadDetails, status]);

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
        .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')),
    [memberIds, users],
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
      void messageApi.error(`${success}失败：${errorMessage(error)}`);
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyId = () => {
    if (!group) return;
    navigator.clipboard
      .writeText(group.id)
      .then(() => void messageApi.success('已复制用户组 ID 到剪贴板'))
      .catch(() => void messageApi.info(`用户组 ID：${group.id}`));
  };

  const addMembers = async () => {
    if (!client || !group || selectedUsernames.length === 0) return;
    const succeeded = await mutate(
      () => client.userGroups.addUsers(group.id, selectedUsernames),
      '添加成员',
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
      title: '移除用户组成员',
      icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />,
      content: (
        <div>
          <p>
            确定从用户组「<strong>{group.name}</strong>」中移除成员「<strong>{targetName}</strong>
            」吗？
          </p>
          <p style={{ color: '#8c9ba5', fontSize: 12 }}>
            移除后，该用户将不再继承此用户组的设备组及单设备访问权限。用户的账户及其直接授权不受影响。
          </p>
        </div>
      ),
      okText: '确认移除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: () => mutate(() => client.userGroups.removeUser(group.id, link.id), '移除成员'),
    });
  };

  const saveGroupPermission = async (value: { groupId: string; rights: number }) => {
    if (!client || !group) return;
    const target = groups.find((item) => item.id === value.groupId);
    if (!target) throw new Error('目标设备组已不存在。');
    const succeeded = await mutate(
      () => client.groups.setUserGroupRights(target.id, target.name, group.id, value.rights),
      '保存设备组权限',
    );
    if (succeeded) setGroupPermissionEditor(undefined);
  };

  const saveDevicePermission = async (value: { deviceId: string; rights: number }) => {
    if (!client || !group) return;
    const target = devices.find((item) => item.id === value.deviceId);
    if (!target) throw new Error('目标设备已不存在。');
    const succeeded = await mutate(
      () => client.devices.setUserGroupRights(target.id, target.name, group.id, value.rights),
      '保存设备权限',
    );
    if (succeeded) setDevicePermissionEditor(undefined);
  };

  // 成员表格列定义
  const memberColumns: TableColumnsType<UserGroupLink> = [
    {
      title: '用户',
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
              title="点击查看用户详情"
            >
              {displayName}
            </span>
          </Space>
        );
      },
    },
    {
      title: '真实姓名',
      width: 150,
      render: (_, link) => {
        const user = users.find((item) => item.id === link.id);
        return user?.realName || <span style={{ color: '#64748b' }}>—</span>;
      },
    },
    {
      title: '邮箱',
      width: 220,
      render: (_, link) => {
        const user = users.find((item) => item.id === link.id);
        return user?.email ? (
          <Space size={4}>
            <MailOutlined style={{ color: '#38bdf8' }} />
            <span>{user.email}</span>
          </Space>
        ) : (
          <span style={{ color: '#64748b' }}>未提供</span>
        );
      },
    },
    {
      title: '账户状态',
      width: 180,
      render: (_, link) => {
        const user = users.find((item) => item.id === link.id);
        if (!user) return <Tag>状态未知</Tag>;
        return (
          <Space size={4} wrap>
            <Tag color={user.locked ? 'error' : 'success'}>{user.locked ? '已锁定' : '正常'}</Tag>
            {isFullAdministrator(user.siteRights) ? <Tag color="blue">全站管理员</Tag> : null}
          </Space>
        );
      },
    },
    {
      title: '操作',
      width: 100,
      fixed: 'right',
      render: (_, link) => (
        <Tooltip title={!canWrite ? '无管理权限' : undefined}>
          <Button
            type="link"
            danger
            size="small"
            icon={<UserDeleteOutlined />}
            disabled={!canWrite}
            onClick={() => removeMember(link)}
          >
            移除
          </Button>
        </Tooltip>
      ),
    },
  ];

  // 权限列通用工厂
  const permissionColumns = (type: 'device-group' | 'device'): TableColumnsType<UserGroupLink> => [
    {
      title: type === 'device-group' ? '设备组' : '设备',
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
                  所属组：{(target as any).groupName}
                </div>
              ) : null}
            </div>
          </Space>
        );
      },
    },
    {
      title: '继承权限摘要',
      key: 'rights',
      width: 320,
      render: (_, link) => (
        <Tag color="blue" style={{ fontSize: 12, padding: '2px 8px' }}>
          <SafetyCertificateOutlined style={{ marginRight: 4 }} />
          {summarizeMeshRights(link.rights)}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      fixed: 'right',
      render: (_, link) => (
        <Space size="small">
          <Tooltip title={!canWrite ? '无管理权限' : undefined}>
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
              编辑权限
            </Button>
          </Tooltip>
          <Tooltip title={!canWrite ? '无管理权限' : undefined}>
            <Button
              type="link"
              danger
              size="small"
              disabled={!canWrite}
              onClick={() => {
                if (!client || !group) return;
                Modal.confirm({
                  title: type === 'device-group' ? '移除设备组授权' : '移除设备授权',
                  icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />,
                  content: '移除后，组内所有成员将不再通过此用户组继承该资源的访问权限。',
                  okText: '确认移除',
                  cancelText: '取消',
                  okButtonProps: { danger: true },
                  onOk: () =>
                    type === 'device-group'
                      ? mutate(
                          () => client.groups.removeUserGroup(link.id, group.id),
                          '移除设备组授权',
                        )
                      : mutate(
                          () => client.devices.removeUserGroup(link.id, group.id),
                          '移除设备授权',
                        ),
                });
              }}
            >
              移除
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
        aria-label="正在加载用户组详情"
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

        <span className="user-group-loading-announcement">正在加载用户组详情...</span>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="page-stack user-details-page">
        <nav className="user-detail-breadcrumb" aria-label="面包屑">
          <button onClick={() => navigate('/admin/roles')}>用户组</button>
          <span>›</span>
          <strong>加载失败</strong>
        </nav>
        <Alert
          type="error"
          showIcon
          message="用户组加载失败"
          description={loadError}
          action={<Button onClick={() => void loadDetails()}>重新加载</Button>}
        />
      </main>
    );
  }

  if (!group) {
    return (
      <Empty description="用户组不存在或已被删除" style={{ marginTop: 60 }}>
        <Button type="primary" onClick={() => navigate('/admin/roles')}>
          返回用户组列表
        </Button>
      </Empty>
    );
  }

  return (
    <main className="page-stack user-details-page">
      {messageContextHolder}

      {/* 面包屑导航 */}
      <nav className="user-detail-breadcrumb" aria-label="面包屑">
        <button onClick={() => navigate('/admin/roles')}>用户组</button>
        <span>›</span>
        <strong>{group.name}</strong>
      </nav>

      {!connected ? (
        <Alert
          type="warning"
          showIcon
          message="业务网关未连接"
          description="当前展示最近一次缓存的数据，所有修改及权限配置操作已暂时禁用。"
        />
      ) : null}
      {connected && !canManage ? (
        <Alert
          type="info"
          showIcon
          message="当前为只读模式"
          description="当前登录账户没有管理用户组权限，可查看成员和继承授权，但无法执行修改。"
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
              <Tag color="purple">用户组角色</Tag>
              {group.domain ? <Tag color="geekblue">{group.domain}</Tag> : <Tag>默认域</Tag>}
            </div>
            <div className="user-detail-subinfo">
              <span>{group.description || '暂无描述信息'}</span>
            </div>
            <div>
              <span className="user-group-id-badge" title="用户组系统标识">
                <IdcardOutlined />
                <span className="user-group-id-value">{group.id}</span>
                <Tooltip title="复制 ID">
                  <CopyOutlined className="user-group-id-copy" onClick={handleCopyId} />
                </Tooltip>
              </span>
            </div>
            <div className="user-detail-actions">
              <Button
                size="small"
                icon={<EditOutlined />}
                disabled={!canWrite}
                onClick={() => {
                  editForm.setFieldsValue({ name: group.name, description: group.description });
                  setEditOpen(true);
                }}
              >
                编辑资料
              </Button>
              <Button
                size="small"
                icon={<UserAddOutlined />}
                disabled={!canWrite}
                onClick={() => setMemberModalOpen(true)}
              >
                添加成员
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
                删除用户组
              </Button>
            </div>
          </div>
        </div>

        {/* 第二列：元数据指标网格 */}
        <div className="user-detail-meta-container">
          <div className="user-detail-meta-grid">
            <div className="user-detail-meta-item">
              <dt>
                <GlobalOutlined /> 所属域
              </dt>
              <dd>
                <span className="user-detail-meta-value">{group.domain || '默认域 (default)'}</span>
              </dd>
            </div>

            <div className="user-detail-meta-item">
              <dt>
                <TeamOutlined /> 组内成员
              </dt>
              <dd>
                <span className="user-detail-meta-value">{memberLinks.length} 名用户</span>
              </dd>
            </div>

            <div className="user-detail-meta-item">
              <dt>
                <ApartmentOutlined /> 设备组授权
              </dt>
              <dd>
                <span className="user-detail-meta-value">{groupLinks.length} 个设备组</span>
              </dd>
            </div>

            <div className="user-detail-meta-item">
              <dt>
                <DesktopOutlined /> 单设备授权
              </dt>
              <dd>
                <span className="user-detail-meta-value">{deviceLinks.length} 台设备</span>
              </dd>
            </div>

            <div className="user-detail-meta-item">
              <dt>
                <InfoCircleOutlined /> 属性标志
              </dt>
              <dd>
                <span className="user-detail-meta-value">
                  {group.flags === 0 ? '默认标志 (0)' : `Flags: ${group.flags}`}
                </span>
              </dd>
            </div>

            <div className="user-detail-meta-item">
              <dt>
                <SafetyCertificateOutlined /> 同意配置
              </dt>
              <dd>
                <span className="user-detail-meta-value">
                  {group.consent === 0 ? '未限制 (0)' : `Consent: ${group.consent}`}
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
              <span style={{ fontSize: 11, color: '#94a3b8' }}>继承策略下发总数</span>
              <div className="user-detail-sessions-count">
                <strong>{groupLinks.length + deviceLinks.length}</strong>
                <span className="user-detail-sessions-unit">项资源授权</span>
              </div>
              <div className="user-detail-sessions-status">
                <span className="user-detail-pulse-dot online" />
                <span style={{ fontSize: 12, color: '#34d399' }}>
                  为 {memberLinks.length} 名成员提供继承
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
                <LaptopOutlined /> 概览与继承机制
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
                      <small>组内成员规模</small>
                      <strong>{memberLinks.length} 人</strong>
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
                      <small>继承设备组授权</small>
                      <strong>{groupLinks.length} 个</strong>
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
                      <small>继承单设备授权</small>
                      <strong>{deviceLinks.length} 台</strong>
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
                      <strong>组内部分成员预览</strong>
                      <div className="toolbar-spacer" />
                      <Button type="link" size="small" onClick={() => setActiveTab('members')}>
                        查看全部 ({memberLinks.length})
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
                                {user?.email || (user?.locked ? '已锁定' : '正常')}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无成员" />
                    )}
                  </section>

                  <section className="console-card">
                    <div className="table-toolbar">
                      <strong>继承授权资源预览</strong>
                      <div className="toolbar-spacer" />
                      <Button type="link" size="small" onClick={() => setActiveTab('groups')}>
                        查看全部 ({groupLinks.length + deviceLinks.length})
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
                              <Tag color="green">设备组</Tag>
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
                              <Tag color="blue">单设备</Tag>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无授权配置" />
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
                <TeamOutlined /> 成员管理 ({memberLinks.length})
              </span>
            ),
            children: (
              <section className="console-card">
                <div className="table-toolbar">
                  <Input
                    className="user-group-tab-search"
                    placeholder="搜索成员姓名、用户名或邮箱"
                    prefix={<SearchOutlined />}
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    allowClear
                  />
                  <div className="toolbar-spacer" />
                  <Tag color="purple">
                    {filteredMemberLinks.length} / {memberLinks.length} 名成员
                  </Tag>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    disabled={!canWrite}
                    onClick={() => setMemberModalOpen(true)}
                  >
                    添加成员
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
                          memberLinks.length === 0 ? '该用户组暂无任何成员' : '没有匹配的成员'
                        }
                      >
                        {memberLinks.length === 0 && canWrite ? (
                          <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={() => setMemberModalOpen(true)}
                          >
                            立即添加成员
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
                <ApartmentOutlined /> 设备组继承权限 ({groupLinks.length})
              </span>
            ),
            children: (
              <section className="console-card">
                <div className="table-toolbar">
                  <Input
                    className="user-group-tab-search"
                    placeholder="搜索设备组名称或 ID"
                    prefix={<SearchOutlined />}
                    value={groupPermSearch}
                    onChange={(e) => setGroupPermSearch(e.target.value)}
                    allowClear
                  />
                  <div className="toolbar-spacer" />
                  <Tag color="green">
                    {filteredGroupLinks.length} / {groupLinks.length} 个设备组
                  </Tag>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    disabled={!canWrite}
                    onClick={() => setGroupPermissionEditor('new')}
                  >
                    添加设备组授权
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
                          groupLinks.length === 0 ? '暂无设备组继承权限' : '没有匹配的设备组'
                        }
                      >
                        {groupLinks.length === 0 && canWrite ? (
                          <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={() => setGroupPermissionEditor('new')}
                          >
                            配置首个设备组
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
                <DesktopOutlined /> 单设备继承权限 ({deviceLinks.length})
              </span>
            ),
            children: (
              <section className="console-card">
                <div className="table-toolbar">
                  <Input
                    className="user-group-tab-search"
                    placeholder="搜索单设备名称或 ID"
                    prefix={<SearchOutlined />}
                    value={devicePermSearch}
                    onChange={(e) => setDevicePermSearch(e.target.value)}
                    allowClear
                  />
                  <div className="toolbar-spacer" />
                  <Tag color="blue">
                    {filteredDeviceLinks.length} / {deviceLinks.length} 台设备
                  </Tag>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    disabled={!canWrite}
                    onClick={() => setDevicePermissionEditor('new')}
                  >
                    添加设备授权
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
                          deviceLinks.length === 0 ? '暂无单设备继承权限' : '没有匹配的设备'
                        }
                      >
                        {deviceLinks.length === 0 && canWrite ? (
                          <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={() => setDevicePermissionEditor('new')}
                          >
                            配置首台设备
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
            <span>添加成员到「{group.name}」</span>
          </Space>
        }
        open={memberModalOpen}
        onCancel={() => setMemberModalOpen(false)}
        onOk={() => void addMembers()}
        confirmLoading={submitting}
        okText={`添加 ${selectedUsernames.length > 0 ? `(${selectedUsernames.length})` : ''} 名成员`}
        okButtonProps={{ disabled: selectedUsernames.length === 0 }}
        destroyOnHidden
        width={560}
      >
        <p style={{ color: '#94a3b8', fontSize: 13 }}>
          请选择要加入本用户组的账户。加入后，成员将立即继承本用户组配置的全部设备组与单设备权限。
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
            可选用户：<strong>{availableUsers.length}</strong> 人 · 已选：
            <strong>{selectedUsernames.length}</strong> 人
          </span>
          <Space size="small">
            <Button
              size="small"
              onClick={() => setSelectedUsernames(availableUsers.map((u) => u.name))}
              disabled={availableUsers.length === 0}
            >
              全选
            </Button>
            <Button
              size="small"
              onClick={() => setSelectedUsernames([])}
              disabled={selectedUsernames.length === 0}
            >
              清空
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
          placeholder="搜索用户名、真实姓名或邮箱"
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
        title="编辑用户组资料"
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        onOk={() =>
          void editForm.validateFields().then(async (values) => {
            const succeeded = await mutate(
              () => client!.userGroups.update(group.id, values),
              '更新用户组',
            );
            if (succeeded) setEditOpen(false);
          })
        }
        confirmLoading={submitting}
        destroyOnHidden
      >
        <Form form={editForm} layout="vertical">
          <Form.Item
            label="用户组名称"
            name="name"
            rules={[
              { required: true, whitespace: true, message: '请输入用户组名称' },
              { max: 128, message: '名称不能超过 128 个字符' },
            ]}
          >
            <Input showCount maxLength={128} />
          </Form.Item>
          <Form.Item
            label="描述信息"
            name="description"
            rules={[{ max: 1024, message: '描述不能超过 1024 个字符' }]}
          >
            <Input.TextArea
              rows={4}
              showCount
              maxLength={1024}
              placeholder="描述用户组适用职责及授权范围"
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 删除用户组确认 Modal */}
      <Modal
        title={
          <Space>
            <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
            <span>删除用户组确认</span>
          </Space>
        }
        open={deleteOpen}
        onCancel={() => setDeleteOpen(false)}
        onOk={() =>
          void mutate(() => client!.userGroups.remove(group.id), '删除用户组').then((succeeded) => {
            if (succeeded) navigate('/admin/roles');
          })
        }
        confirmLoading={submitting}
        okText="永久删除"
        okButtonProps={{ danger: true, disabled: deleteConfirmation !== group.name }}
        destroyOnHidden
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Alert
            type="warning"
            showIcon
            message="此操作不可撤销"
            description={
              <div>
                删除该用户组后：
                <ul style={{ margin: '4px 0 0 0', paddingLeft: 20 }}>
                  <li>
                    <strong>{memberLinks.length}</strong> 名组成员将失去本组赋予的全部继承权限
                  </li>
                  <li>
                    <strong>{groupLinks.length}</strong> 个设备组授权与{' '}
                    <strong>{deviceLinks.length}</strong> 台设备授权将被一并清除
                  </li>
                </ul>
              </div>
            }
          />
          <p>
            请输入用户组名称 <strong>「{group.name}」</strong> 确认删除：
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
