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
import { Avatar, Badge, Button, Dropdown, Input, Layout, Menu, Tooltip } from 'antd';
import { useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { isFullAdministrator } from '@meshcentral/control-client';
import { gatewaySelectors, getUserDisplayName, useGatewayStore } from '@meshcentral/shared-state';
import { BrandLogo } from '../components/ConsoleUi';
import { useGateway } from '../features/gateway/GatewayProvider';

const { Header, Sider, Content } = Layout;

const menuItems = [
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
      { key: '/monitoring/audit', icon: <AuditOutlined />, label: '审计日志' },
    ],
  },
  {
    type: 'group' as const,
    label: '管理',
    children: [
      { key: '/admin/users', icon: <TeamOutlined />, label: '用户管理' },
      { key: '/admin/roles', icon: <UserOutlined />, label: '角色与权限' },
      { key: '/settings', icon: <SettingOutlined />, label: '设置' },
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
  '/admin/roles': '管理 / 角色与权限',
  '/settings': '管理 / 设置',
};

function resolvePageMeta(pathname: string) {
  if (/^\/devices\/[^/]+\/workspace$/.test(pathname)) {
    return { selectedKey: '/devices', title: '设备管理 / 设备工作台' };
  }
  const selectedKey = Object.keys(pageTitles).find((key) => pathname === key) ?? pathname;
  return { selectedKey, title: pageTitles[selectedKey] ?? 'MeshCentral 控制台' };
}

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const gateway = useGateway();
  const status = useGatewayStore(gateway.store, gatewaySelectors.status);
  const userInfo = useGatewayStore(gateway.store, gatewaySelectors.userInfo);
  const { username, logout } = gateway;
  const displayName = getUserDisplayName(userInfo, username);
  const connected = status === 'connected';
  const pageMeta = useMemo(() => resolvePageMeta(location.pathname), [location.pathname]);

  const handleLogout = () => {
    logout();
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
          items={menuItems}
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
