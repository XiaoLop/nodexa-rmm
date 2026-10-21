import type { Device, DeviceGroup } from '@meshcentral/control-client';
import type {
  DevicePermissionEditor,
  GroupPermissionEditor,
} from '../../features/user-groups/useUserGroupDetails';
import { DeviceGroupPermissionModal } from '../users/DeviceGroupPermissionModal';
import { DevicePermissionModal } from '../users/DevicePermissionModal';

interface UserGroupPermissionModalsProps {
  canWrite: boolean;
  groups: DeviceGroup[];
  devices: Device[];
  currentGroupIds: string[];
  currentDeviceIds: string[];
  groupEditor?: GroupPermissionEditor;
  deviceEditor?: DevicePermissionEditor;
  submitting: boolean;
  onGroupCancel: () => void;
  onDeviceCancel: () => void;
  onGroupSubmit: (value: { groupId: string; rights: number }) => void | Promise<void>;
  onDeviceSubmit: (value: { deviceId: string; rights: number }) => void | Promise<void>;
}

export function UserGroupPermissionModals({
  canWrite,
  groups,
  devices,
  currentGroupIds,
  currentDeviceIds,
  groupEditor,
  deviceEditor,
  submitting,
  onGroupCancel,
  onDeviceCancel,
  onGroupSubmit,
  onDeviceSubmit,
}: UserGroupPermissionModalsProps) {
  return (
    <>
      <DeviceGroupPermissionModal
        open={Boolean(groupEditor) && canWrite}
        groups={groups}
        currentGroupIds={currentGroupIds}
        editing={groupEditor && groupEditor !== 'new' ? groupEditor : undefined}
        submitting={submitting}
        onCancel={onGroupCancel}
        onSubmit={onGroupSubmit}
      />
      <DevicePermissionModal
        subjectType="user-group"
        open={Boolean(deviceEditor) && canWrite}
        groups={groups}
        devices={devices}
        currentDeviceIds={currentDeviceIds}
        editing={deviceEditor && deviceEditor !== 'new' ? deviceEditor : undefined}
        submitting={submitting}
        onCancel={onDeviceCancel}
        onSubmit={onDeviceSubmit}
      />
    </>
  );
}
