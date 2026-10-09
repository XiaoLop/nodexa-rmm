import {
  ApartmentOutlined,
  AuditOutlined,
  DashboardOutlined,
  DesktopOutlined,
  FolderOpenOutlined,
  ProfileOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { TFunction } from 'i18next';
import { lazy, type ComponentType, type LazyExoticComponent, type ReactNode } from 'react';
import { matchPath } from 'react-router-dom';
import type { ApplicationCapability } from '../features/permissions/useUiCapabilities';

type AppPageComponent = LazyExoticComponent<ComponentType>;

export type AppNavigationGroup =
  | 'navigation.deviceManagement'
  | 'navigation.monitoringAndEvents'
  | 'navigation.administration';

export interface AppRouteDefinition {
  path: string;
  component: AppPageComponent;
  titleKeys: readonly [string, string];
  selectedKey?: string;
  capability?: ApplicationCapability;
  navigation?: {
    labelKey: string;
    icon: ReactNode;
    group?: AppNavigationGroup;
  };
}

function lazyPage<TModule, TKey extends keyof TModule>(
  loader: () => Promise<TModule>,
  exportName: TKey,
): AppPageComponent {
  return lazy(async () => {
    const module = await loader();
    return { default: module[exportName] as ComponentType };
  });
}

export const appRoutes: readonly AppRouteDefinition[] = [
  {
    path: '/dashboard',
    component: lazyPage(() => import('../pages/DashboardPage'), 'DashboardPage'),
    titleKeys: ['navigation.dashboard', 'navigation.overview'],
    navigation: {
      labelKey: 'navigation.dashboard',
      icon: <DashboardOutlined />,
    },
  },
  {
    path: '/profile',
    component: lazyPage(() => import('../pages/ProfilePage'), 'ProfilePage'),
    titleKeys: ['header.account', 'header.profile'],
  },
  {
    path: '/devices',
    component: lazyPage(() => import('../pages/DevicesPage'), 'DevicesPage'),
    titleKeys: ['navigation.deviceManagement', 'navigation.allDevices'],
    navigation: {
      labelKey: 'navigation.allDevices',
      icon: <DesktopOutlined />,
      group: 'navigation.deviceManagement',
    },
  },
  {
    path: '/devices/groups',
    component: lazyPage(() => import('../pages/DeviceGroupsPage'), 'DeviceGroupsPage'),
    titleKeys: ['navigation.deviceManagement', 'navigation.deviceGroups'],
    navigation: {
      labelKey: 'navigation.deviceGroups',
      icon: <ApartmentOutlined />,
      group: 'navigation.deviceManagement',
    },
  },
  {
    path: '/files',
    component: lazyPage(() => import('../pages/FilesPage'), 'FilesPage'),
    titleKeys: ['navigation.deviceManagement', 'navigation.serverFiles'],
    capability: 'serverFiles',
    navigation: {
      labelKey: 'navigation.serverFiles',
      icon: <FolderOpenOutlined />,
      group: 'navigation.deviceManagement',
    },
  },
  {
    path: '/devices/tasks',
    component: lazyPage(() => import('../pages/TasksPage'), 'TasksPage'),
    titleKeys: ['navigation.deviceManagement', 'navigation.taskCenter'],
    navigation: {
      labelKey: 'navigation.taskCenter',
      icon: <ProfileOutlined />,
      group: 'navigation.deviceManagement',
    },
  },
  {
    path: '/devices/:deviceId/workspace',
    component: lazyPage(() => import('../pages/DeviceWorkspacePage'), 'DeviceWorkspacePage'),
    titleKeys: ['navigation.deviceManagement', 'navigation.deviceWorkspace'],
    selectedKey: '/devices',
  },
  {
    path: '/monitoring/realtime',
    component: lazyPage(() => import('../pages/RealtimeEventsPage'), 'RealtimeEventsPage'),
    titleKeys: ['navigation.monitoringAndEvents', 'navigation.realtimeEvents'],
    navigation: {
      labelKey: 'navigation.realtimeEvents',
      icon: <AuditOutlined />,
      group: 'navigation.monitoringAndEvents',
    },
  },
  {
    path: '/monitoring/reports',
    component: lazyPage(() => import('../pages/ReportsPage'), 'ReportsPage'),
    titleKeys: ['navigation.monitoringAndEvents', 'navigation.reports'],
    navigation: {
      labelKey: 'navigation.reports',
      icon: <AuditOutlined />,
      group: 'navigation.monitoringAndEvents',
    },
  },
  {
    path: '/admin/users',
    component: lazyPage(() => import('../pages/UsersPage'), 'UsersPage'),
    titleKeys: ['navigation.administration', 'navigation.userManagement'],
    capability: 'manageUsers',
    navigation: {
      labelKey: 'navigation.userManagement',
      icon: <TeamOutlined />,
      group: 'navigation.administration',
    },
  },
  {
    path: '/admin/users/:userId',
    component: lazyPage(() => import('../pages/UserDetailsPage'), 'UserDetailsPage'),
    titleKeys: ['navigation.administration', 'navigation.userDetails'],
    selectedKey: '/admin/users',
    capability: 'manageUsers',
  },
  {
    path: '/admin/roles',
    component: lazyPage(() => import('../pages/UserGroupsPage'), 'UserGroupsPage'),
    titleKeys: ['navigation.administration', 'navigation.userGroups'],
    capability: 'manageUserGroups',
    navigation: {
      labelKey: 'navigation.userGroups',
      icon: <UserOutlined />,
      group: 'navigation.administration',
    },
  },
  {
    path: '/admin/roles/:userGroupId',
    component: lazyPage(() => import('../pages/UserGroupDetailsPage'), 'UserGroupDetailsPage'),
    titleKeys: ['navigation.administration', 'navigation.userGroupDetails'],
    selectedKey: '/admin/roles',
    capability: 'manageUserGroups',
  },
];

export const appNavigationGroups: readonly AppNavigationGroup[] = [
  'navigation.deviceManagement',
  'navigation.monitoringAndEvents',
  'navigation.administration',
];

export function resolvePageMeta(pathname: string, t: TFunction) {
  const route = appRoutes.find((candidate) => matchPath({ path: candidate.path, end: true }, pathname));
  if (!route) {
    return { selectedKey: pathname, title: t('navigation.console') };
  }
  return {
    selectedKey: route.selectedKey ?? route.path,
    title: `${t(route.titleKeys[0])} / ${t(route.titleKeys[1])}`,
  };
}