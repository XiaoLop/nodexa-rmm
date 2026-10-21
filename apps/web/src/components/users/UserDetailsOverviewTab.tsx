import { ApartmentOutlined, DesktopOutlined, TeamOutlined } from '@ant-design/icons';
import type { Device, MeshCentralEvent } from '@meshcentral/control-client';
import { useTranslation } from 'react-i18next';
import type { AccessRow } from '../../features/users/accessRows';
import { AccessCard } from './UserDetailsAccessTab';
import { EventTable } from './UserDetailsLogsTab';
import { UserDetailsSummaryCards } from './UserDetailsSummary';

interface UserDetailsOverviewTabProps {
  deviceGroupRows: AccessRow[];
  userGroupRows: AccessRow[];
  sharedDeviceRows: AccessRow[];
  events: MeshCentralEvent[];
  devices: Device[];
}

/** Overview tab: summary counts, read-only access cards and recent events. */
export function UserDetailsOverviewTab({
  deviceGroupRows,
  userGroupRows,
  sharedDeviceRows,
  events,
  devices,
}: UserDetailsOverviewTabProps) {
  const { t } = useTranslation();
  return (
    <>
      <UserDetailsSummaryCards
        deviceGroupCount={deviceGroupRows.length}
        userGroupCount={userGroupRows.length}
        sharedDeviceCount={sharedDeviceRows.length}
      />
      <section className="user-detail-access-grid">
        <AccessCard constrained icon={<ApartmentOutlined />} title={t('userDetails.tabs.deviceGroups')} rows={deviceGroupRows} tone="blue-text" />
        <AccessCard constrained icon={<TeamOutlined />} title={t('userDetails.tabs.userGroups')} rows={userGroupRows} tone="purple-text" />
        <AccessCard constrained icon={<DesktopOutlined />} title={t('userDetails.tabs.sharedDevices')} rows={sharedDeviceRows} tone="blue-text" />
      </section>
      <EventTable events={events.slice(0, 10)} devices={devices} />
    </>
  );
}
