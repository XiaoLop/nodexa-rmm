import {
  GlobalOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { Button, Dropdown, Layout, Menu, Tooltip } from 'antd';
import type { MenuProps } from 'antd';
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
import { useMeshCentralControl } from '../features/gateway';
import { NotificationCenter } from '../features/notifications/NotificationCenter';
import { NotificationBell } from '../features/notifications/NotificationBell';
import { TaskCenterPopover } from '../features/tasks/TaskCenterPopover';
import { useApplicationUiCapabilities } from '../features/permissions/useUiCapabilities';
import { resolveLanguage, type AppLanguage } from '../i18n';
import { appNavigationGroups, appRoutes, resolvePageMeta } from './appRoutes';
import 'antd/dist/reset.css';

const { Header, Sider, Content } = Layout;

export function AppLayout() {
  return <AppLayoutContent />;
}

function AppLayoutContent() {
  const { t, i18n } = useTranslation();
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
    () => {
      const visibleRoutes = appRoutes.filter(
        (route) => route.navigation && (!route.capability || capabilities[route.capability]),
      );
      const standalone = visibleRoutes
        .filter((route) => !route.navigation?.group)
        .map((route) => ({
          key: route.path,
          icon: route.navigation?.icon,
          label: t(route.navigation?.labelKey ?? ''),
        }));
      const groups = appNavigationGroups.flatMap<NonNullable<MenuProps['items']>[number]>(
        (group) => {
          const children = visibleRoutes
            .filter((route) => route.navigation?.group === group)
            .map((route) => ({
              key: route.path,
              icon: route.navigation?.icon,
              label: t(route.navigation?.labelKey ?? ''),
            }));
          return children.length > 0 ? [{ type: 'group', label: t(group), children }] : [];
        },
      );
      return [...standalone, ...groups];
    },
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
        collapsed={desktopCollapsed && !mobileMenuOpen}
        width={220}
        collapsedWidth={72}
        className={`app-sider ${mobileMenuOpen ? 'is-mobile-open' : ''}`}
        trigger={null}
      >
        <div className="sider-brand">
          <BrandLogo compact={desktopCollapsed && !mobileMenuOpen} variant="sidebar" />
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[pageMeta.selectedKey]}
          onClick={({ key }) => {
            navigate(key);
            setMobileMenuOpen(false);
          }}
          items={visibleMenuItems}
          className="console-menu"
        />
        <button
          type="button"
          className="sider-collapse"
          onClick={() => {
            if (mobileMenuOpen) setMobileMenuOpen(false);
            else setDesktopCollapsed((value) => !value);
          }}
        >
          {desktopCollapsed && !mobileMenuOpen ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          {(!desktopCollapsed || mobileMenuOpen) && <span>{t('navigation.collapseMenu')}</span>}
        </button>
      </Sider>
      {mobileMenuOpen && (
        <button
          type="button"
          className="mobile-menu-backdrop"
          aria-label={t('navigation.collapseMenu')}
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      <Layout className="console-main">
        <Header className="app-header">
          <div className="header-left">
            <Button
              type="text"
              className="mobile-menu-button"
              icon={mobileMenuOpen ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
              aria-label={t('navigation.collapseMenu')}
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((value) => !value)}
            />
            <span className="breadcrumb-title">{pageMeta.title}</span>
          </div>
          <div className="header-actions">
            <Button
              type="text"
              icon={<SearchOutlined />}
              className="global-search"
              aria-label={t('header.searchPlaceholder')}
              onClick={() => {
                navigate('/devices');
                setMobileMenuOpen(false);
              }}
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
            <TaskCenterPopover />
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
