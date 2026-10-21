import type { Device } from '@meshcentral/shared-state';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { DeviceHeaderActions } from '../components/devices/DeviceHeaderActions';
import { DeviceListModals } from '../components/devices/DeviceListModals';
import { DeviceTable } from '../components/devices/DeviceTable';
import { DeviceToolbar } from '../components/devices/DeviceToolbar';
import { PageHeader, Panel } from '../components/ui';
import { useApplicationUiCapabilities } from '../features/permissions/useUiCapabilities';
import { useDeviceActions } from '../features/devices/useDeviceActions';
import { useDeviceList } from '../features/devices/useDeviceList';
import '../assets/styles/commands.css';
import '../assets/styles/device-details.css';
import '../assets/styles/devices.css';

export function DevicesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const applicationCapabilities = useApplicationUiCapabilities();
  const {
    data: {
      devices,
      userInfo,
      serverInfo,
      status,
      client,
      sortedGroups,
      groupNameById,
      platforms,
      filteredDevices,
      selectedDevices,
      selectedCapabilities,
      commandTargets,
      fileTargets,
      refreshSnapshot,
    },
    filters,
    selection,
    pagination,
    capabilities: deviceCapabilities,
    compareDeviceName,
  } = useDeviceList();
  const connected = status === 'connected';
  const actions = useDeviceActions({
    client,
    connected,
    devices,
    selectedDeviceIds: selection.selectedDeviceIds,
    selectedDevices,
    selectedCapabilities,
    deviceCapabilities,
    refreshSnapshot,
    clearSelection: selection.clearSelection,
    removeSelectedDeviceIds: selection.removeSelectedDeviceIds,
  });

  const openWorkspace = useCallback(
    (device: Device) => navigate(`/devices/${encodeURIComponent(device.id)}/workspace`),
    [navigate],
  );
  const manageFiles = useCallback(
    (device: Device) => navigate(`/devices/${encodeURIComponent(device.id)}/workspace?tab=files`),
    [navigate],
  );

  return (
    <>
      {actions.context.messageContextHolder}
      {actions.context.modalContextHolder}
      <div className="page-stack devices-page">
        <PageHeader
          title={t('devices.title')}
          description={t('devices.subtitle')}
          actions={
            <DeviceHeaderActions
              client={client}
              connected={connected}
              addDevicesEnabled={applicationCapabilities.addDevices}
              groupsAvailable={sortedGroups.length > 0}
              selectedDeviceCount={selectedDevices.length}
              selectedDeviceIdCount={selection.selectedDeviceIds.length}
              fileTargetCount={fileTargets.length}
              canCommand={commandTargets.length > 0}
              canWake={selectedCapabilities.some(({ capabilities }) => capabilities.wake.enabled)}
              canPower={selectedCapabilities.some(({ capabilities }) => capabilities.power.enabled)}
              canUninstall={selectedCapabilities.some(
                ({ capabilities }) => capabilities.uninstall.enabled,
              )}
              onMove={actions.handlers.openBatchMove}
              onCommand={() => actions.handlers.openCommand(commandTargets)}
              onPowerAction={actions.handlers.confirmBatchPowerAction}
              onUninstallAgents={actions.handlers.confirmBatchAgentUninstall}
              onBatchUpload={actions.handlers.openBatchUpload}
              onAddDevice={actions.handlers.openInviteModal}
            />
          }
        />
        <Panel className="devices-table-card">
          <DeviceToolbar
            query={filters.query}
            groupId={filters.groupId}
            online={filters.online}
            platform={filters.platform}
            groups={sortedGroups}
            platforms={platforms}
            filteredCount={filteredDevices.length}
            totalCount={devices.length}
            connected={connected}
            onQueryChange={filters.setQuery}
            onGroupChange={filters.setGroupId}
            onOnlineChange={filters.setOnline}
            onPlatformChange={filters.setPlatform}
            onRefresh={() => void refreshSnapshot()}
          />
          <DeviceTable
            devices={filteredDevices}
            totalDeviceCount={devices.length}
            groupNameById={groupNameById}
            compareDeviceName={compareDeviceName}
            deviceCapabilities={deviceCapabilities}
            selectedDeviceIds={selection.selectedDeviceIds}
            onSelectionChange={selection.setSelectedDeviceIds}
            pagination={pagination}
            onOpenWorkspace={openWorkspace}
            onManageFiles={manageFiles}
            onCommand={actions.handlers.openDeviceCommand}
            onEdit={actions.handlers.openDeviceEditor}
            onDelete={actions.handlers.confirmDeviceDeletion}
            onUninstall={actions.handlers.confirmAgentUninstall}
            onPowerAction={actions.handlers.runPowerAction}
          />
        </Panel>
      </div>
      <DeviceListModals
        client={client}
        connected={connected}
        groups={sortedGroups}
        userInfo={userInfo}
        serverInfo={serverInfo}
        selectedDevices={selectedDevices}
        modals={actions.modals}
        handlers={actions.handlers}
        onSaved={refreshSnapshot}
      />
    </>
  );
}
