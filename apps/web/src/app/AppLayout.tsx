import {
  ApartmentOutlined,
  AuditOutlined,
  BellOutlined,
  DashboardOutlined,
  DesktopOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  QuestionCircleOutlined,
  SearchOutlined,
  SettingOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  App as AntApp,
  Avatar,
  Badge,
  Button,
  ConfigProvider,
  Dropdown,
  Input,
  Layout,
  Menu,
  Tooltip,
  theme,
} from 'antd';
import { useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { isFullAdministrator } from '@meshcentral/control-client';
import { gatewaySelectors, getUserDisplayName, useGatewayStore } from '@meshcentral/shared-state';
import { BrandLogo } from '../components/BrandLogo';
import { useGateway } from '../features/gateway/GatewayProvider';
import {
  useApplicationUiCapabilities,
  type ApplicationCapability,
} from '../features/permissions/useUiCapabilities';
import 'antd/dist/reset.css';
import '../assets/styles/layout.css';

const { Header, Sider, Content } = Layout;

type NavigationItem = {
  key: string;
  icon: React.ReactNode;
  label: string;
  required?: ApplicationCapability;
};

type NavigationGroup = {
  type: 'group';
  label: string;
  children: NavigationItem[];
};

const menuItems: Array<NavigationItem | NavigationGroup> = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '仪表盘' },
  {
    type: 'group' as const,
    label: '设备管理',
    children: [
      { key: '/devices', icon: <DesktopOutlined />, label: '所有设备' },
      { key: '/devices/groups', icon: <ApartmentOutlined />, label: '设备分组' },
    ],
  },
  {
    type: 'group' as const,
    label: '监控与事件',
    children: [
      { key: '/monitoring/realtime', icon: <ThunderboltOutlined />, label: '实时事件' },
      { key: '/monitoring/alerts', icon: <BellOutlined />, label: '告警规则' },
      {
        key: '/monitoring/audit',
        icon: <AuditOutlined />,
        label: '审计日志',
        required: 'viewAllEvents',
      },
    ],
  },
  {
    type: 'group' as const,
    label: '管理',
    children: [
      {
        key: '/admin/users',
        icon: <TeamOutlined />,
        label: '用户管理',
        required: 'manageUsers',
      },
      {
        key: '/admin/roles',
        icon: <UserOutlined />,
        label: '用户组',
        required: 'manageUserGroups',
      },
      {
        key: '/settings',
        icon: <SettingOutlined />,
        label: '设置',
        required: 'manageSettings',
      },
    ],
  },
];

const pageTitles: Record<string, string> = {
  '/dashboard': '仪表盘 / 概览',
  '/devices': '设备管理 / 所有设备',
  '/devices/groups': '设备管理 / 设备分组',
  '/monitoring/realtime': '监控与事件 / 实时事件',
  '/monitoring/alerts': '监控与事件 / 告警规则',
  '/monitoring/audit': '监控与事件 / 审计日志',
  '/admin/users': '管理 / 用户管理',
  '/admin/roles': '管理 / 用户组',
  '/settings': '管理 / 设置',
};

function resolvePageMeta(pathname: string) {
  if (/^\/devices\/[^/]+\/workspace$/.test(pathname)) {
    return { selectedKey: '/devices', title: '设备管理 / 设备工作台' };
  }
  if (/^\/admin\/users\/[^/]+$/.test(pathname)) {
    return { selectedKey: '/admin/users', title: '管理 / 用户详情' };
  }
  if (/^\/admin\/roles\/[^/]+$/.test(pathname)) {
    return { selectedKey: '/admin/roles', title: '管理 / 用户组详情' };
  }
  const selectedKey = Object.keys(pageTitles).find((key) => pathname === key) ?? pathname;
  return { selectedKey, title: pageTitles[selectedKey] ?? 'MeshCentral 控制台' };
}

export function AppLayout() {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#2f80ff',
          colorInfo: '#2f80ff',
          colorSuccess: '#2dcc70',
          colorWarning: '#f4b43c',
          colorError: '#ff5364',
          colorBgBase: '#09111d',
          colorBgContainer: '#111c2a',
          colorBorder: '#243348',
          colorText: '#f1f5fb',
          colorTextSecondary: '#8c9bb0',
          borderRadius: 6,
          fontFamily: 'Inter, "Segoe UI", sans-serif',
        },
        components: {
          Button: { controlHeightLG: 46, fontWeight: 600 },
          Card: { colorBgContainer: '#111c2a' },
          Drawer: { colorBgElevated: '#111c2a' },
          Input: { activeBorderColor: '#2f80ff', hoverBorderColor: '#3c8bff' },
          Layout: { headerBg: '#0b1421', siderBg: '#0d1725' },
          Menu: { darkItemBg: '#0d1725', darkItemSelectedBg: '#1d3555', itemBorderRadius: 5 },
          Modal: {
            contentBg: '#111c2a',
            footerBg: '#111c2a',
            headerBg: '#111c2a',
          },
          Table: { headerBg: '#101a27', headerColor: '#c9d4e3', borderColor: '#243348' },
        },
      }}
    >
      <AntApp>
        <AppLayoutContent />
      </AntApp>
    </ConfigProvider>
  );
}

function AppLayoutContent() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const gateway = useGateway();
  const status = useGatewayStore(gateway.store, gatewaySelectors.status);
  const userInfo = useGatewayStore(gateway.store, gatewaySelectors.userInfo);
  const { username, logout } = gateway;
  const displayName = getUserDisplayName(userInfo, username);
  const capabilities = useApplicationUiCapabilities();
  const connected = status === 'connected';
  const pageMeta = useMemo(() => resolvePageMeta(location.pathname), [location.pathname]);
  const visibleMenuItems = useMemo(
    () =>
      menuItems.flatMap<NavigationItem | NavigationGroup>((item) => {
        if ('type' in item) {
          const children = item.children.filter(
            (child) => !child.required || capabilities[child.required],
          );
          return children.length > 0 ? [{ ...item, children }] : [];
        }
        return !item.required || capabilities[item.required] ? [item] : [];
      }),
    [capabilities],
  );

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
          {!collapsed && <span>收起菜单</span>}
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
              placeholder="搜索设备、用户、ID..."
              className="global-search"
            />
            <Tooltip title={connected ? '业务网关已连接' : '业务网关未连接'}>
              <span className={`header-connection ${connected ? 'is-connected' : ''}`}>
                <i />
              </span>
            </Tooltip>
            <Badge count={0} size="small">
              <Button type="text" icon={<BellOutlined />} aria-label="通知" />
            </Badge>
            <Button type="text" icon={<QuestionCircleOutlined />} aria-label="帮助" />
            <Dropdown
              menu={{
                items: [
                  { key: 'profile', label: '个人资料', disabled: true },
                  { type: 'divider' },
                  { key: 'logout', label: '退出登录', danger: true, onClick: handleLogout },
                ],
              }}
              trigger={['click']}
            >
              <button className="user-menu">
                <Avatar icon={<UserOutlined />} />
                <span>
                  <strong>{displayName}</strong>
                  <small>
                    {userInfo?.siteadmin !== undefined && isFullAdministrator(userInfo.siteadmin)
                      ? '站点管理员'
                      : '控制台用户'}
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
    </Layout>
  );
}
