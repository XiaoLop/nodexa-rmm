import type { MeshCentralClient, ServerInfo, UserInfo } from '@meshcentral/control-client';
import type { Device, DeviceGroup } from '@meshcentral/shared-state';
import { useTranslation } from 'react-i18next';
import { MESH_AGENTS_URL, MESH_CENTRAL_RELAY_URL } from '../../config/gateway';
import { buildDeviceInviteServerInfo } from '../../features/devices/devicePresentation';
import type {
  DeviceModalHandlers,
  DeviceModalsState,
} from '../../features/devices/useDeviceActions';
import { BatchDeviceOperationsModal } from '../BatchDeviceOperationsModal';
import { BatchFileUploadModal } from '../BatchFileUploadModal';
import { CommandExecutionModal } from '../CommandExecutionModal';
import { DeviceEditModal } from '../DeviceEditModal';
import { DeviceInviteModal } from '../DeviceInviteModal';

const deviceInviteServerInfo = buildDeviceInviteServerInfo(MESH_AGENTS_URL);

interface DeviceListModalsProps {
  client?: MeshCentralClient;
  connected: boolean;
  groups: DeviceGroup[];
  userInfo?: UserInfo;
  serverInfo?: ServerInfo;
  selectedDevices: Device[];
  modals: DeviceModalsState;
  handlers: DeviceModalHandlers;
  onSaved: () => Promise<void>;
}

export function DeviceListModals({
  client,
  connected,
  groups,
  userInfo,
  serverInfo,
  selectedDevices,
  modals,
  handlers,
  onSaved,
}: DeviceListModalsProps) {
  const { t } = useTranslation();
  const {
    editingDevice,
    inviteOpen,
    batchUploadOpen,
    batchMoveOpen,
    commandDevices,
    batchDevices,
    batchUploadManager,
  } = modals;

  return (
    <>
      {editingDevice && (
        <DeviceEditModal
          device={editingDevice}
          groups={groups}
          client={client}
          userInfo={userInfo}
          serverInfo={serverInfo}
          onClose={handlers.closeEditor}
          onSaved={onSaved}
        />
      )}
      {inviteOpen && (
        <DeviceInviteModal
          isOpen
          meshId={groups[0]?.id ?? ''}
          meshName={groups[0]?.name ?? t('common.status.defaultGroup')}
          groups={groups}
          serverInfo={deviceInviteServerInfo}
          onClose={handlers.closeInvite}
        />
      )}
      {batchUploadOpen && (
        <BatchFileUploadModal
          open
          devices={batchDevices}
          meshCentralClient={client}
          baseUrl={MESH_CENTRAL_RELAY_URL}
          connected={connected}
          manager={batchUploadManager}
          onClose={handlers.closeBatchUpload}
          onStartTask={handlers.handleUploadStartTask}
        />
      )}
      {batchMoveOpen && (
        <BatchDeviceOperationsModal
          open
          devices={selectedDevices}
          groups={groups}
          client={client}
          connected={connected}
          userInfo={userInfo}
          serverInfo={serverInfo}
          onClose={handlers.closeBatchMove}
          onCompleted={handlers.handleBatchOperationCompleted}
          onSubmitTask={handlers.handleMoveSubmitTask}
        />
      )}
      {commandDevices.length > 0 && (
        <CommandExecutionModal
          open
          devices={commandDevices}
          client={client}
          connected={connected}
          onClose={handlers.closeCommand}
          onSubmitTask={handlers.handleCommandSubmitTask}
        />
      )}
    </>
  );
}
