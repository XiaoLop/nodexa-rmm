import type { PropsWithChildren } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useGateway } from '../features/gateway/GatewayProvider';
import { ComingSoonPage } from '../pages/ComingSoonPage';
import { DashboardPage } from '../pages/DashboardPage';
import { DeviceGroupsPage } from '../pages/DeviceGroupsPage';
import { DevicesPage } from '../pages/DevicesPage';
import { AppBootScreen, LoginPage } from '../pages/LoginPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { AppLayout } from './AppLayout';

function ProtectedRoute({ children }: PropsWithChildren) {
  const gateway = useGateway();
  const location = useLocation();
  if (gateway.initializing) return <AppBootScreen />;
  if (!gateway.authenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return children;
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/devices" element={<DevicesPage />} />
        <Route path="/devices/groups" element={<DeviceGroupsPage />} />
        <Route path="/devices/*" element={<ComingSoonPage />} />
        <Route path="/monitoring/*" element={<ComingSoonPage />} />
        <Route path="/remote/*" element={<ComingSoonPage />} />
        <Route path="/admin/*" element={<ComingSoonPage />} />
        <Route path="/settings/*" element={<ComingSoonPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
