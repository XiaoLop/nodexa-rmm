import { Result } from 'antd';
import { lazy, Suspense, type PropsWithChildren } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useMeshCentralControl } from '../features/gateway';
import {
  useApplicationUiCapabilities,
  type ApplicationCapability,
} from '../features/permissions/useUiCapabilities';
import { AppBootScreen, LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { appRoutes } from './appRoutes';

const AppLayout = lazy(() =>
  import('./AppLayout').then((module) => ({ default: module.AppLayout })),
);

const ComingSoonPage = lazy(() =>
  import('../pages/ComingSoonPage').then((module) => ({ default: module.ComingSoonPage })),
);
const NotFoundPage = lazy(() =>
  import('../pages/NotFoundPage').then((module) => ({ default: module.NotFoundPage })),
);

function ProtectedRoute({ children }: PropsWithChildren) {
  const gateway = useMeshCentralControl();
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
          {appRoutes.map(({ path, component: Page, capability }) => (
            <Route
              key={path}
              path={path}
              element={
                capability ? (
                  <RequireCapability capability={capability}>
                    <Page />
                  </RequireCapability>
                ) : (
                  <Page />
                )
              }
            />
          ))}
          <Route path="/devices/*" element={<ComingSoonPage />} />
          <Route path="/monitoring/audit" element={<Navigate to="/monitoring/reports" replace />} />
          <Route path="/monitoring/alerts" element={<NotFoundPage />} />
          <Route path="/monitoring/*" element={<ComingSoonPage />} />
          <Route path="/remote/*" element={<ComingSoonPage />} />
          <Route path="/admin/*" element={<ComingSoonPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
