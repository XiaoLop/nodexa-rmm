import {
  ApartmentOutlined,
  AuditOutlined,
  DesktopOutlined,
  LaptopOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { Alert, Tabs } from 'antd';
import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { DeviceGroupPermissionModal } from '../components/users/DeviceGroupPermissionModal';
import { DevicePermissionModal } from '../components/users/DevicePermissionModal';
import { SitePermissionModal } from '../components/users/SitePermissionModal';
import { UserDetailsAccessTab } from '../components/users/UserDetailsAccessTab';
import { UserDetailsHeader } from '../components/users/UserDetailsHeader';
import { UserDetailsLogsTab } from '../components/users/UserDetailsLogsTab';
import { UserDetailsOverviewTab } from '../components/users/UserDetailsOverviewTab';
import {
  UserDetailsLoadErrorState,
  UserDetailsLoadingState,
  UserDetailsMissingState,
} from '../components/users/UserDetailsStates';
import { UserDetailsMeta } from '../components/users/UserDetailsSummary';
import { UserEditDrawer } from '../components/users/UserEditDrawer';
import { UserFeatureRestrictionModal } from '../components/users/UserFeatureRestrictionModal';
import { useMeshCentralControlData } from '../features/gateway';
import { resolveAccessRows, type AccessRow } from '../features/users/accessRows';
import { useUserDetails } from '../features/users/useUserDetails';
import '../assets/styles/user-details.css';

type DetailTab = 'overview' | 'device-groups' | 'user-groups' | 'shared-devices' | 'logs';

const tabs: Array<{ key: DetailTab; labelKey: string; icon: ReactNode }> = [
  { key: 'overview', labelKey: 'userDetails.tabs.overview', icon: <LaptopOutlined /> },
  { key: 'device-groups', labelKey: 'userDetails.tabs.deviceGroups', icon: <ApartmentOutlined /> },
  { key: 'user-groups', labelKey: 'userDetails.tabs.userGroups', icon: <TeamOutlined /> },
  { key: 'shared-devices', labelKey: 'userDetails.tabs.sharedDevices', icon: <DesktopOutlined /> },
  { key: 'logs', labelKey: 'userDetails.tabs.logs', icon: <AuditOutlined /> },
];

export function UserDetailsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { userId } = useParams<{ userId: string }>();
  const { client, status, devices, groups, userInfo } = useMeshCentralControlData();
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const details = useUserDetails({
    userId,
    client,
    status,
    devices,
    groups,
    userInfo,
    onDeleted: () => navigate('/admin/users'),
  });
  const { user, events, sessionCount, loading, loadError, isViewingCurrentUser } = details;

  const deviceGroupRows = useMemo(
    () => resolveAccessRows(user?.links ?? [], 'device-group', groups, t),
    [groups, t, user],
  );
  const userGroupRows = useMemo(
    () => resolveAccessRows(user?.links ?? [], 'user-group', details.userGroups, t),
    [details.userGroups, t, user],
  );
  const sharedDeviceRows = useMemo(
    () => resolveAccessRows(user?.links ?? [], 'device', devices, t),
    [devices, t, user],
  );

  const connected = status === 'connected';
  const online = sessionCount > 0;
  const deviceGroupManagementDisabled = !connected || isViewingCurrentUser;
  const isInitialLoading = !user && (loading || !connected);

  if (isInitialLoading) return <UserDetailsLoadingState />;
  if (loadError && !user) {
    return (
      <UserDetailsLoadErrorState
        error={loadError}
        retryDisabled={!connected}
        onRetry={() => void details.loadDetails()}
        onBack={() => navigate('/admin/users')}
      />
    );
  }
  if (!user) return <UserDetailsMissingState onBack={() => navigate('/admin/users')} />;

  const handleAddAccess = () => {
    if (deviceGroupManagementDisabled) return;
    if (activeTab === 'device-groups') details.setPermissionEditor('new');
    else if (activeTab === 'shared-devices') details.setDevicePermissionEditor('new');
  };
  const handleEditAccess = (row: AccessRow) => {
    if (deviceGroupManagementDisabled) return;
    if (activeTab === 'device-groups') details.setPermissionEditor({ groupId: row.id, rights: row.rights });
    else if (activeTab === 'shared-devices') details.setDevicePermissionEditor({ deviceId: row.id, rights: row.rights });
  };

  return (
    <main className="user-details-page page-stack">
      {details.messageContextHolder}
      {details.modalContextHolder}
      <nav className="user-detail-breadcrumb" aria-label={t('userDetails.breadcrumb')}>
        <button onClick={() => navigate('/admin/users')}>{t('navigation.userManagement')}</button><span>›</span><strong>{user.name}</strong>
      </nav>

      {loadError ? <Alert showIcon type="warning" title={t('userDetails.partialRefreshFailed')} description={loadError} /> : null}

      <section className="user-detail-hero">
        <UserDetailsHeader
          user={user}
          online={online}
          avatarRefreshKey={details.avatarRefreshKey}
          isViewingCurrentUser={isViewingCurrentUser}
          connected={connected}
          onEditProfile={() => details.setEditingProfile(true)}
          onOpenSitePermissions={() => details.setSitePermissionOpen(true)}
          onOpenFeatureRestrictions={() => details.setFeatureRestrictionOpen(true)}
          onLockChange={details.confirmLockChange}
          onDelete={details.confirmDeleteUser}
        />
        <UserDetailsMeta user={user} sessionCount={sessionCount} online={online} />
      </section>

      <Tabs
        className="console-tabs"
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as DetailTab)}
        destroyOnHidden
        items={tabs.map((tab) => ({
          key: tab.key,
          label: t(tab.labelKey),
          icon: tab.icon,
          children: tab.key === 'overview' ? (
            <div className="user-detail-overview">
              <UserDetailsOverviewTab deviceGroupRows={deviceGroupRows} userGroupRows={userGroupRows} sharedDeviceRows={sharedDeviceRows} events={events} devices={devices} />
            </div>
          ) : tab.key === 'logs' ? (
            <UserDetailsLogsTab events={events} devices={devices} />
          ) : (
            <UserDetailsAccessTab
              tab={tab.key} titleKey={tab.labelKey}
              rows={tab.key === 'device-groups' ? deviceGroupRows : tab.key === 'user-groups' ? userGroupRows : sharedDeviceRows}
              managementDisabled={deviceGroupManagementDisabled}
              onAdd={handleAddAccess} onEdit={handleEditAccess}
              onRemove={tab.key === 'device-groups' ? details.confirmDeviceGroupRemoval : details.confirmDevicePermissionRemoval}
            />
          ),
        }))}
      />

      <DeviceGroupPermissionModal
        open={Boolean(details.permissionEditor) && !deviceGroupManagementDisabled}
        groups={groups}
        currentGroupIds={deviceGroupRows.map((row) => row.id)}
        editing={details.permissionEditor && details.permissionEditor !== 'new' ? details.permissionEditor : undefined}
        submitting={details.permissionSubmitting}
        onCancel={() => details.setPermissionEditor(undefined)}
        onSubmit={details.saveDeviceGroupPermission}
      />
      <DevicePermissionModal
        subjectType="user"
        open={Boolean(details.devicePermissionEditor) && !deviceGroupManagementDisabled}
        groups={groups}
        devices={devices}
        currentDeviceIds={sharedDeviceRows.map((row) => row.id)}
        editing={details.devicePermissionEditor && details.devicePermissionEditor !== 'new' ? details.devicePermissionEditor : undefined}
        submitting={details.permissionSubmitting}
        onCancel={() => details.setDevicePermissionEditor(undefined)}
        onSubmit={details.saveDevicePermission}
      />
      <SitePermissionModal
        open={details.sitePermissionOpen && !isViewingCurrentUser}
        user={user}
        submitting={details.userMutationSubmitting}
        onCancel={() => details.setSitePermissionOpen(false)}
        onSubmit={details.saveSitePermissions}
      />
      <UserFeatureRestrictionModal
        open={details.featureRestrictionOpen && !isViewingCurrentUser}
        user={user}
        submitting={details.userMutationSubmitting}
        onCancel={() => details.setFeatureRestrictionOpen(false)}
        onSubmit={details.saveFeatureRestrictions}
      />
      <UserEditDrawer
        user={details.editingProfile ? user : undefined}
        submitting={details.userMutationSubmitting}
        onClose={() => details.setEditingProfile(false)}
        onSubmit={details.updateUser}
      />
    </main>
  );
}
