import { Result } from 'antd';
import { lazy, Suspense, type PropsWithChildren } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useGateway } from '../features/gateway/GatewayProvider';
import {
  useApplicationUiCapabilities,
  type ApplicationCapability,
} from '../features/permissions/useUiCapabilities';
import { AppBootScreen, LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';

const AppLayout = lazy(() =>
  import('./AppLayout').then((module) => ({ default: module.AppLayout })),
);

const ComingSoonPage = lazy(() =>
  import('../pages/ComingSoonPage').then((module) => ({ default: module.ComingSoonPage })),
);
const DashboardPage = lazy(() =>
  import('../pages/DashboardPage').then((module) => ({ default: module.DashboardPage })),
);
const DeviceGroupsPage = lazy(() =>
  import('../pages/DeviceGroupsPage').then((module) => ({ default: module.DeviceGroupsPage })),
);
const DeviceWorkspacePage = lazy(() =>
  import('../pages/DeviceWorkspacePage').then((module) => ({
    default: module.DeviceWorkspacePage,
  })),
);
const DevicesPage = lazy(() =>
  import('../pages/DevicesPage').then((module) => ({ default: module.DevicesPage })),
);
const NotFoundPage = lazy(() =>
  import('../pages/NotFoundPage').then((module) => ({ default: module.NotFoundPage })),
);
const ProfilePage = lazy(() =>
  import('../pages/ProfilePage').then((module) => ({ default: module.ProfilePage })),
);
const RealtimeEventsPage = lazy(() =>
  import('../pages/RealtimeEventsPage').then((module) => ({ default: module.RealtimeEventsPage })),
);
const UserDetailsPage = lazy(() =>
  import('../pages/UserDetailsPage').then((module) => ({ default: module.UserDetailsPage })),
);
const UserGroupDetailsPage = lazy(() =>
  import('../pages/UserGroupDetailsPage').then((module) => ({
    default: module.UserGroupDetailsPage,
  })),
);
const UserGroupsPage = lazy(() =>
  import('../pages/UserGroupsPage').then((module) => ({ default: module.UserGroupsPage })),
);
const UsersPage = lazy(() =>
  import('../pages/UsersPage').then((module) => ({ default: module.UsersPage })),
);

function ProtectedRoute({ children }: PropsWithChildren) {
  const gateway = useGateway();
  const location = useLocation();
  if (gateway.initializing) return <AppBootScreen />;
  if (!gateway.authenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return children;
}

function RequireCapability({
  capability,
  children,
}: PropsWithChildren<{ capability: ApplicationCapability }>) {
  const { t } = useTranslation();
  const capabilities = useApplicationUiCapabilities();
  if (!capabilities[capability]) {
    return (
      <Result
        status="403"
        title={t('common.noAccess')}
        subTitle={t('common.noAccessDescription')}
      />
    );
  }
  return children;
}

export function AppRouter() {
  return (
    <Suspense fallback={<AppBootScreen />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/devices" element={<DevicesPage />} />
          <Route path="/devices/groups" element={<DeviceGroupsPage />} />
          <Route path="/devices/:deviceId/workspace" element={<DeviceWorkspacePage />} />
          <Route path="/devices/*" element={<ComingSoonPage />} />
          <Route path="/monitoring/realtime" element={<RealtimeEventsPage />} />
          <Route
            path="/monitoring/audit"
            element={
              <RequireCapability capability="viewAllEvents">
                <ComingSoonPage />
              </RequireCapability>
            }
          />
          <Route path="/monitoring/*" element={<ComingSoonPage />} />
          <Route path="/remote/*" element={<ComingSoonPage />} />
          <Route
            path="/admin/users"
            element={
              <RequireCapability capability="manageUsers">
                <UsersPage />
              </RequireCapability>
            }
          />
          <Route
            path="/admin/users/:userId"
            element={
              <RequireCapability capability="manageUsers">
                <UserDetailsPage />
              </RequireCapability>
            }
          />
          <Route
            path="/admin/roles"
            element={
              <RequireCapability capability="manageUserGroups">
                <UserGroupsPage />
              </RequireCapability>
            }
          />
          <Route
            path="/admin/roles/:userGroupId"
            element={
              <RequireCapability capability="manageUserGroups">
                <UserGroupDetailsPage />
              </RequireCapability>
            }
          />
          <Route path="/admin/*" element={<ComingSoonPage />} />
          <Route
            path="/settings/*"
            element={
              <RequireCapability capability="manageSettings">
                <ComingSoonPage />
              </RequireCapability>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
