import {
  ApartmentOutlined,
  AuditOutlined,
  BellOutlined,
  DashboardOutlined,
  DesktopOutlined,
  GlobalOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ProfileOutlined,
  QuestionCircleOutlined,
  SearchOutlined,
  SettingOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Badge, Button, Dropdown, Input, Layout, Menu, Tooltip } from 'antd';
import type { MenuProps } from 'antd';
import type { TFunction } from 'i18next';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { isFullAdministrator } from '@meshcentral/control-client';
import {
  meshCentralControlSelectors,
  getUserDisplayName,
  useMeshCentralControlStore,
} from '@meshcentral/shared-state';
import { BrandLogo } from '../components/BrandLogo';
import { UserAvatar } from '../components/users/UserAvatar';
import { useMeshCentralControl } from '../features/gateway/MeshCentralControlProvider';
import { NotificationCenter } from '../features/notifications/NotificationCenter';
import { NotificationBell } from '../features/notifications/NotificationBell';
import { useBatchTasks } from '../features/tasks/BatchTaskContext';
import {
  useApplicationUiCapabilities,
  type ApplicationCapability,
} from '../features/permissions/useUiCapabilities';
import { resolveLanguage, type AppLanguage } from '../i18n';
import 'antd/dist/reset.css';
import '../assets/styles/layout.css';

const { Header, Sider, Content } = Layout;

type NavigationItem = {
  key: string;
  icon: React.ReactNode;
  labelKey: string;
  required?: ApplicationCapability;
};

type NavigationGroup = {
  type: 'group';
  labelKey: string;
  children: NavigationItem[];
};

const menuItems: Array<NavigationItem | NavigationGroup> = [
  { key: '/dashboard', icon: <DashboardOutlined />, labelKey: 'navigation.dashboard' },
  {
    type: 'group' as const,
    labelKey: 'navigation.deviceManagement',
    children: [
      { key: '/devices', icon: <DesktopOutlined />, labelKey: 'navigation.allDevices' },
      {
        key: '/devices/groups',
        icon: <ApartmentOutlined />,
        labelKey: 'navigation.deviceGroups',
      },
      {
        key: '/devices/tasks',
        icon: <ProfileOutlined />,
        labelKey: 'navigation.taskCenter',
      },
    ],
  },
  {
    type: 'group' as const,
    labelKey: 'navigation.monitoringAndEvents',
    children: [
      {
        key: '/monitoring/realtime',
        icon: <ThunderboltOutlined />,
        labelKey: 'navigation.realtimeEvents',
      },
      {
        key: '/monitoring/alerts',
        icon: <BellOutlined />,
        labelKey: 'navigation.alertRules',
      },
      {
        key: '/monitoring/audit',
        icon: <AuditOutlined />,
        labelKey: 'navigation.auditLogs',
        required: 'viewAllEvents',
      },
    ],
  },
  {
    type: 'group' as const,
    labelKey: 'navigation.administration',
    children: [
      {
        key: '/admin/users',
        icon: <TeamOutlined />,
        labelKey: 'navigation.userManagement',
        required: 'manageUsers',
      },
      {
        key: '/admin/roles',
        icon: <UserOutlined />,
        labelKey: 'navigation.userGroups',
        required: 'manageUserGroups',
      },
      {
        key: '/settings',
        icon: <SettingOutlined />,
        labelKey: 'navigation.settings',
        required: 'manageSettings',
      },
    ],
  },
];

const pageTitleKeys: Record<string, [string, string]> = {
  '/dashboard': ['navigation.dashboard', 'navigation.overview'],
  '/profile': ['header.account', 'header.profile'],
  '/devices': ['navigation.deviceManagement', 'navigation.allDevices'],
  '/devices/groups': ['navigation.deviceManagement', 'navigation.deviceGroups'],
  '/devices/tasks': ['navigation.deviceManagement', 'navigation.taskCenter'],
  '/monitoring/realtime': ['navigation.monitoringAndEvents', 'navigation.realtimeEvents'],
  '/monitoring/alerts': ['navigation.monitoringAndEvents', 'navigation.alertRules'],
  '/monitoring/audit': ['navigation.monitoringAndEvents', 'navigation.auditLogs'],
  '/admin/users': ['navigation.administration', 'navigation.userManagement'],
  '/admin/roles': ['navigation.administration', 'navigation.userGroups'],
  '/settings': ['navigation.administration', 'navigation.settings'],
};

function resolvePageMeta(pathname: string, t: TFunction) {
  if (/^\/devices\/[^/]+\/workspace$/.test(pathname)) {
    return {
      selectedKey: '/devices',
      title: `${t('navigation.deviceManagement')} / ${t('navigation.deviceWorkspace')}`,
    };
  }
  if (/^\/admin\/users\/[^/]+$/.test(pathname)) {
    return {
      selectedKey: '/admin/users',
      title: `${t('navigation.administration')} / ${t('navigation.userDetails')}`,
    };
  }
  if (/^\/admin\/roles\/[^/]+$/.test(pathname)) {
    return {
      selectedKey: '/admin/roles',
      title: `${t('navigation.administration')} / ${t('navigation.userGroupDetails')}`,
    };
  }
  const selectedKey = Object.keys(pageTitleKeys).find((key) => pathname === key) ?? pathname;
  const titleKeys = pageTitleKeys[selectedKey];
  return {
    selectedKey,
    title: titleKeys ? `${t(titleKeys[0])} / ${t(titleKeys[1])}` : t('navigation.console'),
  };
}

export function AppLayout() {
  return <AppLayoutContent />;
}

function AppLayoutContent() {
  const { t, i18n } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const gateway = useMeshCentralControl();
  const status = useMeshCentralControlStore(gateway.store, meshCentralControlSelectors.status);
  const userInfo = useMeshCentralControlStore(gateway.store, meshCentralControlSelectors.userInfo);
  const devices = useMeshCentralControlStore(gateway.store, meshCentralControlSelectors.devices);
  const unreadCount = useMeshCentralControlStore(
    gateway.store,
    meshCentralControlSelectors.unreadCount,
  );
  const { activeCount, unviewedCompletedCount } = useBatchTasks();
  const { username, logout } = gateway;
  const displayName = getUserDisplayName(userInfo, username);
  const capabilities = useApplicationUiCapabilities();
  const connected = status === 'connected';
  const language = resolveLanguage(i18n.resolvedLanguage);
  const pageMeta = useMemo(
    () => resolvePageMeta(location.pathname, t),
    [i18n.resolvedLanguage, location.pathname, t],
  );
  const visibleMenuItems = useMemo<NonNullable<MenuProps['items']>>(
    () =>
      menuItems.flatMap<NonNullable<MenuProps['items']>[number]>((item) => {
        if ('type' in item) {
          const children = item.children.filter(
            (child) => !child.required || capabilities[child.required],
          );
          return children.length > 0
            ? [
                {
                  type: item.type,
                  label: t(item.labelKey),
                  children: children.map((child) => ({
                    key: child.key,
                    icon: child.icon,
                    label: t(child.labelKey),
                  })),
                },
              ]
            : [];
        }
        return !item.required || capabilities[item.required]
          ? [{ key: item.key, icon: item.icon, label: t(item.labelKey) }]
          : [];
      }),
    [capabilities, i18n.resolvedLanguage, t],
  );

  const changeLanguage = (nextLanguage: AppLanguage) => {
    void i18n.changeLanguage(nextLanguage);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <Layout className="app-shell">
      <Sider
        collapsed={collapsed}
        width={220}
        collapsedWidth={72}
        className="app-sider"
        trigger={null}
      >
        <div className="sider-brand">
          <BrandLogo compact={collapsed} />
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[pageMeta.selectedKey]}
          onClick={({ key }) => navigate(key)}
          items={visibleMenuItems}
          className="console-menu"
        />
        <button className="sider-collapse" onClick={() => setCollapsed((value) => !value)}>
          {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          {!collapsed && <span>{t('navigation.collapseMenu')}</span>}
        </button>
      </Sider>
      <Layout className="console-main">
        <Header className="app-header">
          <div className="header-left">
            <Button
              type="text"
              className="mobile-menu-button"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed((value) => !value)}
            />
            <span className="breadcrumb-title">{pageMeta.title}</span>
          </div>
          <div className="header-actions">
            <Input
              prefix={<SearchOutlined />}
              placeholder={t('header.searchPlaceholder')}
              className="global-search"
            />
            <Tooltip
              title={connected ? t('header.controlConnected') : t('header.gatewayDisconnected')}
            >
              <span className={`header-connection ${connected ? 'is-connected' : ''}`}>
                <i />
              </span>
            </Tooltip>
            <Dropdown
              menu={{
                selectedKeys: [language],
                selectable: true,
                items: [
                  {
                    key: 'zh-CN',
                    label: t('common.simplifiedChinese'),
                    onClick: () => changeLanguage('zh-CN'),
                  },
                  {
                    key: 'en-US',
                    label: t('common.english'),
                    onClick: () => changeLanguage('en-US'),
                  },
                ],
              }}
              trigger={['click']}
            >
              <Button type="text" icon={<GlobalOutlined />} aria-label={t('common.language')} />
            </Dropdown>
            <NotificationBell
              unreadCount={unreadCount}
              label={t('header.notifications')}
              unreadLabel={t('notifications.unreadDescription', { count: unreadCount })}
              onOpen={() => setNotificationCenterOpen(true)}
            />
            <Tooltip title={t('navigation.taskCenter')}>
              <Badge
                count={activeCount}
                dot={!activeCount && unviewedCompletedCount > 0}
                size="small"
              >
                <Button
                  type="text"
                  icon={<ProfileOutlined />}
                  aria-label={t('taskCenter.open')}
                  onClick={() => navigate('/devices/tasks')}
                />
              </Badge>
            </Tooltip>
            <Button type="text" icon={<QuestionCircleOutlined />} aria-label={t('header.help')} />
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'profile',
                    label: t('header.profile'),
                    onClick: () => navigate('/profile'),
                  },
                  { type: 'divider' },
                  { key: 'logout', label: t('header.logout'), danger: true, onClick: handleLogout },
                ],
              }}
              trigger={['click']}
            >
              <button className="user-menu">
                <UserAvatar
                  username={userInfo?.name ?? userInfo?.id.replace(/^user\/\//, '')}
                  src={userInfo?.image}
                  hasImage={Boolean(userInfo?.image || userInfo?.hasImage)}
                />
                <span>
                  <strong>{displayName}</strong>
                  <small>
                    {userInfo?.siteadmin !== undefined && isFullAdministrator(userInfo.siteadmin)
                      ? t('header.siteAdministrator')
                      : t('header.consoleUser')}
                  </small>
                </span>
              </button>
            </Dropdown>
          </div>
        </Header>
        <Content className="app-content">
          <Outlet />
        </Content>
      </Layout>
      <NotificationCenter
        open={notificationCenterOpen}
        onClose={() => setNotificationCenterOpen(false)}
        store={gateway.store}
        client={gateway.client}
        devices={devices}
      />
    </Layout>
  );
}
